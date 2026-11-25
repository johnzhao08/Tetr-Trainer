import { emptyBoard, HEIGHT, SHAPES, TYPES, WIDTH } from "./board";
import type { Board } from "./board";
import { findTsdSlots, quadReady } from "./coach";
import { TABLES } from "./reach";
import { findPlacements, findSpins } from "./spins";
import type { SpinMove } from "./spins";

export type ChainStep = { spin: "full" | "mini"; lines: number };

export type Structure = {
  id: string;
  name: string;
  aliases?: string[];
  family: "tsd" | "tst" | "donation" | "combo-spin" | "skim";
  /** Top-down rows, `X` filled; row 0 of the array is the highest row. */
  fixture: string[];
  /** The T-spins the fixture yields in order; checked by `chainSearch`. */
  chain: ChainStep[];
  sends: string;
  use: string;
  mistakes: string[];
  cue: (board: Board) => boolean;
  cueText: string;
};

/** Board from top-down rows; `.` is empty, anything else is filled. */
export function boardFromRows(rows: string[]): Board {
  const board = emptyBoard();
  rows.forEach((row, i) =>
    [...row].forEach((c, x) => {
      if (c !== ".") board[rows.length - 1 - i][x] = "X";
    }),
  );
  return board;
}

export function mirrorBoard(board: Board): Board {
  return board.map((row) => [...row].reverse());
}

// ---------------------------------------------------------------- chains

export type Chain = {
  spins: ChainStep[];
  moves: SpinMove[];
  board: Board;
};

/**
 * Every sequence of up to `depth` (1 to 3) line-clearing T-spins, each made by
 * one T on the board the previous one left. Sequences that end in the same
 * board with the same spins are listed once.
 */
export function chainSearch(board: Board, depth: number): Chain[] {
  const out = new Map<string, Chain>();
  const walk = (b: Board, moves: SpinMove[]) => {
    if (moves.length === depth) return;
    for (const move of findSpins(b, "T")) {
      const next = [...moves, move];
      const spins = next.map((m) => ({ spin: m.spin, lines: m.lines }));
      const key = JSON.stringify(spins) + JSON.stringify(move.after);
      if (!out.has(key))
        out.set(key, { spins, moves: next, board: move.after });
      walk(move.after, next);
    }
  };
  walk(board, []);
  return [...out.values()];
}

// ------------------------------------------------------------------ cues

function heights(board: Board): number[] {
  return Array.from({ length: WIDTH }, (_, x) => {
    let y = HEIGHT;
    while (y > 0 && board[y - 1][x] === null) y--;
    return y;
  });
}

/**
 * The columns spanned by the empty (`.`) cells of `template` where it matches
 * the board anywhere, in either orientation; null when it does not match.
 */
function matchSpan(board: Board, template: string[]): [number, number] | null {
  const top = Math.max(...heights(board));
  const mirrored = template.map((r) => [...r].reverse().join(""));
  for (const tpl of [template, mirrored]) {
    const h = tpl.length;
    const w = tpl[0].length;
    const empty = [...Array(w).keys()].filter((j) =>
      tpl.some((r) => r[j] === "."),
    );
    for (let y0 = 0; y0 <= Math.min(top, HEIGHT - h); y0++)
      for (let x0 = 0; x0 <= WIDTH - w; x0++) {
        let ok = true;
        for (let i = 0; i < h && ok; i++)
          for (let j = 0; j < w && ok; j++) {
            const c = tpl[i][j];
            if (c === "?") continue;
            ok = (board[y0 + h - 1 - i][x0 + j] !== null) === (c === "X");
          }
        if (ok) return [x0 + empty[0], x0 + empty[empty.length - 1]];
      }
  }
  return null;
}
const matches = (board: Board, template: string[]) =>
  matchSpan(board, template) !== null;

