// Optional modules that sit beside the staged drills. The openers are a side
// track; the T-spin and finesse modules are reference and warm-up material.

import { DT_GUIDE, TKI_GUIDE } from "./scenarios";

// Previews of the Hard Drop opener guides are the guides themselves (grey
// "G" cells drawn as garbage), never a re-typed copy.
const fromGuide = (guide: readonly string[]) => guide.map((row) => row.replaceAll("G", "X"));

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
    preview: fromGuide(TKI_GUIDE),
  },
  {
    id: "dt-cannon",
    title: "DT Cannon",
    summary: "A T-spin Double that opens a T-spin Triple, over three bags.",
    skills: ["Openers", "TSD", "TST"],
    preview: fromGuide(DT_GUIDE),
  },
  {
    id: "tst-entry",
    title: "T-spin triple entry",
    summary: "Use the SRS+ kick to drop a T three rows into a slot.",
    skills: ["T-spin triples", "Kicks"],
    preview: ["XXXX......", "XXX.......", "XXX*XXXXXX", "XXX**XXXXX", "XXX*XXXXXX"],
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
