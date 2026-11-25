// Rule-based stacking coach. Pure: no React, DOM, storage or randomness.
// Grounded in: covered holes and height differences (Hard Drop wiki), piece
// dependencies such as 2-wide and I-only wells (winterNebs), matched edges and
// new holes (Lindstedt & Gray 2013), and T-spin double / quad readiness.
// It only grades a band for one placement; it never names a better move.
import {
  HEIGHT,
  WIDTH,
  cells as pieceCells,
  classifyTSpin,
  collides,
  move,
  rotate,
  spawn,
  type Board,
  type Piece,
} from "./board";

/** All tunable numbers in one place. */
export const COACH_CONFIG = {
  /** Penalty per newly covered hole, and the cap for the hole flag. */
  holeWeight: 3,
  holeCap: 9,
  /**
   * Covered cells another piece can still tuck into: a dependency, not a hole.
   * Covered cells a T can fill with a spin (a T-slot under construction) are
   * free, since building that overhang is the point of a spin setup.
   */
  overhangWeight: 1,
  /** Adjacent height difference that counts as a spike, and its penalty. */
  spikeDiff: 4,
  spikeWeight: 2,
  /** Both columns of a 2-wide gap must sit this far below the outer neighbours. */
  twoWideDepth: 3,
  twoWideWeight: 2,
  /** A well this deep can only be filled by an I piece. */
  iWellDepth: 3,
  /** Penalty per I-only well beyond the first. */
  iDependencyWeight: 1,
  /** Penalty for destroying the last T-spin double slot. */
  lostTsdWeight: 2,
  /** Stack height at which the board is in danger, and its penalty. */
  highHeight: 14,
  highWeight: 1,
  /** Minimum penalty for each band; below inaccuracyAt is best or good. */
  inaccuracyAt: 1,
  mistakeAt: 3,
  blunderAt: 5,
} as const;

export type BoardShape = {
  heights: number[];
  /** Empty cells with a filled cell above them in the same column. */
  holes: number;
  /** Filled cells above a hole in their column (each costs a line to dig). */
  coveredCells: number;
  bumpiness: number;
  maxAdjacentDiff: number;
  maxHeight: number;
  /** Columns at least 2 below both neighbours (walls count as infinite). */
  wells: { x: number; depth: number }[];
};

export type CoachFlag =
  | { kind: "hole"; count: number }
  | { kind: "overhang"; count: number }
  | { kind: "spike"; diff: number }
  | { kind: "two-wide"; x: number }
  | { kind: "i-dependency"; count: number }
  | { kind: "lost-tsd" }
  | { kind: "high"; height: number };

export type Band = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export type PlacementReview = {
  flags: CoachFlag[];
  penalty: number;
  band: Band;
  after: BoardShape;
  tsdSlots: number;
  quadReady: boolean;
};

export function analyzeBoard(board: Board): BoardShape {
  const heights = Array<number>(WIDTH).fill(0);
  let holes = 0;
  let coveredCells = 0;
  for (let x = 0; x < WIDTH; x++) {
    let h = HEIGHT;
    while (h > 0 && board[h - 1][x] === null) h--;
    heights[x] = h;
    let seenHole = false;
    for (let y = 0; y < h; y++) {
      if (board[y][x] === null) {
        holes++;
        seenHole = true;
      } else if (seenHole) coveredCells++;
    }
  }
  let bumpiness = 0;
  let maxAdjacentDiff = 0;
  for (let x = 0; x < WIDTH - 1; x++) {
    const d = Math.abs(heights[x] - heights[x + 1]);
    bumpiness += d;
    if (d > maxAdjacentDiff) maxAdjacentDiff = d;
  }
  const wells: BoardShape["wells"] = [];
  for (let x = 0; x < WIDTH; x++) {
    const left = x > 0 ? heights[x - 1] : Infinity;
    const right = x < WIDTH - 1 ? heights[x + 1] : Infinity;
    const depth = Math.min(left, right) - heights[x];
    if (depth >= 2) wells.push({ x, depth });
  }
  return {
    heights,
    holes,
    coveredCells,
    bumpiness,
    maxAdjacentDiff,
    maxHeight: Math.max(...heights),
    wells,
  };
}