/**
 * Cue templates, top-down: `X` filled, `.` empty, `?` anything. Each keeps only
 * the cells the structure's spins depend on: the empty cells the T pieces pass
 * through and land in, the filled corners and roof around them, and the cells
 * that make the later spin possible. Everything else is `?`, so unrelated
 * blocks anywhere else do not hide the cue. Only the columns the spins touch,
 * plus two on each side for the corners and approach, are kept, so the cue is found at any
 * horizontal shift. The fixtures' own text is not the template;
 * tests/structures.test.ts re-derives each one by flipping every cell of the
 * fixture in those columns and keeping those that break the spin chain.
 */
export const CUE_TEMPLATES: Record<string, string[]> = {
  tst: ["X..?", "....", ".X??", "..??", ".???"],
  stsd: ["?.???", "..???", "..X??", "...??", "XX.XX", "X..?X", "X..X?"],
  "triple-double": [
    "???..??",
    "??X..X?",
    "??...??",
    "XX.XXXX",
    "X?..XXX",
    "XX.?XXX",
    "??X.X??",
  ],
  fractal: ["???..??", "??X..??", "XX...XX", "XXX.XXX", "??...??", "??X.X??"],
  "imperial-cross": [
    "????..??",
    "???X..X?",
    "???...??",
    "XXX.?XXX",
    "??...X??",
    "??X.????",
  ],
};

/**
 * A stair head at an edge column, with a pocket at least 3 deep under its
 * cover. The edge column is covered, two steps of exactly one row lead down
 * from it, and below the cover its cells are empty with a filled wall beside
 * them. The pocket is found from the cover, so anything may sit beneath it.
 */
export function kaidanCue(board: Board): boolean {
  return kaidanWell(board) !== null;
}

/** The well column of the Kaidan cue, or null. */
function kaidanWell(board: Board): number | null {
  const h = heights(board);
  for (const [w, d] of [
    [WIDTH - 1, -1],
    [0, 1],
  ]) {
    if (h[w] < 4 || h[w + d] !== h[w] - 1 || h[w + 2 * d] !== h[w] - 2)
      continue;
    let y = h[w] - 1;
    while (y >= 0 && board[y][w] !== null) y--;
    let depth = 0;
    while (y >= 0 && board[y][w] === null && board[y][w + d] !== null) {
      depth++;
      y--;
    }
    if (depth >= 3) return w;
  }
  return null;
}

/**
 * The columns of the empty pocket a structure's cue found on `board` (the
 * Kaidan well, or the empty cells of a template), or null when the cue does
 * not hold. A follow-up spin must land in these columns to count as the same use.
 */
export function cueSpan(id: string, board: Board): [number, number] | null {
  if (id === "kaidan") {
    const w = kaidanWell(board);
    return w === null ? null : [w, w];
  }
  return CUE_TEMPLATES[id] ? matchSpan(board, CUE_TEMPLATES[id]) : null;
}

/**
 * Two equal-height columns four apart with a flat, empty 3-wide gap at least
 * two rows deep between them. This is the shape an STMB Cave starts from; no
 * fixture is shipped for it because the search could not prove a spin chain.
 */
export function stmbCue(board: Board): boolean {
  const h = heights(board);
  for (let c = 0; c + 4 < WIDTH; c++)
    if (
      h[c] === h[c + 4] &&
      h[c + 1] === h[c + 2] &&
      h[c + 2] === h[c + 3] &&
      h[c + 1] <= h[c] - 2
    )
      return true;
  return false;
}

// ------------------------------------------------------------- structures

