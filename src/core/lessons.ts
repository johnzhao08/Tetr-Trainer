import type { Piece, Tetromino } from "./board";
import { buildPuzzle } from "./lesson";
import type { Lesson, LessonStep, RecognizeRound } from "./lesson";
import type { Goal } from "./puzzle";
import { STRUCTURES } from "./structures";

// Starts come from the engine-verified fixtures in structures.ts: two filler
// pieces are removed from each fixture (found by a placement search) so the
// player puts them back, then spins. `guides` lists the ghost for each piece
// in order. tests/lessons.test.ts proves every puzzle is solvable, mirrors
// included, and every recognition round by cue and chain search.

type Build = { rows: string[]; place: Tetromino[]; guides: Piece[] };

const KAIDAN_A: Build = {
  rows: ["......X...", "XXXXXX....", "XXXXXXX...", "XXXXXXX...", "XXXXXXX...", "XXXXXXXX..", "XXXXXXXXX."],
  place: ["S", "Z"],
  guides: [{ type: "S", x: 7, y: 2, rotation: 1 }, { type: "Z", x: 8, y: 4, rotation: 1 }, { type: "T", x: 7, y: 5, rotation: 2 }],
};
const KAIDAN_B: Build = {
  rows: ["......X...", "....XX....", "XXXXXXX...", "XXXXXXXX..", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX."],
  place: ["Z", "I"],
  guides: [{ type: "Z", x: 8, y: 4, rotation: 1 }, { type: "I", x: 1, y: 4, rotation: 0 }, { type: "T", x: 7, y: 5, rotation: 2 }],
};
const TST_A: Build = {
  rows: ["....X.....", "..........", "XXXX......", "XXXX....X.", "XXXX.XXXXX"],
  place: ["Z", "J"],
  guides: [{ type: "Z", x: 6, y: 1, rotation: 0 }, { type: "J", x: 8, y: 2, rotation: 2 }, { type: "T", x: 4, y: 1, rotation: 1 }],
};
const TST_B: Build = {
  rows: ["....X.....", "..........", "XXXX......", "XXXX..X...", "XXXX.XXXXX"],
  place: ["L", "I"],
  guides: [{ type: "L", x: 8, y: 1, rotation: 0 }, { type: "I", x: 6, y: 1, rotation: 0 }, { type: "T", x: 4, y: 1, rotation: 1 }],
};
const STSD_A: Build = {
  rows: ["X.........", "..........", "X...XXXXX.", "XX.XXXXXXX", "X.XXXXXXXX", "X..XXXXXXX", "X.XXXXXXXX"],
  place: ["J", "I"],
  guides: [{ type: "J", x: 8, y: 5, rotation: 2 }, { type: "I", x: 4, y: 4, rotation: 0 }, { type: "T", x: 2, y: 4, rotation: 2 }, { type: "T", x: 1, y: 3, rotation: 2 }],
};
const STSD_B: Build = {
  rows: ["X.........", ".......XXX", "X.....XXXX", "XX...XXXXX", "X.XXXXXXXX", "X..XXXXXXX", "X.XXXXXXXX"],
  place: ["S", "I"],
  guides: [{ type: "S", x: 4, y: 3, rotation: 0 }, { type: "I", x: 4, y: 4, rotation: 0 }, { type: "T", x: 2, y: 4, rotation: 2 }, { type: "T", x: 1, y: 3, rotation: 2 }],
};
const TRIPLE_DOUBLE_A: Build = {
  rows: ["..X.......", "..........", "XX.....XXX", "XXX.XXXXXX", "XX.XXXXXXX", "XX..XXXXXX", "XX.XXXXXXX"],
  place: ["Z", "I"],
  guides: [{ type: "Z", x: 5, y: 4, rotation: 0 }, { type: "I", x: 7, y: 4, rotation: 0 }, { type: "T", x: 3, y: 4, rotation: 2 }, { type: "T", x: 2, y: 1, rotation: 1 }],
};
const TRIPLE_DOUBLE_B: Build = {
  rows: ["..X.......", "..........", "XX...XXX..", "XXX.XXXXXX", "XX.XXXXXXX", "XX..XXXXXX", "XX.XXXXXXX"],
  place: ["O", "I"],
  guides: [{ type: "O", x: 8, y: 4, rotation: 0 }, { type: "I", x: 5, y: 4, rotation: 0 }, { type: "T", x: 3, y: 4, rotation: 2 }, { type: "T", x: 2, y: 1, rotation: 1 }],
};
const FRACTAL_A: Build = {
  rows: ["....X.....", ".....XXXXX", "....XXXXXX", "....XXXXXX", "XX.XXXXXXX"],
  place: ["L", "O"],
  guides: [{ type: "L", x: 1, y: 2, rotation: 2 }, { type: "O", x: 0, y: 3, rotation: 0 }, { type: "T", x: 3, y: 3, rotation: 2 }, { type: "T", x: 2, y: 1, rotation: 2 }],
};
const FRACTAL_B: Build = {
  rows: ["....X.....", ".....XXXXX", "..X.XXXXXX", "....XXXXXX", ".X.XXXXXXX"],
  place: ["I", "L"],
  guides: [{ type: "I", x: -1, y: 1, rotation: 1 }, { type: "L", x: 1, y: 3, rotation: 3 }, { type: "T", x: 3, y: 3, rotation: 2 }, { type: "T", x: 2, y: 1, rotation: 2 }],
};
const IMPERIAL_CROSS_A: Build = {
  rows: [".X.....XXX", "XXX...XXXX", "XX...XXXXX", "XXX.XXXXXX"],
  place: ["S", "L"],
  guides: [{ type: "S", x: 5, y: 2, rotation: 0 }, { type: "L", x: 1, y: 4, rotation: 2 }, { type: "T", x: 3, y: 3, rotation: 2 }, { type: "T", x: 3, y: 1, rotation: 2 }],
};
const IMPERIAL_CROSS_B: Build = {
  rows: ["X.........", "X......XXX", "X.X...XXXX", "XX...XXXXX", "XXX.XXXXXX"],
  place: ["S", "J"],
  guides: [{ type: "S", x: 5, y: 2, rotation: 0 }, { type: "J", x: 1, y: 3, rotation: 1 }, { type: "T", x: 3, y: 3, rotation: 2 }, { type: "T", x: 3, y: 1, rotation: 2 }],
};

const tsd: Goal = { kind: "tspin", lines: 2 };
const tst: Goal = { kind: "tspin", lines: 3 };

const fixture = (id: string, mirror = false): string[] => {
  const rows = STRUCTURES.find((s) => s.id === id)?.fixture ?? [];
  return mirror ? rows.map((r) => [...r].reverse().join("")) : rows;
};

const round = (
  ids: readonly [string, string, string, string],
  answer: 0 | 1 | 2 | 3,
  note: string,
  mirrored: readonly number[] = [],
): RecognizeRound => ({
  boards: [
    fixture(ids[0], mirrored.includes(0)),
    fixture(ids[1], mirrored.includes(1)),
    fixture(ids[2], mirrored.includes(2)),
    fixture(ids[3], mirrored.includes(3)),
  ],
  answer,
  note,
});

type StructureLesson = {
  id: string;
  structureId: string;
  title: string;
  summary: string;
  why: string;
  whenToUse: string;
  mistakes: string[];
  goal: Goal;
  spins: number;
  /** What the build does, for the step text. */
  build: string;
  a: Build;
  b: Build;
  rounds: RecognizeRound[];
  drillId: string;
  drillTarget: number;
  noMirror?: string;
};

function structureLesson(l: StructureLesson): Lesson {
  const make = (tag: string, b: Build, title: string, guide?: Piece[]) =>
    buildPuzzle({
      id: `lesson-${l.id}-${tag}`,
      title,
      prompt: `${l.build} Then fire the spins.`,
      hint: "The ghost shows where each piece goes.",
      explanation: l.whenToUse,
      rows: b.rows,
      place: b.place,
      spins: l.spins,
      goal: l.goal,
      guide,
      noMirror: l.noMirror !== undefined,
    });
  return {
    id: l.id,
    structureId: l.structureId,
    title: l.title,
    summary: l.summary,
    why: l.why,
    whenToUse: l.whenToUse,
    mistakes: l.mistakes,
    steps: [
      {
        id: "build",
        title: "Build it",
        kind: "guided",
        text: "Follow the ghosts: place the filler pieces, then spin each T.",
        puzzle: make("build", l.a, l.title),
        guides: l.a.guides,
      },
      {
        id: "spot",
        title: "Spot it",
        kind: "recognize",
        text: "Four boards, one holds the structure. Press 1 to 4 or click.",
        rounds: l.rounds,
      },
      {
        id: "practice",
        title: "Build it unaided",
        kind: "practice",
        text: "A new start with no ghosts. The mirror image follows.",
        puzzles: [make("practice", l.b, l.title, l.b.guides)],
      },
      {
        id: "drill",
        title: "Use it in random play",
        kind: "drill",
        text: "Random bags. Use it when the stack allows, never at the cost of holes.",
        drillId: l.drillId,
        target: l.drillTarget,
      },
    ],
  };
}

// One guided step per piece type: the first piece makes the overhang, the
// second is the T that spins under it.
const OVERHANGS: { type: Tetromino; piece: Piece; how: string }[] = [
  { type: "I", piece: { type: "I", x: 1, y: 1, rotation: 0 }, how: "Lay the I flat so its right end hangs over the notch." },
  { type: "J", piece: { type: "J", x: 2, y: 2, rotation: 0 }, how: "Lay the J flat with its tip up on the left; its right foot hangs over the notch." },
  { type: "L", piece: { type: "L", x: 2, y: 2, rotation: 0 }, how: "Lay the L flat with its tip up on the right; the tip stands over the notch." },
  { type: "O", piece: { type: "O", x: 2, y: 2, rotation: 0 }, how: "Set the O so its right column hangs over the notch." },
  { type: "S", piece: { type: "S", x: 6, y: 2, rotation: 0 }, how: "Lay the S flat on the right side; its low left cell hangs over the notch." },
  { type: "Z", piece: { type: "Z", x: 2, y: 2, rotation: 0 }, how: "Lay the Z flat on the left side; its low right cell hangs over the notch." },
  { type: "T", piece: { type: "T", x: 2, y: 2, rotation: 0 }, how: "Even a T can make the overhang: lay it flat, tip up, over the notch." },
];

const overhangs: Lesson = {
  id: "overhangs",
  structureId: "tsd",
  title: "Overhangs from all 7 pieces",
  summary: "Every piece can hang a cell over a notch; learn where, so a T-spin slot never waits on luck.",
  why: "winterNebs: T-spinning comes back to stacking. His drill is to take all 7 pieces and see what overhangs each can build. The more you can build, the less you rely on a lucky T.",
  whenToUse: "Whenever the next piece can leave a one-cell notch under a ledge with three corners filled. Check all seven before you place.",
  mistakes: [
    "Building the overhang over a hole that the spin will not clear.",
    "Stacking the ledge so high the T cannot reach the notch.",
    "Compromising the stack for a T-spin: never do it.",
  ],
  steps: [
    ...OVERHANGS.map(({ type, piece, how }): LessonStep => ({
      id: `piece-${type}`,
      title: `${type} piece`,
      kind: "guided",
      text: how,
      puzzle: buildPuzzle({
        id: `lesson-overhangs-${type}`,
        title: `Overhang with the ${type}`,
        prompt: `${how} Then spin the T into the notch.`,
        hint: "The ghost shows both placements.",
        explanation: "A cell hanging over the notch, with the stack on the far side, makes the T-spin double.",
        rows: ["XXX...XXXX", "XXXX.XXXXX"],
        place: [type],
        spins: 1,
        goal: tsd,
      }),
      guides: [piece, { type: "T", x: 4, y: 1, rotation: 2 }],
    })),
    {
      id: "drill",
      title: "Hunt T-spin doubles",
      kind: "drill",
      text: "Random bags. Build overhangs with whatever comes.",
      drillId: "tsd-hunt",
      target: 0.3,
    },
  ],
};

const lessons: Lesson[] = [
  overhangs,
  structureLesson({
    id: "kaidan",
    structureId: "kaidan",
    title: "Kaidan (donation)",
    summary: "Cover a side well with a stair, spin the cover away, and the well reopens for a quad.",
    why: "four.lol: donations have become essential for stacking efficiency, and Kaidan fixes stack parity. winterNebs: a T-slot cannot form above a side well, so side wells need donations. The coach credits the cover when a reachable T-spin clears it.",
    whenToUse: "A two-step stair beside a well, with a T coming and an I to follow. Kaidan is a subset of the SZ prop.",
    mistakes: [
      "Donating with no I coming, which wastes the reopened well.",
      "Misusing a donation: it can leave a worse stack than plain stacking.",
      "Covering a well when no T-spin can clear the cover: that is a hole.",
    ],
    goal: tsd,
    spins: 1,
    build: "Stair the S and Z beside the well, then spin the T over it.",
    a: KAIDAN_A,
    b: KAIDAN_B,
    rounds: [
      round(["tsd", "kaidan", "tst", "fractal"], 1, "The stair at the edge covers a well at least 3 deep."),
      round(["stsd", "imperial-cross", "kaidan", "triple-double"], 2, "Mirrored: the stair and cover sit at the left edge.", [2]),
    ],
    drillId: "kaidan-run",
    drillTarget: 1,
  }),
  structureLesson({
    id: "stsd",
    structureId: "stsd",
    title: "STSD (stacked T-spin doubles)",
    summary: "Two doubles from a 3x3 space: the first T opens the slot for the second.",
    why: "winterNebs: STSD is very space-efficient but needs T pieces immediately, or it leaves a hole and can leave a dead board. four.lol: build it over Tetris columns or to recover from a misdrop.",
    whenToUse: "A 3-column, 3-row empty space with a roof on one side, and two Ts in the next bag (the J and L pair is the common build).",
    mistakes: [
      "Starting it without T pieces soon, which leaves a hole.",
      "Using it by habit when a single TSD would do.",
      "If you can wait a bag, STSD into a double TST can send more.",
    ],
    goal: { kind: "chain", steps: [tsd, tsd] },
    spins: 2,
    build: "Fill the space with the J and I, then spin two Ts.",
    a: STSD_A,
    b: STSD_B,
    rounds: [
      round(["tsd", "tst", "stsd", "kaidan"], 2, "A shaft offset one column runs two rows deeper than the 3x3 space."),
      round(["triple-double", "stsd", "imperial-cross", "tsd"], 1, "Mirrored: the roof and the offset shaft swap sides.", [1]),
    ],
    drillId: "stsd-run",
    drillTarget: 1,
  }),
  structureLesson({
    id: "tst",
    structureId: "tst",
    title: "TST (T-spin triple)",
    summary: "A tall notch takes the T for three lines when a triple fits the stack better than a double.",
    why: "four.lol: TST setups come from a notch, a two-step stair, S/Z one-step stairs or a converted TSD. A TST sends 7 with B2B but leaves an overhang to clean.",
    whenToUse: "A 3-deep shaft whose middle row is 2 wide, with a roof two rows above, and a T within reach.",
    mistakes: [
      "Leaving an overhang that costs pieces to clean afterwards.",
      "Choosing it when a TSD would keep the stack cleaner.",
    ],
    goal: tst,
    spins: 1,
    build: "Fill the right side with the Z and J, then drive the T down the notch.",
    a: TST_A,
    b: TST_B,
    rounds: [
      round(["stsd", "tst", "kaidan", "tsd"], 1, "The notch is 3 deep with a 2-wide middle row."),
      round(["fractal", "tsd", "imperial-cross", "tst"], 3, "Mirrored: the same notch from the other side.", [3]),
    ],
    drillId: "tst-run",
    drillTarget: 1,
  }),
  structureLesson({
    id: "triple-double",
    structureId: "triple-double",
    title: "Triple Double (C-Spin)",
    summary: "A TSD that opens a TST: the double clears the roof and exposes the triple notch.",
    why: "four.lol: a powerful midgame setup; a Triple Double sends 12 with B2B maintained. The J/L build is called C-Spin, and it leaves a clean field.",
    whenToUse: "A notch or two-step stair with a TSD slot stacked on top, and two Ts coming.",
    mistakes: [
      "Spending the setup when no T arrives in time.",
      "Skipping the check that the first spin really exposes the notch.",
    ],
    goal: { kind: "chain", steps: [tsd, tst] },
    spins: 2,
    build: "Place the Z and I over the notch, then spin the double and the triple.",
    a: TRIPLE_DOUBLE_A,
    b: TRIPLE_DOUBLE_B,
    rounds: [
      round(["tst", "stsd", "triple-double", "tsd"], 2, "A TSD slot sits on top of a notch."),
      round(["kaidan", "triple-double", "fractal", "tsd"], 1, "Mirrored: the stacked slot and notch swap sides.", [1]),
    ],
    drillId: "td-run",
    drillTarget: 1,
  }),
  structureLesson({
    id: "fractal",
    structureId: "fractal",
    title: "Fractal",
    summary: "Two interlocked TSD pockets: when no I is coming, build one TSD on top of another.",
    why: "four.lol: a Fractal is usually built when you do not expect an I soon, most often on top of an existing TSD. Repeated, the LSJZ pattern is the basis of LST stacking.",
    whenToUse: "No I in sight, an existing TSD to build on, and two Ts to follow.",
    mistakes: [
      "Starting it without two T pieces in sight.",
      "Forcing it when the stack has no TSD to build on.",
    ],
    goal: { kind: "chain", steps: [tsd, tsd] },
    spins: 2,
    build: "Set the L and O on the left, then spin two doubles.",
    a: FRACTAL_A,
    b: FRACTAL_B,
    rounds: [
      round(["tsd", "fractal", "kaidan", "tst"], 1, "Two pockets, the second a step above and beside the first."),
      round(["kaidan", "tst", "tsd", "fractal"], 3, "Mirrored: the pockets lean the other way.", [3]),
    ],
    drillId: "fractal-run",
    drillTarget: 1,
  }),
  structureLesson({
    id: "imperial-cross",
    structureId: "imperial-cross",
    title: "Imperial Cross",
    summary: "Two TSDs from a shifted overhang; a fix when a Fractal cannot be built.",
    why: "four.lol: a popular follow-up to the flat-top TKI, used to fix a bad TSD overhang when you lack pieces for a Triple Double. It is slow: not uncommon to rotate five times for the first TSD.",
    whenToUse: "After a TKI, or when a Fractal cannot be built from the pieces you have.",
    mistakes: [
      "Building it when a faster TSD is available.",
      "Missing the rotations: the first spin takes several.",
    ],
    goal: { kind: "chain", steps: [tsd, tsd] },
    spins: 2,
    build: "Place the S and L around the cross, then spin both doubles.",
    a: IMPERIAL_CROSS_A,
    b: IMPERIAL_CROSS_B,
    rounds: [
      round(["tsd", "kaidan", "imperial-cross", "tst"], 2, "Two flat 3-wide gaps stacked, each with a one-cell notch below."),
      round(["stsd", "imperial-cross", "tsd", "kaidan"], 1, "Mirrored: the same cross, flipped.", [1]),
    ],
    drillId: "fractal-run",
    drillTarget: 1,
  }),
];

export const LESSONS: readonly Lesson[] = lessons;

export function findLesson(id: string): Lesson | null {
  return LESSONS.find((l) => l.id === id) ?? null;
}