// Deepest well column; ties go rightmost. -1 when there is none.
function deepestWell(shape: BoardShape): number {
  let best = -1;
  let depth = 0;
  for (const w of shape.wells)
    if (w.depth >= depth) {
      best = w.x;
      depth = w.depth;
    }
  return best;
}

// Adjacent height difference per column pair, or -1 for pairs touching the well.
function pairDiffs(heights: number[], well: number): number[] {
  const out: number[] = [];
  for (let x = 0; x < WIDTH - 1; x++)
    out.push(
      x === well || x + 1 === well ? -1 : Math.abs(heights[x] - heights[x + 1]),
    );
  return out;
}

// Largest eligible pair that is a spike now and grew; 0 when none.
function newSpike(before: number[], after: number[]): number {
  let best = 0;
  for (let x = 0; x < after.length; x++)
    if (
      after[x] >= COACH_CONFIG.spikeDiff &&
      after[x] > before[x] &&
      after[x] > best
    )
      best = after[x];
  return best;
}

// Map each `after` row to the `before` row it came from (or -1 for rows that
// are new, empty padding). Cleared rows are before rows that vanished.
function mapRows(
  before: Board,
  after: Board,
  cleared: number,
): number[] | null {
  const fits = (b: number, a: number) =>
    before[b].every((cell, x) => cell === null || after[a][x] !== null);
  const map: number[] = [];
  const go = (b: number, a: number, left: number): boolean => {
    if (b === HEIGHT) {
      for (let i = a; i < HEIGHT; i++) map[i] = -1;
      return after.slice(a).every((row) => row.every((c) => c === null));
    }
    if (a < HEIGHT && fits(b, a)) {
      map[a] = b;
      if (go(b + 1, a + 1, left)) return true;
    }
    return left > 0 && go(b + 1, a, left - 1);
  };
  return go(0, 0, cleared) ? map : null;
}

// Empty cells (y * WIDTH + x) that are covered in `after` but were not
// covered in `before`.
function newlyCoveredCells(
  before: Board,
  after: Board,
  bh: number[],
  ah: number[],
  cleared: number,
): number[] {
  const map = mapRows(before, after, cleared);
  const out: number[] = [];
  for (let x = 0; x < WIDTH; x++)
    for (let y = 0; y < ah[x]; y++) {
      if (after[y][x] !== null) continue;
      const from = map ? map[y] : -1;
      if (from < 0 || before[from][x] !== null || from >= bh[x])
        out.push(y * WIDTH + x);
    }
  return out;
}

// Pivots of I and O poses can sit just outside the board, so pad the index.
const PAD = 2;
const poseKey = (p: Piece) =>
  ((p.y + PAD) * (WIDTH + 2 * PAD) + (p.x + PAD)) * 4 + p.rotation;
const POSES = (HEIGHT + 2 * PAD) * (WIDTH + 2 * PAD) * 4;

// Every pose a piece reaches from spawn with slides, soft drop and rotations
// (kicks included). `onRotate` sees each pose entered by a rotation. Any pose
// lying entirely above the stack is reachable through open air, so when the
// stack is low the search starts from the poses resting just above it instead
// of from spawn, and only explores the band the stack occupies.
function explore(
  board: Board,
  type: Piece["type"],
  visit: (p: Piece) => boolean | void,
  onRotate?: (p: Piece) => boolean | void,
) {
  const start = spawn(type);
  if (collides(board, start)) return;
  let stackTop = 0;
  for (let y = 0; y < HEIGHT; y++) if (rowCount(board, y) > 0) stackTop = y + 1;
  const seen = new Uint8Array(POSES);
  const stack: Piece[] = [];
  const seed = (p: Piece) => {
    seen[poseKey(p)] = 1;
    stack.push(p);
    return visit(p);
  };
  if (stackTop + 4 >= start.y) {
    if (seed(start)) return;
  } else {
    for (let rotation = 0; rotation < 4; rotation++)
      for (let x = -PAD; x < WIDTH + PAD; x++) {
        const probe: Piece = {
          type,
          x,
          y: 0,
          rotation: rotation as Piece["rotation"],
        };
        const low = Math.min(...pieceCells(probe).map(([, cy]) => cy));
        const p = { ...probe, y: stackTop - low };
        if (collides(board, p)) continue;
        if (seed(p)) return;
      }
  }
  while (stack.length) {
    const piece = stack.pop()!;
    const next = [
      move(board, piece, -1, 0),
      move(board, piece, 1, 0),
      move(board, piece, 0, -1),
    ];
    for (const amount of [1, -1, 2] as const) {
      const p = rotate(board, piece, amount);
      if (p !== piece && onRotate?.(p)) return;
      next.push(p);
    }
    for (const p of next) {
      if (p === piece || seen[poseKey(p)]) continue;
      seen[poseKey(p)] = 1;
      if (visit(p)) return;
      stack.push(p);
    }
  }
}