export const STRUCTURES: Structure[] = [
  {
    id: "tsd",
    name: "T-spin Double",
    aliases: ["TSD"],
    family: "tsd",
    // https://four.lol/srs/t-spin, diagram 0 (the 3-corner example).
    fixture: ["XXXX......", "XXX...XXXX", "XXXX.XXXXX"],
    chain: [{ spin: "full", lines: 2 }],
    sends: "5 with B2B active and no combo (4 without B2B).",
    use: "The default attack: build it whenever a T is coming.",
    mistakes: [
      "Leaving the overhang cell out, which makes the spin a mini.",
      "Stacking so high that a hole under the slot goes uncleared.",
    ],
    cue: (b) => findTsdSlots(b).length > 0,
    cueText:
      "A flat 3-wide gap one row above a single-cell notch, with an overhang.",
  },
  {
    id: "tst",
    name: "T-spin Triple",
    aliases: ["TST"],
    family: "tst",
    // https://four.lol/methods/tspin-triple, diagram 0 (Setup).
    fixture: [
      "XXXX......",
      "XXX.......",
      "XXX.XXXXXX",
      "XXX..XXXXX",
      "XXX.XXXXXX",
    ],
    chain: [{ spin: "full", lines: 3 }],
    sends: "7 with B2B active and no combo.",
    use: "From a notch, a two-step stair, or a converted TSD, when a triple fits the stack better than a double.",
    mistakes: [
      "Leaving an overhang that needs cleaning afterwards.",
      "Choosing it when a TSD would keep the stack cleaner.",
    ],
    cue: (b) => matches(b, CUE_TEMPLATES["tst"]),
    cueText:
      "A 3-deep shaft whose middle row is 2 wide, with a roof two rows above.",
  },
  {
    id: "stsd",
    name: "STSD",
    aliases: ["Stacked T-spin Double"],
    family: "combo-spin",
    // https://four.lol/methods/stsd, diagram 0 (headline).
    fixture: [
      "..XXXXXXXX",
      "...XXXXXXX",
      "XX.XXXXXXX",
      "X..XXXXXXX",
      "X..XXXXXXX",
    ],
    chain: [
      { spin: "full", lines: 2 },
      { spin: "full", lines: 2 },
    ],
    sends: "5 then 5 with B2B active.",
    use: "Build over Tetris columns or to recover from a misdrop.",
    mistakes: [
      "Building it without T pieces soon, which leaves a hole.",
      "Using it by habit instead of a plain TSD.",
    ],
    cue: (b) => matches(b, CUE_TEMPLATES["stsd"]),
    cueText:
      "A 3x3 empty space with a roof on one side and a 1-wide shaft offset one column going two rows deeper.",
  },
  {
    id: "triple-double",
    name: "Triple Double",
    aliases: ["TD", "C-Spin"],
    family: "combo-spin",
    // https://four.lol/methods/triple-double, diagram 0 (headline): the TST
    // comes first, then the TSD.
    fixture: [
      "XXXX..XXXX",
      "XXX...XXXX",
      "XXX.XXXXXX",
      "XXX..XXXXX",
      "XXX.XXXXXX",
      "XXXX.XXXXX",
    ],
    chain: [
      { spin: "full", lines: 3 },
      { spin: "full", lines: 2 },
    ],
    sends: "7 then 5 with B2B active: 12 lines.",
    use: "A midgame setup from a notch or a two-step stair; the J/L build is called C-Spin.",
    mistakes: ["Spending the setup when no T arrives in time."],
    cue: (b) => matches(b, CUE_TEMPLATES["triple-double"]),
    cueText:
      "A notch (3-deep shaft, middle row 2 wide) with a TSD slot stacked on top of it.",
  },
  {
    id: "fractal",
    name: "Fractal",
    family: "combo-spin",
    // https://four.lol/methods/fractal, diagram 0 (headline).
    fixture: [
      "XXX.......",
      "XX...XXXXX",
      "XXX.XXXXXX",
      "XX...XXXXX",
      "XXX.XXXXXX",
    ],
    chain: [
      { spin: "full", lines: 2 },
      { spin: "full", lines: 2 },
    ],
    sends: "5 then 5 with B2B active.",
    use: "When no I is coming, usually built on an existing TSD.",
    mistakes: ["Starting it without two T pieces in sight."],
    cue: (b) => matches(b, CUE_TEMPLATES["fractal"]),
    cueText:
      "Two TSD pockets stacked one above the other, with a one-cell notch under each.",
  },
  {
    id: "imperial-cross",
    name: "Imperial Cross",
    family: "combo-spin",
    // https://four.lol/methods/imperial-cross, diagram 0 (headline): a
    // Fractal with the overhang shifted.
    fixture: [
      "XXXX..XXXX",
      "XXX...XXXX",
      "XXX.XXXXXX",
      "XX...XXXXX",
      "XXX.XXXXXX",
    ],
    chain: [
      { spin: "full", lines: 2 },
      { spin: "full", lines: 2 },
    ],
    sends: "5 then 5 with B2B active.",
    use: "After a TKI, or to fix a bad overhang when a Fractal cannot be built. Slow.",
    mistakes: ["Building it when a faster TSD is available."],
    cue: (b) => matches(b, CUE_TEMPLATES["imperial-cross"]),
    cueText:
      "Two flat 3-wide gaps stacked with single-cell notches below each.",
  },
  {
    id: "kaidan",
    name: "Kaidan",
    aliases: ["stairs donation"],
    family: "donation",
    // https://four.lol/methods/kaidan, diagram 0 page 2 (stair, Z over the
    // well, I as the roof), drawn with X. Its two rows under the well are the
    // well running on, so the quad is ready after the spin; the page draws
    // only the stair.
    fixture: [
      "...XXXX...",
      "XXXXXX...X",
      "XXXXXXX.XX",
      "XXXXXXXXX.",
      "XXXXXXXXX.",
      "XXXXXXXXX.",
      "XXXXXXXXX.",
    ],
    chain: [{ spin: "full", lines: 2 }],
    sends: "5 with B2B active and no combo; the well reopens for a quad.",
    use: "Donate a TSD from the edge of a stair over a well, fixing parity.",
    mistakes: ["Donating with no I coming, which wastes the reopened well."],
    cue: kaidanCue,
    cueText:
      "A two-step stair at the edge whose top covers a pocket at least 3 deep.",
  },
];

