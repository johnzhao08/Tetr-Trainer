import type { Piece, Tetromino } from "./board";
import { buildPuzzle } from "./lesson";
import type { Lesson, LessonStep, RecognizeRound } from "./lesson";
import type { Goal } from "./puzzle";
import { KAIDAN_PARITY, STRUCTURES } from "./structures";

// Every start is a four.lol diagram: the sourced board with the pieces its
// build pages show taken off, so the player puts them back (the page and
// diagram are cited on each build). Where no four.lol build diagram reaches
// the sourced board, the start is the ready board itself and only the spins
// remain. The engine never picks a shape; tests/lessons.test.ts only checks
// that each build ends in its structure and that every puzzle is solvable,
// mirrors included. `guides` lists the ghost for each piece in order.

type Build = { rows: string[]; place: Tetromino[]; guides: Piece[] };

const fixtureRows = (id: string): string[] =>
  STRUCTURES.find((s) => s.id === id)?.fixture ?? [];

// Kaidan, https://four.lol/methods/kaidan, diagram 11 ("Fixing Parity"): the
// completed Kaidan, which the engine verifies as a full TSD with the well
// quad-ready after it. No page diagram builds it piece by piece, so both
// starts are the ready board and the ghosts show the spin and the quad. The
// stair fixture (diagram 0) is what the recognition rounds use.
const KAIDAN: Build = {
  rows: KAIDAN_PARITY,
  place: [],
  guides: [{ type: "T", x: 4, y: 5, rotation: 2 }, { type: "I", x: 1, y: 1, rotation: 1 }],
};
// Each start is the source diagram with the guided pieces taken off and
// nothing else changed; tests/sourcedBoards.test.ts keeps every diagram, piece
// letters included, and checks the start and the guides against it.
// TST, https://four.lol/methods/tspin-triple: the overhang piece of diagram 1
// (an L) for A, diagram 2 (a J) for B.
const TST_A: Build = {
  rows: ["X.........", "X.........", "XXX.XXXXXX", "XXX..XXXXX", "XXX.XXXXXX"],
  place: ["L"],
  guides: [{ type: "L", x: 2, y: 4, rotation: 2 }, { type: "T", x: 3, y: 1, rotation: 1 }],
};
const TST_B: Build = {
  rows: ["..........", "..........", "XX........", "XXX.XXXXXX", "XXX..XXXXX", "XXX.XXXXXX"],
  place: ["J"],
  guides: [{ type: "J", x: 2, y: 4, rotation: 0 }, { type: "T", x: 3, y: 1, rotation: 1 }],
};
// STSD, https://four.lol/methods/stsd: A is diagram 4 (a J, then the I
// overhang). Diagram 3 (a J, then a Z overhang) does not reach two doubles in
// the engine (its second spin clears one line), so B starts from the ready
// board of diagram 0 and only the spins remain.
const STSD_A: Build = {
  rows: ["..........", "...XXXXXXX", "...XXXXXXX", "...XXXXXXX", "...XXXXXXX"],
  place: ["J", "I"],
  guides: [{ type: "J", x: 0, y: 1, rotation: 1 }, { type: "I", x: 3, y: 3, rotation: 0 }, { type: "T", x: 2, y: 1, rotation: 3 }, { type: "T", x: 1, y: 1, rotation: 2 }],
};
const STSD_B: Build = {
  rows: fixtureRows("stsd"),
  place: [],
  guides: [{ type: "T", x: 2, y: 1, rotation: 3 }, { type: "T", x: 1, y: 1, rotation: 2 }],
};
// Triple Double, https://four.lol/methods/triple-double: the page's only build
// is the C-Spin (diagram 3, a J and an L), but with those pieces put back the
// engine finds a triple and then only a single: the diagram is a build stage
// with the right side of the top rows still empty. Both starts are the ready
// board of diagram 0, so only the spins remain.
const TRIPLE_DOUBLE: Build = {
  rows: fixtureRows("triple-double"),
  place: [],
  guides: [{ type: "T", x: 3, y: 2, rotation: 1 }, { type: "T", x: 4, y: 1, rotation: 2 }],
};
// Fractal and Imperial Cross, https://four.lol/methods/fractal and
// /methods/imperial-cross, diagram 0: no build diagram on either page ends in
// the headline board, so both start from the ready board.
const FRACTAL: Build = {
  rows: fixtureRows("fractal"),
  place: [],
  guides: [{ type: "T", x: 3, y: 3, rotation: 2 }, { type: "T", x: 3, y: 1, rotation: 2 }],
};
const IMPERIAL_CROSS: Build = {
  rows: fixtureRows("imperial-cross"),
  place: [],
  guides: [{ type: "T", x: 3, y: 1, rotation: 3 }, { type: "T", x: 4, y: 1, rotation: 2 }],
};