/**
 * Sort newly covered cells into spin-slot cells (a T rotated into a resting,
 * three-corner pose that a plain drop cannot reach fills them), overhang cells
 * (some piece can still reach them) and sealed holes.
 */
function classifyCovered(board: Board, cells: number[]) {
  // Cells walled off from the open air are sealed; no piece search needed.
  const air = new Uint8Array(HEIGHT * WIDTH);
  const queue: number[] = [];
  for (let x = 0; x < WIDTH; x++) {
    const k = (HEIGHT - 1) * WIDTH + x;
    if (board[HEIGHT - 1][x] === null) {
      air[k] = 1;
      queue.push(k);
    }
  }
  while (queue.length) {
    const k = queue.pop()!;
    const x = k % WIDTH;
    for (const n of [
      k - WIDTH,
      k + WIDTH,
      x > 0 ? k - 1 : -1,
      x < WIDTH - 1 ? k + 1 : -1,
    ]) {
      if (n < 0 || n >= HEIGHT * WIDTH || air[n]) continue;
      if (board[Math.floor(n / WIDTH)][n % WIDTH] !== null) continue;
      air[n] = 1;
      queue.push(n);
    }
  }
  const left = new Set(cells.filter((k) => air[k]));
  let sealed = cells.length - left.size;
  if (left.size === 0) return { spinCols: [], overhang: 0, sealed };

  const top = spawn("T").y;
  const droppable = (p: Piece) => {
    for (let y = p.y + 1; y <= top; y++)
      if (collides(board, { ...p, y })) return false;
    return p.y < top || p.rotation === 0;
  };
  const spin = new Set<number>();
  const open = new Set<number>();
  const mark = (p: Piece, into: Set<number>) => {
    for (const [x, y] of pieceCells(p)) {
      const k = y * WIDTH + x;
      if (left.has(k)) into.add(k);
    }
  };
  // One T search finds spin slots (rotated into a resting, three-corner pose a
  // plain drop cannot reach) and plain T reachability at once.
  explore(
    board,
    "T",
    (p) => {
      mark(p, open);
    },
    (p) => {
      if (
        collides(board, { ...p, y: p.y - 1 }) &&
        classifyTSpin(board, p, 0) !== null &&
        !droppable(p)
      )
        mark(p, spin);
      return spin.size === left.size;
    },
  );
  const spinCols = [...new Set([...spin].map((k) => k % WIDTH))];
  for (const k of spin) left.delete(k);
  let overhang = 0;
  for (const k of [...left])
    if (open.has(k)) {
      left.delete(k);
      overhang++;
    }
  for (const type of ["J", "L", "S", "Z", "I", "O"] as const) {
    if (left.size === 0) break;
    explore(board, type, (p) => {
      for (const [x, y] of pieceCells(p))
        if (left.delete(y * WIDTH + x)) overhang++;
      return left.size === 0;
    });
  }
  sealed += left.size;
  return { spinCols, overhang, sealed };
}