export function boardOf(structure: Structure): Board {
  return boardFromRows(structure.fixture);
}

// ------------------------------------------------------------- dead board

// Row bitmasks make the second placement cheap: most boards after it are
// dismissed by counting empties per row, before any spin search runs.
type Rows = Int32Array;
const FULL = (1 << WIDTH) - 1;
const BITS = Uint8Array.from({ length: 1 << WIDTH }, (_, m) => {
  let n = 0;
  for (let v = m; v; v &= v - 1) n++;
  return n;
});

function toRows(board: Board): Rows {
  const rows = new Int32Array(HEIGHT);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) if (board[y][x] !== null) rows[y] |= 1 << x;
  return rows;
}

function fromRows(rows: Rows): Board {
  const board = emptyBoard();
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) if (rows[y] & (1 << x)) board[y][x] = "X";
  return board;
}

const T_SHAPES = Object.fromEntries(
  TYPES.map((t) => [t, SHAPES[t].map((sh) => Int8Array.from(sh.flat()))]),
);

/** Every board one hard-dropped piece (any type, rotation and column) leaves. */
function drops(rows: Rows): Rows[] {
  const top = new Int32Array(WIDTH);
  let max = 0;
  for (let x = 0; x < WIDTH; x++) {
    let y = HEIGHT;
    while (y > 0 && !(rows[y - 1] & (1 << x))) y--;
    top[x] = y;
    if (y > max) max = y;
  }
  const out: Rows[] = [];
  const seenShapes = new Set<string>();
  for (const type of TYPES)
    for (const c of T_SHAPES[type]) {
      const shapeKey = type + c.join();
      if (seenShapes.has(shapeKey)) continue;
      seenShapes.add(shapeKey);
      for (let x = 0; x < WIDTH; x++) {
        let y = -4;
        let fits = true;
        for (let i = 0; i < 8; i += 2) {
          const px = x + c[i];
          if (px < 0 || px >= WIDTH) {
            fits = false;
            break;
          }
          y = Math.max(y, top[px] - c[i + 1]);
        }
        if (!fits) continue;
        for (let i = 1; i < 8; i += 2)
          if (y + c[i] >= HEIGHT || y + c[i] < 0) fits = false;
        if (!fits) continue;
        const next = rows.slice();
        for (let i = 0; i < 8; i += 2) next[y + c[i + 1]] |= 1 << (x + c[i]);
        out.push(clearFull(next));
      }
    }
  return out;
}

