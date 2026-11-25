import { emptyBoard, HEIGHT, TYPES, WIDTH } from "./board";
import type { Board } from "./board";
import { findTsdSlots, quadReady } from "./coach";
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
 * True when `template` (top-down, `X` filled, `.` empty, `?` any) matches the
 * board anywhere, in either orientation.
 */
function matches(board: Board, template: string[]): boolean {
  const top = Math.max(...heights(board));
  const mirrored = template.map((r) => [...r].reverse().join(""));
  for (const tpl of [template, mirrored]) {
    const h = tpl.length;
    const w = tpl[0].length;
    for (let y0 = 0; y0 <= Math.min(top, HEIGHT - h); y0++)
      for (let x0 = 0; x0 <= WIDTH - w; x0++) {
        let ok = true;
        for (let i = 0; i < h && ok; i++)
          for (let j = 0; j < w && ok; j++) {
            const c = tpl[i][j];
            if (c === "?") continue;
            ok = (board[y0 + h - 1 - i][x0 + j] !== null) === (c === "X");
          }
        if (ok) return true;
      }
  }
  return false;
}

/** A 3-deep notch whose middle row is two wide: X.XX / X..X / X.XX. */
const NOTCH = ["X.XX", "X..X", "X.XX"];
const TST_CUE = ["?X??", "?.??", ...NOTCH];
const TD_CUE = [
  "..X...",
  "....XX",
  "XX...X",
  "XXX.XX",
  "XX.XXX",
  "XX..XX",
  "XX.XXX",
];
const STSD_CUE = ["...X?", "X...X", "XX.XX", "X.XXX", "X..XX"];
const FRACTAL_CUE = ["XX..X?", "XX...X", "XXX.XX", "X...XX", "XX.XXX"];
const IMPERIAL_CUE = ["XXX???", "XX...X", "XXX.XX", "XX...X", "XXX.XX"];

/**
 * A stair head at an edge column that sits over a pocket at least 3 deep: the
 * edge column is covered, two steps of exactly one row lead down from it, and
 * the floor cells beneath the cover are empty with a filled wall beside them.
 */
export function kaidanCue(board: Board): boolean {
  const h = heights(board);
  for (const [w, d] of [
    [WIDTH - 1, -1],
    [0, 1],
  ]) {
    if (h[w] < 4 || h[w + d] !== h[w] - 1 || h[w + 2 * d] !== h[w] - 2)
      continue;
    let pocket = true;
    for (let y = 0; y < 3; y++)
      if (board[y][w] !== null || board[y][w + d] === null) pocket = false;
    if (pocket) return true;
  }
  return false;
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
    fixture: ["...X......", "XXX...XXXX", "XXXX.XXXXX"],
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
    fixture: [
      "....X.....",
      "..........",
      "XXXX.XXXXX",
      "XXXX..XXXX",
      "XXXX.XXXXX",
    ],
    chain: [{ spin: "full", lines: 3 }],
    sends: "7 with B2B active and no combo.",
    use: "From a notch, a two-step stair, or a converted TSD, when a triple fits the stack better than a double.",
    mistakes: [
      "Leaving an overhang that needs cleaning afterwards.",
      "Choosing it when a TSD would keep the stack cleaner.",
    ],
    cue: (b) => matches(b, TST_CUE),
    cueText:
      "A 3-deep shaft whose middle row is 2 wide, with a roof two rows above.",
  },
  {
    id: "stsd",
    name: "STSD",
    aliases: ["Stacked T-spin Double"],
    family: "combo-spin",
    fixture: [
      "X.........",
      "...XXXXXXX",
      "X...XXXXXX",
      "XX.XXXXXXX",
      "X.XXXXXXXX",
      "X..XXXXXXX",
      "X.XXXXXXXX",
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
    cue: (b) => matches(b, STSD_CUE),
    cueText:
      "A 3x3 empty space with a roof on one side and a 1-wide shaft offset one column going two rows deeper.",
  },
  {
    id: "triple-double",
    name: "Triple Double",
    aliases: ["TD", "C-Spin"],
    family: "combo-spin",
    fixture: [
      "..X.......",
      "....XXXXXX",
      "XX...XXXXX",
      "XXX.XXXXXX",
      "XX.XXXXXXX",
      "XX..XXXXXX",
      "XX.XXXXXXX",
    ],
    chain: [
      { spin: "full", lines: 2 },
      { spin: "full", lines: 3 },
    ],
    sends: "5 then 7 with B2B active.",
    use: "A midgame setup from a notch or two-step stair; the J/L build is called C-Spin.",
    mistakes: ["Spending the setup when no T arrives in time."],
    cue: (b) => matches(b, TD_CUE),
    cueText:
      "A notch (3-deep shaft, middle row 2 wide) with a TSD slot stacked on top of it.",
  },
  {
    id: "fractal",
    name: "Fractal",
    family: "combo-spin",
    fixture: [
      "XX..X.....",
      "XX...XXXXX",
      "XXX.XXXXXX",
      "X...XXXXXX",
      "XX.XXXXXXX",
    ],
    chain: [
      { spin: "full", lines: 2 },
      { spin: "full", lines: 2 },
    ],
    sends: "5 then 5 with B2B active.",
    use: "When no I is coming, usually built on an existing TSD.",
    mistakes: ["Starting it without two T pieces in sight."],
    cue: (b) => matches(b, FRACTAL_CUE),
    cueText:
      "Two interlocked TSD pockets, one a step above and beside the other.",
  },
  {
    id: "imperial-cross",
    name: "Imperial Cross",
    family: "combo-spin",
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
    use: "After a TKI, or to fix a bad overhang when a Fractal cannot be built. Slow.",
    mistakes: ["Building it when a faster TSD is available."],
    cue: (b) => matches(b, IMPERIAL_CUE),
    cueText:
      "Two flat 3-wide gaps stacked with single-cell notches below each.",
  },
  {
    id: "kaidan",
    name: "Kaidan",
    aliases: ["stairs donation"],
    family: "donation",
    fixture: [
      "......X...",
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

/**
 * No useful T-spin is reachable now or after any one placement of any piece,
 * and no quad is ready. "Useful" is a full T-spin clearing 2 or more lines;
 * `strict` counts any T-spin that clears a line, mini singles included.
 */
export function deadBoard(
  board: Board,
  opts: { strict?: boolean } = {},
): boolean {
  const live = (b: Board) =>
    findSpins(b, "T").some(
      (s) => opts.strict || (s.spin === "full" && s.lines >= 2),
    );
  if (quadReady(board) || live(board)) return false;
  for (const type of TYPES)
    for (const p of findPlacements(board, type))
      if (live(p.after)) return false;
  return true;
}
