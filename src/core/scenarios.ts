import type { Tetromino } from "./board";
import type { Scenario } from "./scenario";

// Drill content. Opener shapes are transcribed from the Hard Drop wiki
// (see docs/LEARNING_RESEARCH.md) and checked in tests/scenarios.test.ts.

export type ScenarioStep = {
  title: string;
  /** Short paragraphs shown beside the board. */
  notes: readonly string[];
  scenario: Scenario;
};

export type ScenarioModule = {
  title: string;
  intro: string;
  steps: readonly ScenarioStep[];
};

const bag = (pieces: string) => [...pieces] as Tetromino[];

export const TKI_GUIDE = [
  ".......J..",
  "L..ZZ.SJJJ",
  "L***ZZSSOO",
  "LL*IIIISOO",
];

// PCO with the I kept in hold (Hard Drop, "Perfect Clear Opener").
export const PCO_GUIDE = [
  "LLL.....SS",
  "LOO....SST",
  "JOO...ZZTT",
  "JJJ....ZZT",
];

// DT Cannon, bag 1 plus the left side of bag 2 ("Double Triple Cannon Setups").
export const DT_GUIDE = [
  "..OO......",
  "..OO......",
  "...L......",
  "JJ.LGGGGGG",
  "J..LLSGGGG",
  "J***TSSZZG",
  "OO*TTTSJZZ",
  "OO.IIIIJJJ",
];

export const PCO_FIXED_QUEUE = bag("IJOLZTS" + "TIJLOSZ");
export const DT_FIXED_QUEUE = bag("OIJTSZL" + "JOILZST" + "TIJLOSZ");

const DIG_TIPS = [
  "Each grey row has one hole. Clear the top garbage row first, then the next hole is exposed.",
  "Avoid covering a hole with a piece that does not clear its row; that adds work.",
] as const;

