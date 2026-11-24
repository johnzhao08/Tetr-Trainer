// Rule-based stacking coach. Pure: no React, DOM, storage or randomness.
// Grounded in: covered holes and height differences (Hard Drop wiki), piece
// dependencies such as 2-wide and I-only wells (winterNebs), matched edges and
// new holes (Lindstedt & Gray 2013), and T-spin double / quad readiness.
// It only grades a band for one placement; it never names a better move.
import {
  HEIGHT,
  WIDTH,
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

// Largest adjacent height difference, ignoring pairs that touch the main well.
function spikeDiff(heights: number[], well: number): number {
  let max = 0;
  for (let x = 0; x < WIDTH - 1; x++) {
    if (x === well || x + 1 === well) continue;
    max = Math.max(max, Math.abs(heights[x] - heights[x + 1]));
  }
  return max;
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
  for (let x = 1; x < WIDTH - 1; x++)
    for (let y = 1; y < top; y++) {
      const piece: Piece = { type: "T", x, y, rotation: 2 };
      if (collides(board, piece)) continue;
      if (!collides(board, { ...piece, y: y - 1 })) continue;
      if (classifyTSpin(board, piece, 0) === null) continue;
      // Rows holding the piece: y (three cells) and y - 1 (the nub).
      if (rowCount(board, y) !== WIDTH - 3) continue;
      if (rowCount(board, y - 1) !== WIDTH - 1) continue;
      let droppable = true;
      for (let yy = y + 1; yy <= top && droppable; yy++)
        if (collides(board, { ...piece, y: yy })) droppable = false;
      if (!droppable) candidates.push(piece);
    }
  if (candidates.length === 0) return [];
  const key = (p: Piece) => (p.y * WIDTH + p.x) * 4 + p.rotation;
  const wanted = new Set(candidates.map(key));
  const found = new Set<number>();
  const start = spawn("T");
  const seen = new Set<number>([key(start) * 2]);
  let frontier: [Piece, boolean][] = [[start, false]];
  while (frontier.length && found.size < wanted.size) {
    const next: [Piece, boolean][] = [];
    for (const [piece, rotated] of frontier) {
      if (rotated && wanted.has(key(piece))) found.add(key(piece));
      const options: [Piece, boolean][] = [
        [move(board, piece, -1, 0), false],
        [move(board, piece, 1, 0), false],
        [move(board, piece, 0, -1), false],
        [rotate(board, piece, 1), true],
        [rotate(board, piece, -1), true],
        [rotate(board, piece, 2), true],
      ];
      for (const [p, r] of options) {
        if (p === piece) continue;
        const k = key(p) * 2 + (r ? 1 : 0);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push([p, r]);
      }
    }
    frontier = next;
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

  // Net new holes only, so clears that uncover holes are never blamed.
  const newHoles = a.holes - b.holes;
  if (newHoles > 0) {
    flags.push({ kind: "hole", count: newHoles });
    penalty += Math.min(c.holeCap, newHoles * c.holeWeight);
  }
  const spike = spikeDiff(a.heights, well);
  if (spike >= c.spikeDiff && spike > spikeDiff(b.heights, well)) {
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
  if (wellsAfter > 1 && wellsAfter > iWells(b)) {
    flags.push({ kind: "i-dependency", count: wellsAfter });
    penalty += (wellsAfter - 1) * c.iDependencyWeight;
  }
  const cleared = opts.cleared ?? 0;
  const tsdAfter = findTsdSlots(after).length;
  if (
    tsdAfter === 0 &&
    !(opts.spin && cleared > 0) &&
    findTsdSlots(before).length > 0
  ) {
    flags.push({ kind: "lost-tsd" });
    penalty += c.lostTsdWeight;
  }
  // A clear that lowers the stack is not blamed for staying tall.
  if (a.maxHeight >= c.highHeight && a.maxHeight >= b.maxHeight) {
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
