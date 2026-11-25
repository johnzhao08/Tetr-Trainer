import type { Goal, PuzzleDef } from "./puzzle";

// Starter puzzles: the sourced structure fixtures from docs/ROADMAP.md (each
// is a four.lol diagram; the engine only verifies it). Each queue is just the T pieces its answer needs; the game
// then carries on with random bags, and one spare piece is allowed.
const tsd: Goal = { kind: "tspin", lines: 2 };
const tst: Goal = { kind: "tspin", lines: 3 };

function structure(
  def: Omit<PuzzleDef, "position" | "pieceLimit"> & {
    rows: string[];
    ts: number;
    themes: string[];
  },
): PuzzleDef {
  const { rows, ts, ...rest } = def;
  return {
    ...rest,
    position: { rows, queue: Array(ts).fill("T") },
    pieceLimit: ts + 1,
  };
}

export const PUZZLES: readonly PuzzleDef[] = [
  structure({
    id: "tsd",
    themes: ["Basics"],
    title: "T-spin Double",
    prompt: "Clear two lines with a T-spin.",
    hint: "Slide the T into the overhang notch, then rotate it into the slot.",
    explanation:
      "The TSD is the default attack: a T pointing down into a one-cell notch under an overhang, three corners filled. Build it whenever a slot appears.",
    rows: ["XXXX......", "XXX...XXXX", "XXXX.XXXXX"],
    ts: 1,
    goal: tsd,
    guide: [{ type: "T", x: 4, y: 1, rotation: 2 }],
  }),
  structure({
    id: "tst",
    themes: ["Basics"],
    title: "T-spin Triple",
    prompt: "Clear three lines with one T-spin.",
    hint: "The T enters the tall notch sideways and spins in.",
    explanation:
      "A TST comes from a notch, a two-step stair, S/Z one-step stairs, or a converted TSD. It leaves an overhang to clean up, so a TSD is sometimes the better call.",
    rows: ["XXXX......", "XXX.......", "XXX.XXXXXX", "XXX..XXXXX", "XXX.XXXXXX"],
    ts: 1,
    goal: tst,
    guide: [{ type: "T", x: 3, y: 1, rotation: 1 }],
  }),
  structure({
    id: "stsd",
    title: "STSD",
    prompt: "Two T-spin doubles in a row.",
    hint: "The first T fills the upper slot. The second finds a new slot once the lines clear.",
    explanation:
      "Stacked TSDs: build over Tetris columns or recover from a misdrop. You need T pieces soon or it leaves a hole, and it is often misused.",
    themes: ["Attack"],
    rows: ["..XXXXXXXX", "...XXXXXXX", "XX.XXXXXXX", "X..XXXXXXX", "X..XXXXXXX"],
    ts: 2,
    goal: { kind: "chain", steps: [tsd, tsd] },
    guide: [{ type: "T", x: 2, y: 1, rotation: 3 }],
  }),
  structure({
    id: "fractal",
    title: "Fractal",
    prompt: "Spin two T-spin doubles, one after the other.",
    hint: "Both Ts go in from the left. The second slot opens after the first clear.",
    explanation:
      "Use a Fractal when no I piece is coming. It is usually built on an existing TSD and ends with two doubles.",
    themes: ["Attack"],
    rows: ["XXX.......", "XX...XXXXX", "XXX.XXXXXX", "XX...XXXXX", "XXX.XXXXXX"],
    ts: 2,
    goal: { kind: "chain", steps: [tsd, tsd] },
    guide: [{ type: "T", x: 3, y: 3, rotation: 2 }],
  }),
  structure({
    id: "imperial-cross",
    title: "Imperial Cross",
    prompt: "Spin two T-spin doubles to clear the cross.",
    hint: "Spin the first T into the upper notch from the left.",
    explanation:
      "The Imperial Cross fixes a bad overhang after a TKI when a Fractal cannot be built. It works, but it is slow.",
    themes: ["Cleanup"],
    rows: ["XXXX..XXXX", "XXX...XXXX", "XXX.XXXXXX", "XX...XXXXX", "XXX.XXXXXX"],
    ts: 2,
    goal: { kind: "chain", steps: [tsd, tsd] },
    guide: [{ type: "T", x: 3, y: 1, rotation: 3 }],
  }),
  structure({
    id: "triple-double",
    title: "Triple Double",
    prompt: "A T-spin triple, then a T-spin double.",
    hint: "Spin the triple down the notch first. The double slot is waiting above it.",
    explanation:
      "A midgame setup from a notch or a two-step stair: a triple, then a double, 12 lines with B2B. Building it with J and L pieces is called a C-Spin.",
    themes: ["Attack"],
    rows: [
      "XXXX..XXXX", "XXX...XXXX", "XXX.XXXXXX", "XXX..XXXXX", "XXX.XXXXXX",
      "XXXX.XXXXX",
    ],
    ts: 2,
    goal: { kind: "chain", steps: [tst, tsd] },
    guide: [{ type: "T", x: 3, y: 2, rotation: 1 }],
  }),
];

export function findPuzzle(id: string): PuzzleDef | null {
  return PUZZLES.find((p) => p.id === id) ?? null;
}

/** Puzzles grouped by their first theme, in list order. */
export function puzzleGroups(): { theme: string; puzzles: PuzzleDef[] }[] {
  const groups = new Map<string, PuzzleDef[]>();
  for (const p of PUZZLES) {
    const theme = p.themes[0];
    groups.set(theme, [...(groups.get(theme) ?? []), p]);
  }
  return [...groups].map(([theme, puzzles]) => ({ theme, puzzles }));
}