// Left x of each 2-wide gap: both columns well below both outer neighbours.
function twoWides(heights: number[]): number[] {
  const out: number[] = [];
  for (let x = 0; x < WIDTH - 1; x++) {
    const outer = Math.min(
      x > 0 ? heights[x - 1] : Infinity,
      x + 2 < WIDTH ? heights[x + 2] : Infinity,
    );
    const low = Math.max(heights[x], heights[x + 1]);
    if (outer - low >= COACH_CONFIG.twoWideDepth) out.push(x);
  }
  return out;
}

const iWells = (s: BoardShape) =>
  s.wells.filter((w) => w.depth >= COACH_CONFIG.iWellDepth).length;

function rowCount(board: Board, y: number): number {
  let n = 0;
  for (let x = 0; x < WIDTH; x++) if (board[y][x] !== null) n++;
  return n;
}

/**
 * T placements pointing down (rotation 2) that form a real T-spin double:
 * resting in place, 3 occupied corners, clearing 2+ lines, not reachable by a
 * plain drop in that pose, and reached from spawn with a rotation as the last
 * move (kicks included).
 */
export function findTsdSlots(board: Board): Piece[] {
  const top = spawn("T").y;
  const candidates: Piece[] = [];
  const counts = board.map((_, y) => rowCount(board, y));
  for (let x = 1; x < WIDTH - 1; x++)
    for (let y = 1; y < HEIGHT; y++) {
      if (counts[y] !== WIDTH - 3 || counts[y - 1] !== WIDTH - 1) continue;
      const piece: Piece = { type: "T", x, y, rotation: 2 };
      if (collides(board, piece)) continue;
      if (!collides(board, { ...piece, y: y - 1 })) continue;
      if (classifyTSpin(board, piece, 0) === null) continue;
      // Rows holding the piece: y (three cells) and y - 1 (the nub).
      if (rowCount(board, y) !== WIDTH - 3) continue;
      if (rowCount(board, y - 1) !== WIDTH - 1) continue;
      // Spawn is rotation 0, so only slots strictly below spawn height can be
      // reached by a straight drop; check the path above each of those.
      let droppable = y < top;
      for (let yy = y + 1; yy <= top && droppable; yy++)
        if (collides(board, { ...piece, y: yy })) droppable = false;
      if (!droppable) candidates.push(piece);
    }
  if (candidates.length === 0) return [];
  const key = (p: Piece) => (p.y * WIDTH + p.x) * 4 + p.rotation;
  const wanted = new Set(candidates.map(key));
  const found = new Set<number>();
  const start = spawn("T");
  if (collides(board, start)) return []; // topped out: nothing is reachable
  // Visit each pose once. A candidate counts when some visited pose reaches it
  // by a rotation, so the last move is a rotation.
  const seen = new Uint8Array(HEIGHT * WIDTH * 4);
  seen[key(start)] = 1;
  const stack: Piece[] = [start];
  while (stack.length && found.size < wanted.size) {
    const piece = stack.pop()!;
    const next = [
      move(board, piece, -1, 0),
      move(board, piece, 1, 0),
      move(board, piece, 0, -1),
    ];
    for (const amount of [1, -1, 2] as const) {
      const p = rotate(board, piece, amount);
      if (p !== piece && wanted.has(key(p))) found.add(key(p));
      next.push(p);
    }
    for (const p of next) {
      if (p === piece || seen[key(p)]) continue;
      seen[key(p)] = 1;
      stack.push(p);
    }
  }
  return candidates.filter((p) => found.has(key(p)));
}

/** Some open column where a vertical I would clear 4 lines. */
export function quadReady(board: Board): boolean {
  for (let x = 0; x < WIDTH; x++) {
    let base = HEIGHT;
    while (base > 0 && board[base - 1][x] === null) base--;
    if (base + 3 >= HEIGHT) continue;
    let ok = true;
    for (let y = base; y < base + 4 && ok; y++)
      ok = rowCount(board, y) === WIDTH - 1;
    if (ok) return true;
  }
  return false;
}