const tsd: Goal = { kind: "tspin", lines: 2 };
const tst: Goal = { kind: "tspin", lines: 3 };

const fixture = (id: string, mirror = false): string[] => {
  const rows = fixtureRows(id);
  return mirror ? rows.map((r) => [...r].reverse().join("")) : rows;
};

const round = (
  ids: readonly [string, string, string, string],
  answer: 0 | 1 | 2 | 3,
  note: string,
  mirrored: readonly number[] = [],
): RecognizeRound => ({
  boards: [0, 1, 2, 3].map((i) => fixture(ids[i], mirrored.includes(i))) as unknown as RecognizeRound["boards"],
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
  /** The one prompt for the build: names no piece or side (the queue and its mirror vary) and ends at the lesson's goal. */
  build: string;
  /** Pieces after the spins (the I that takes the reopened well). */
  after?: Tetromino[];
  a: Build;
  b: Build;
  rounds: RecognizeRound[];
  drillId: string;
  drillTarget: number;
  noMirror?: string;
};

function structureLesson(l: StructureLesson): Lesson {
  const make = (tag: string, b: Build, title: string, guided: boolean) =>
    buildPuzzle({
      id: `lesson-${l.id}-${tag}`,
      title,
      prompt: l.build,
      hint: guided ? "Hold is off. The ghost shows where each piece goes, in order." : undefined,
      explanation: l.whenToUse,
      rows: b.rows,
      place: b.place,
      spins: l.spins,
      after: l.after,
      goal: l.goal,
      guide: guided ? undefined : b.guides,
      allowHold: guided ? false : undefined,
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
        text: l.a.place.length ? "Follow the ghosts: place the pieces, then spin each T." : "Follow the ghosts: spin each T.",
        puzzle: make("build", l.a, l.title, true),
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
        puzzles: [make("practice", l.b, l.title, false)],
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

// One guided step per piece with a sourced diagram: the first piece makes the
// overhang, the second is the T that spins under it. Each board is the source
// diagram with the overhang piece taken off (tests/sourcedBoards.test.ts keeps
// the diagrams). The O and the T have no diagram of an overhang, so they are
// left out.
//  I: https://four.lol/methods/stsd, diagram 4 (the J below it is drawn solid).
//  J: https://winternebs.github.io/TETRIS-FAQ/tspin, "Building overhangs",
//     third image (imgur B2a40do), the blue piece.
//  L: https://four.lol/methods/tspin-triple, diagram 1 (a triple, not a double).
//  S: the same winterNebs section, second image (imgur lZrASYB), the green piece.
//  Z: https://four.lol/methods/stsd, diagram 3 (the J below it is drawn solid).
type Overhang = { type: Tetromino; rows: string[]; piece: Piece; t: Piece; goal: Goal; how: string };
const OVERHANGS: Overhang[] = [
  {
    type: "I",
    rows: ["..........", "...XXXXXXX", "XX.XXXXXXX", "X..XXXXXXX", "X..XXXXXXX"],
    piece: { type: "I", x: 3, y: 3, rotation: 0 },
    t: { type: "T", x: 2, y: 1, rotation: 3 },
    goal: tsd,
    how: "Lay the I flat on the stack so its left end hangs over the gap.",
  },
  {
    type: "J",
    rows: ["..........", "..........", "......XX..", "......XX..", "XXX...XXXX", "XXXX.XXXXX"],
    piece: { type: "J", x: 5, y: 3, rotation: 1 },
    t: { type: "T", x: 4, y: 1, rotation: 2 },
    goal: tsd,
    how: "Stand the J in the gap with its hook resting on the block, so its foot hangs over the notch.",
  },
  {
    type: "L",
    rows: TST_A.rows,
    piece: { type: "L", x: 2, y: 4, rotation: 2 },
    t: { type: "T", x: 3, y: 1, rotation: 1 },
    goal: tst,
    how: "Hang the L from the left wall, its foot on the stack and its flat top over the shaft.",
  },
  {
    type: "S",
    rows: ["..........", "..........", "XXX....XXX", "XXXX.XXXXX"],
    piece: { type: "S", x: 5, y: 2, rotation: 1 },
    t: { type: "T", x: 4, y: 1, rotation: 2 },
    goal: tsd,
    how: "Stand the S in the gap on the right; its upper half hangs over the notch.",
  },
  {
    type: "Z",
    rows: ["..........", "..........", "XX.XXXXXXX", "X..XXXXXXX", "X..XXXXXXX"],
    piece: { type: "Z", x: 3, y: 3, rotation: 0 },
    t: { type: "T", x: 2, y: 1, rotation: 3 },
    goal: tsd,
    how: "Lay the Z flat so its lower pair rests on the stack and its upper left cell hangs over the gap.",
  },
];

const overhangs: Lesson = {
  id: "overhangs",
  structureId: "tsd",
  title: "Overhangs from different pieces",
  summary: "Most pieces can hang a cell over a notch; learn where, so a T-spin slot never waits on luck.",
  why: "winterNebs: T-spinning comes back to stacking. His drill is to take each piece and see what overhangs it can build. The more you can build, the less you rely on a lucky T.",
  whenToUse: "Whenever the next piece can leave a notch under a ledge with three corners filled. Check each piece before you place.",
  mistakes: [
    "Building the overhang over a hole that the spin will not clear.",
    "Stacking the ledge so high the T cannot reach the notch.",
    "Compromising the stack for a T-spin: never do it.",
  ],
  steps: [
    ...OVERHANGS.map(({ type, rows, piece, t, goal, how }): LessonStep => ({
      id: `piece-${type}`,
      title: `${type} piece`,
      kind: "guided",
      text: how,
      puzzle: buildPuzzle({
        id: `lesson-overhangs-${type}`,
        title: `Overhang with the ${type}`,
        prompt: `${how} Then spin the T into the notch.`,
        hint: "Hold is off. The ghost shows both placements, in order.",
        explanation: "A cell hanging over the notch, with the stack on the far side, makes the T-spin.",
        rows,
        place: [type],
        spins: 1,
        goal,
        allowHold: false,
      }),
      guides: [piece, t],
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
    goal: { kind: "chain", steps: [tsd, { kind: "clear", piece: "I", lines: 4 }] },
    spins: 1,
    build: "Spin a double over the stair, then clear a quad down the reopened well.",
    after: ["I"],
    a: KAIDAN,
    b: KAIDAN,
    rounds: [
      round(["tsd", "kaidan", "tst", "fractal"], 1, "The stair at the edge covers a well at least 2 deep."),
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
    whenToUse: "A 3-column, 3-row empty space with a roof on one side, and two Ts available across hold and preview or across a bag boundary (the J and L pair is the common build).",
    mistakes: [
      "Starting it without T pieces soon, which leaves a hole.",
      "Using it by habit when a single TSD would do.",
      "If you can wait a bag, STSD into a double TST can send more.",
    ],
    goal: { kind: "chain", steps: [tsd, tsd] },
    spins: 2,
    build: "Fill the 3x3 space if it is open, then spin two doubles.",
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
    build: "Fill beside the notch with the pieces shown, then spin a triple down it.",
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
    summary: "A TST that opens a TSD: the triple clears the notch and leaves the double slot on top.",
    why: "four.lol: a powerful midgame setup; a Triple Double sends 12 with B2B maintained. The J/L build is called C-Spin, and it leaves a clean field.",
    whenToUse: "A notch or two-step stair with a TSD slot stacked on top, and two Ts coming.",
    mistakes: [
      "Spending the setup when no T arrives in time.",
      "Skipping the check that the triple leaves the double slot intact.",
    ],
    goal: { kind: "chain", steps: [tst, tsd] },
    spins: 2,
    build: "Spin the triple down the notch, then the double above it.",
    a: TRIPLE_DOUBLE,
    b: TRIPLE_DOUBLE,
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
    build: "Spin two doubles, the upper pocket first, then the lower.",
    a: FRACTAL,
    b: FRACTAL,
    rounds: [
      round(["tsd", "fractal", "kaidan", "tst"], 1, "Two TSD pockets stacked one above the other, a one-cell notch under each."),
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
    build: "Spin two doubles, the upper gap first, then the lower.",
    a: IMPERIAL_CROSS,
    b: IMPERIAL_CROSS,
    rounds: [
      round(["tsd", "kaidan", "imperial-cross", "tst"], 2, "Two flat 3-wide gaps stacked, each with a one-cell notch below."),
      round(["stsd", "imperial-cross", "tsd", "kaidan"], 1, "Mirrored: the same cross, flipped.", [1]),
    ],
    drillId: "imperial-run",
    drillTarget: 1,
  }),
];

export const LESSONS: readonly Lesson[] = lessons;

export function findLesson(id: string): Lesson | null {
  return LESSONS.find((l) => l.id === id) ?? null;
}

/**
 * Lesson ids shown under each curriculum stage: T-spin doubles, the B2B
 * economy (combo spins keep B2B), and efficient attack at pressure.
 */
export const STAGE_LESSONS: Readonly<Record<string, readonly string[]>> = {
  tsd: ["overhangs", "kaidan", "tst"],
  b2b: ["stsd", "triple-double"],
  pressure: ["fractal", "imperial-cross"],
};