function clearFull(rows: Rows): Rows {
  if (!rows.includes(FULL)) return rows;
  const kept = [...rows].filter((m) => m !== FULL);
  const next = new Int32Array(HEIGHT);
  next.set(kept);
  return next;
}

// Cells a piece can possibly reach: empty cells joined to the open air above
// the stack through empty neighbours. A covered pocket is not in the set.
function openCells(rows: Rows, top: number): Int32Array {
  const open = new Int32Array(HEIGHT);
  open[top + 1] = FULL;
  for (let y = top + 2; y < HEIGHT; y++) open[y] = FULL;
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = top; y >= 0; y--) {
      const empty = ~rows[y] & FULL;
      let r = (open[y] | open[y + 1] | (y > 0 ? open[y - 1] : 0)) & empty;
      for (let prev = -1; prev !== r; ) {
        prev = r;
        r |= ((r << 1) | (r >> 1)) & empty;
      }
      if (r !== open[y]) {
        open[y] = r;
        changed = true;
      }
    }
  }
  return open;
}

const T_CELLS = SHAPES.T.map((shape) => Int8Array.from(shape.flat()));
const T_KICK5 = [0, 1, 2, 3].map((from) =>
  [0, 1, 2, 3].map((to) => {
    const k = TABLES.T.kicks[from][to];
    return k.length >= 10 ? [k[8], k[9]] : null;
  }),
);

const filled = (rows: Rows, x: number, y: number) =>
  x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || (rows[y] & (1 << x)) !== 0;

// A T pose whose four cells are empty and reachable.
function poseFits(rows: Rows, open: Int32Array, x: number, y: number, r: number) {
  const c = T_CELLS[r];
  for (let i = 0; i < 8; i += 2) {
    const px = x + c[i];
    const py = y + c[i + 1];
    if (filled(rows, px, py) || !(open[py] & (1 << px))) return false;
  }
  return true;
}

// A T pose that fits in reachable cells, rests on something, has three
// occupied corners and fills enough rows: a necessary condition for a spin.
// A full spin also needs both front corners, or the fifth kick test.
function tPoseNear(
  rows: Rows,
  open: Int32Array,
  row: number,
  strict: boolean,
): boolean {
  const need = strict ? 1 : 2;
  for (let r = 0; r < 4; r++) {
    const c = T_CELLS[r];
    for (let y = Math.max(0, row - 1); y <= row + 1; y++)
      for (let x = 0; x < WIDTH; x++) {
        if (!poseFits(rows, open, x, y, r)) continue;
        let rests = false;
        for (let i = 0; i < 8 && !rests; i += 2)
          rests = filled(rows, x + c[i], y + c[i + 1] - 1);
        if (!rests) continue;
        let corners = 0;
        let front = 0;
        for (let dx = -1; dx <= 1; dx += 2)
          for (let dy = -1; dy <= 1; dy += 2)
            if (filled(rows, x + dx, y + dy)) {
              corners++;
              if ([dy === 1, dx === 1, dy === -1, dx === -1][r]) front++;
            }
        if (corners < 3) continue;
        if (!strict && front < 2) {
          let kick = false;
          for (let from = 0; from < 4 && !kick; from++) {
            const k = from === r ? null : T_KICK5[from][r];
            kick = k !== null && poseFits(rows, open, x - k[0], y - k[1], from);
          }
          if (!kick) continue;
        }
        let lines = 0;
        for (let i = 0; i < 8; i += 2) {
          const py = y + c[i + 1];
          let m = 0;
          let first = true;
          for (let j = 0; j < 8; j += 2)
            if (y + c[j + 1] === py) {
              if (j < i) first = false;
              m |= 1 << (x + c[j]);
            }
          if (first && (rows[py] | m) === FULL) lines++;
        }
        if (lines >= need) return true;
      }
  }
  return false;
}