function bandFor(penalty: number, kept: boolean): Band {
  const c = COACH_CONFIG;
  if (penalty >= c.blunderAt) return "blunder";
  if (penalty >= c.mistakeAt) return "mistake";
  if (penalty >= c.inaccuracyAt) return "inaccuracy";
  return kept ? "best" : "good";
}

/** Band for a raw penalty; exported so thresholds can be tested directly. */
export function bandForPenalty(penalty: number, kept = false): Band {
  return bandFor(penalty, kept);
}

// A lock adds 4 cells and each cleared row removes WIDTH, so the clear count
// follows from the change in filled cells when the caller does not pass it.
function filledCells(board: Board) {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell !== null) n++;
  return n;
}
function inferCleared(before: Board, after: Board) {
  const removed = filledCells(before) + 4 - filledCells(after);
  return Math.max(0, Math.round(removed / WIDTH));
}

/**
 * Grade one placement. `after` is the board after the lock and line clears.
 * `mainWell` defaults to the deepest well of `before` (ties go rightmost).
 * Flags blame only what this placement created, never pre-existing damage.
 */
export function reviewPlacement(
  before: Board,
  after: Board,
  opts: { cleared?: number; spin?: boolean; mainWell?: number } = {},
): PlacementReview {
  const c = COACH_CONFIG;
  const b = analyzeBoard(before);
  const a = analyzeBoard(after);
  const well = opts.mainWell ?? deepestWell(b);
  const flags: CoachFlag[] = [];
  let penalty = 0;

  // Newly covered cells only: a clear that uncovers an old hole never cancels
  // a hole this placement just covered.
  const cleared = opts.cleared ?? inferCleared(before, after);
  const covered = newlyCoveredCells(
    before,
    after,
    b.heights,
    a.heights,
    cleared,
  );
  const { overhang, sealed, spinCols } =
    covered.length > 0
      ? classifyCovered(after, covered)
      : { overhang: 0, sealed: 0, spinCols: [] as number[] };
  const tsdSlots = findTsdSlots(after);
  if (sealed > 0) {
    flags.push({ kind: "hole", count: sealed });
    penalty += Math.min(c.holeCap, sealed * c.holeWeight);
  }
  if (overhang > 0) {
    flags.push({ kind: "overhang", count: overhang });
    penalty += c.overhangWeight;
  }
  // A T-slot always sits next to a tall roof; that step is the setup, not a
  // spike, so pairs touching a spin-slot column are left out.
  const slotCols = new Set([...spinCols, ...tsdSlots.map((p) => p.x)]);
  const spike = newSpike(
    pairDiffs(b.heights, well),
    pairDiffs(a.heights, well).map((d, x) =>
      slotCols.has(x) || slotCols.has(x + 1) ? -1 : d,
    ),
  );
  if (spike > 0) {
    flags.push({ kind: "spike", diff: spike });
    penalty += c.spikeWeight;
  }
  const oldWides = twoWides(b.heights);
  for (const x of twoWides(a.heights))
    if (!oldWides.includes(x)) {
      flags.push({ kind: "two-wide", x });
      penalty += c.twoWideWeight;
    }
  const wellsAfter = iWells(a);
  const extraWells = wellsAfter - Math.max(1, iWells(b));
  if (extraWells > 0) {
    flags.push({ kind: "i-dependency", count: wellsAfter });
    penalty += extraWells * c.iDependencyWeight;
  }
  const tsdAfter = tsdSlots.length;
  if (
    tsdAfter === 0 &&
    !(opts.spin && cleared > 0) &&
    findTsdSlots(before).length > 0
  ) {
    flags.push({ kind: "lost-tsd" });
    penalty += c.lostTsdWeight;
  }
  // Only a placement that raised the stack into the danger zone is blamed.
  if (a.maxHeight >= c.highHeight && a.maxHeight > b.maxHeight) {
    flags.push({ kind: "high", height: a.maxHeight });
    penalty += c.highWeight;
  }
  const quad = quadReady(after);
  return {
    flags,
    penalty,
    band: bandFor(penalty, tsdAfter > 0 || quad || cleared > 0),
    after: a,
    tsdSlots: tsdAfter,
    quadReady: quad,
  };
}