export const SCENARIO_MODULES: Record<string, ScenarioModule> = {
  "quad-practice": {
    title: "Quad practice",
    intro: "Keep one column open and clear four lines at once.",
    steps: [
      {
        title: "Three quads",
        notes: [
          "Stack flat across nine columns and leave the right-most column empty as a well.",
          "Save every I for the well. Place the others so the surface stays even.",
          "Clear three Quads (four lines with one I). Hold and undo are allowed.",
        ],
        scenario: {
          goals: [
            { kind: "clear", lines: 4 },
            { kind: "clear", lines: 4 },
            { kind: "clear", lines: 4 },
          ],
        },
      },
    ],
  },
  "tki-opener": {
    title: "TKI-3 opener",
    intro: "A first-bag T-spin double: the most common TETR.IO opener.",
    steps: [
      {
        title: "Fixed bag",
        notes: [
          "The first bag is always I, L, Z, O, S, J, T. Fill the outlined cells.",
          "I flat in the middle, L standing on the left, Z on top of the I as the overhang, S and O on the right, J on top.",
          "The purple-outlined cells are the T slot. Finish with a T-spin Double.",
        ],
        scenario: {
          queue: bag("ILZOSJT"),
          guide: TKI_GUIDE,
          goals: [{ kind: "tspin", lines: 2 }],
          pieceLimit: 7,
        },
      },
      {
        title: "Random bag",
        notes: [
          "Now the first bag comes in any order. Use hold when a piece arrives before the one it rests on.",
          "If the T comes early, hold it until the slot is ready.",
          "Make the T-spin Double within the first eight pieces.",
        ],
        scenario: {
          guide: TKI_GUIDE,
          goals: [{ kind: "tspin", lines: 2 }],
          pieceLimit: 8,
        },
      },
    ],
  },
  "pc-opener": {
    title: "Perfect clear opener",
    intro: "Build the PCO with the first bag, then clear all four lines.",
    steps: [
      {
        title: "Fixed bags",
        notes: [
          "Hold the I. Build an L/J/O rectangle on the left and a Z/T/S trapezoid on the right.",
          "Then fill the middle with the second bag and the held I. Ten pieces, four lines, an empty board.",
          "Order this time: I, J, O, L, Z, T, S, then T, I, J, L. One way: T, then the I from the queue, J, and L.",
        ],
        scenario: {
          queue: PCO_FIXED_QUEUE,
          guide: PCO_GUIDE,
          goals: [{ kind: "allClear" }],
          pieceLimit: 10,
        },
      },
      {
        title: "Random bags",
        notes: [
          "Same shape, any order. Keep the I in hold through the first bag if you can.",
          "About 85% of second bags allow a perfect clear with the I held. If yours does not, restart.",
        ],
        scenario: {
          guide: PCO_GUIDE,
          goals: [{ kind: "allClear" }],
          pieceLimit: 10,
        },
      },
    ],
  },
  "tst-entry": {
    title: "T-spin triple entry",
    intro: "The SRS+ kick that drops a T three rows into a vertical slot.",
    steps: [
      {
        title: "Spin into the triple",
        notes: [
          "Move the T right past the overhang, soft drop it under the roof, then slide it left until it hangs over the slot.",
          "Rotate clockwise. The kick drops the T down two rows into the slot. Hard drop for a T-spin Triple.",
          "Hold is off. Restart to retry.",
        ],
        scenario: {
          board: [
            "....X.....",
            "..........",
            "XXXX.XXXXX",
            "XXXX..XXXX",
            "XXXX.XXXXX",
          ],
          queue: ["T"],
          goals: [{ kind: "tspin", lines: 3 }],
          pieceLimit: 1,
          allowHold: false,
        },
      },
    ],
  },
  "dt-cannon": {
    title: "DT Cannon",
    intro: "A T-spin Double that opens a T-spin Triple: ten lines of attack.",
    steps: [
      {
        title: "Fixed bags",
        notes: [
          "Bag 1 builds the base; bag 2 adds the left J and the O roof. Fill the grey cells however you like.",
          "First T: spin into the purple slot for a T-spin Double.",
          "Second T: the double leaves a vertical slot under the O roof. Spin in for a T-spin Triple.",
        ],
        scenario: {
          queue: DT_FIXED_QUEUE,
          guide: DT_GUIDE,
          goals: [
            { kind: "tspin", lines: 2 },
            { kind: "tspin", lines: 3 },
          ],
          pieceLimit: 21,
        },
      },
      {
        title: "Random bags",
        notes: [
          "Same build with random bags. Use hold to keep the order workable.",
          "Finish the double and the triple within three bags.",
        ],
        scenario: {
          guide: DT_GUIDE,
          goals: [
            { kind: "tspin", lines: 2 },
            { kind: "tspin", lines: 3 },
          ],
          pieceLimit: 21,
        },
      },
    ],
  },
  "cheese-basics": {
    title: "Cheese basics",
    intro: "Dig through six garbage lines. Holes mostly line up.",
    steps: [
      {
        title: "Six lines",
        notes: [
          ...DIG_TIPS,
          "When several holes share a column, one vertical I clears them together.",
          "Hold and undo are allowed. There is no clock pressure here.",
        ],
        scenario: {
          garbage: { rows: 6, total: 6, messiness: 0.3 },
          goals: [{ kind: "dig", lines: 6 }],
        },
      },
    ],
  },
  "cheese-10": {
    title: "Cheese race 10L",
    intro: "Ten messy garbage lines, as fast and clean as you can.",
    steps: [
      {
        title: "10 lines",
        notes: [
          ...DIG_TIPS,
          "Every row's hole moves. Read two or three rows ahead before placing.",
          "No undo. Track your time and pieces per garbage line (lower is better; about 2.5 is strong).",
        ],
        scenario: {
          garbage: { rows: 10, total: 10, messiness: 1 },
          goals: [{ kind: "dig", lines: 10 }],
          allowUndo: false,
        },
      },
    ],
  },
  "cheese-18": {
    title: "Cheese race 18L",
    intro: "Eighteen messy lines with ten always on screen.",
    steps: [
      {
        title: "18 lines",
        notes: [
          ...DIG_TIPS,
          "New garbage rises from the bottom as you clear, so the board never empties until the end.",
          "No undo. Keep the stack low: rising garbage can top you out.",
        ],
        scenario: {
          garbage: { rows: 10, total: 18, messiness: 1 },
          goals: [{ kind: "dig", lines: 18 }],
          allowUndo: false,
        },
      },
    ],
  },
};