// Cheap necessary conditions for a line-clearing T-spin or a ready quad, so
// the spin search only runs on boards that could hold one. A T fills four
// cells, so a row it clears has at most three empties, all reachable; a quad
// needs four rows with a single empty cell each.
function mayBeLive(rows: Rows, strict: boolean): boolean {
  let top = HEIGHT - 1;
  while (top >= 0 && !rows[top]) top--;
  if (top < 0) return false;
  let near = false;
  for (let y = 0; y <= top && !near; y++) {
    const n = WIDTH - BITS[rows[y]];
    near = n >= 1 && n <= 3;
  }
  if (!near) return false;
  // Same test as `quadReady`: rows from a column's height up are 9 full.
  for (let x = 0; x < WIDTH; x++) {
    let h = top + 1;
    while (h > 0 && !(rows[h - 1] & (1 << x))) h--;
    if (h + 3 < HEIGHT) {
      let y = h;
      while (y < h + 4 && BITS[rows[y]] === WIDTH - 1) y++;
      if (y === h + 4) return true;
    }
  }
  const open = openCells(rows, top);
  for (let y = 0; y <= top; y++) {
    const n = WIDTH - BITS[rows[y]];
    if (n < 1 || n > 3 || (~rows[y] & FULL) !== open[y]) continue;
    if (tPoseNear(rows, open, y, strict)) return true;
  }
  return false;
}

/**
 * Dead board, as the roadmap defines it: no T-spin is reachable and no quad is
 * ready now, and neither can be created within `horizon` placements (default
 * 2) of any pieces. "Useful" is a full T-spin clearing 2 or more lines;
 * `strict` counts any T-spin that clears a line, mini singles included.
 *
 * The first placement uses the real movement search, tucks and spins
 * included. Later ones are hard drops. Boards are searched breadth-first, each
 * distinct board once, and the search returns at the first live one. It is
 * meant for making and labelling questions, not for per-frame use; see
 * tests/structures.test.ts for timings.
 */
export function deadBoard(
  board: Board,
  opts: { strict?: boolean; horizon?: number } = {},
): boolean {
  const strict = opts.strict ?? false;
  const horizon = opts.horizon ?? 2;
  const live = (b: Board) =>
    quadReady(b) ||
    findSpins(b, "T").some((s) => strict || (s.spin === "full" && s.lines >= 2));
  if (live(board)) return false;
  const seen = new Set<string>();
  const fresh = (rows: Rows) => {
    let top = HEIGHT;
    while (top > 0 && !rows[top - 1]) top--;
    const key = String.fromCharCode(...rows.subarray(0, top));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  // Boards on the last level are never expanded, so only those that pass the
  // cheap filter need deduping; earlier ones are deduped to keep the frontier
  // small. Returns true when the board is live.
  const visit = (rows: Rows, last: boolean, frontier: Rows[]) => {
    if (last) return mayBeLive(rows, strict) && fresh(rows) && live(fromRows(rows));
    if (!fresh(rows)) return false;
    if (mayBeLive(rows, strict) && live(fromRows(rows))) return true;
    frontier.push(rows);
    return false;
  };
  let frontier: Rows[] = [];
  if (horizon >= 1)
    for (const type of TYPES)
      for (const p of findPlacements(board, type))
        if (visit(toRows(p.after), horizon === 1, frontier)) return false;
  for (let depth = 2; depth <= horizon; depth++) {
    const next: Rows[] = [];
    for (const rows of frontier)
      for (const child of drops(rows))
        if (visit(child, depth === horizon, next)) return false;
    frontier = next;
  }
  return true;
}
