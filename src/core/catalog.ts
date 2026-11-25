// Optional modules that sit beside the staged drills. The openers are a side
// track; the T-spin and finesse modules are reference and warm-up material.

export type ModuleInfo = {
  id: string;
  title: string;
  summary: string;
  skills: readonly string[];
  /** Optional card picture: top-down rows (piece letters, X garbage, * target). */
  preview?: readonly string[];
  /** One extra line shown on the card. */
  note?: string;
};

export const SIDE_TRACK: readonly ModuleInfo[] = [
  {
    id: "tki-opener",
    title: "TKI-3 opener",
    summary: "Build the first-bag TSD opener, fixed order first, then random.",
    skills: ["Openers", "T-spin doubles"],
    preview: [".......J..", "L..ZZ.SJJJ", "L***ZZSSOO", "LL*IIIISOO"],
  },
  {
    id: "dt-cannon",
    title: "DT Cannon",
    summary: "A T-spin Double that opens a T-spin Triple, over three bags.",
    skills: ["Openers", "TSD", "TST"],
    preview: ["..OO......", "...L......", "JJ.LXXXXXX", "J..LLSXXXX", "J***TSSZZX", "OO*TTTSJZZ", "OO.IIIIJJJ"],
  },
  {
    id: "tst-entry",
    title: "T-spin triple entry",
    summary: "Use the SRS+ kick to drop a T three rows into a slot.",
    skills: ["T-spin triples", "Kicks"],
    preview: ["....X.....", "..........", "XXXX*XXXXX", "XXXX**XXXX", "XXXX*XXXXX"],
  },
  {
    id: "pc-opener",
    title: "Perfect clear opener",
    summary: "Build the PCO and clear the board in ten pieces.",
    skills: ["Openers", "Perfect clears"],
    note: "All clears send 5 lines in Season 2, so this is low priority.",
    preview: ["LLL*****SS", "LOO****SST", "JOO***ZZTT", "JJJ****ZZT"],
  },
];

export const REFERENCE: readonly ModuleInfo[] = [
  {
    id: "t-spin-basics",
    title: "Basic T-spin setup",
    summary: "Reference: kick puzzles that teach the overhang, then full T-spins.",
    skills: ["T-spins", "Overhangs"],
  },
  {
    id: "finesse-fundamentals",
    title: "Finesse fundamentals",
    summary: "Warm-up: drop each piece on its outline with the fewest presses.",
    skills: ["Finesse", "Inputs"],
    preview: ["....T.....", "...TTT....", "..........", "..........", "......*...", ".....***.."],
  },
];

export const MODULES: readonly ModuleInfo[] = [...SIDE_TRACK, ...REFERENCE];
