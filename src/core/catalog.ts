// The learning catalog: every module the home screen lists, grouped by level.
// "ready" modules are playable; "planned" modules need a solver or evaluator
// that does not exist yet, so the app only describes what they will do.

export type Level = "beginner" | "intermediate" | "advanced";

export const LEVELS: readonly { id: Level; title: string; blurb: string }[] = [
  {
    id: "beginner",
    title: "Beginner",
    blurb: "Clean placements, your first T-spins, and digging basics.",
  },
  {
    id: "intermediate",
    title: "Intermediate",
    blurb: "Standard openers, efficient inputs, and messy garbage.",
  },
  {
    id: "advanced",
    title: "Advanced",
    blurb: "Multi-spin openers, timed races, and solver-backed coaching.",
  },
];

export type ModuleInfo = {
  id: string;
  title: string;
  level: Level;
  summary: string;
  skills: readonly string[];
  /** Optional card picture: top-down rows (piece letters, X garbage, * target). */
  preview?: readonly string[];
} & (
  | { status: "ready" }
  | {
      status: "planned";
      /** The engine this module is waiting on. */
      needs: string;
      /** What the finished module will do, one point per line. */
      willDo: readonly string[];
      /** Ready modules that practise the same skill in the meantime. */
      practiseWith: readonly string[];
      /** Prior work this module would build on. */
      research?: readonly string[];
    }
);

export const MODULES: readonly ModuleInfo[] = [
  {
    id: "t-spin-basics",
    title: "Basic T-spin setup",
    level: "beginner",
    status: "ready",
    summary: "Learn the overhang, then make full T-spins on your own.",
    skills: ["T-spins", "Overhangs"],
  },
  {
    id: "finesse-fundamentals",
    title: "Finesse fundamentals",
    level: "beginner",
    status: "ready",
    summary: "Drop each piece on its outline with the fewest presses, with hints.",
    skills: ["Finesse", "Inputs"],
    preview: ["....T.....", "...TTT....", "..........", "..........", "......*...", ".....***.."],
  },
  {
    id: "quad-practice",
    title: "Quad practice",
    level: "beginner",
    status: "ready",
    summary: "Stack flat with a well on the right and clear three Quads.",
    skills: ["Stacking", "Quads"],
    preview: ["..........", "I........*", "IZZ.LL...*", "I.ZZOLSSO*", "IJJJOLSSO*"]
  },
  {
    id: "stacking-coach",
    title: "Stacking coach",
    level: "beginner",
    status: "planned",
    summary: "Shows where each piece should go and why, as you play.",
    skills: ["Stacking", "Placement"],
    preview: ["..........", "....**....", ".....*....", "L.....SS..", "LLJ..SSOOI", "IJJJZZTOOI"],
    needs: "A board evaluator and move search",
    willDo: [
      "Rate every placement you make against the best few alternatives.",
      "Explain the difference in plain terms: holes, bumpiness, open T slots.",
      "Highlight the suggested placement for the current piece on request.",
    ],
    practiseWith: ["quad-practice", "t-spin-basics"],
  },
  {
    id: "finesse-test",
    title: "Finesse test",
    level: "intermediate",
    status: "ready",
    summary: "Forty targets, no hints. Every wasted press is counted.",
    skills: ["Finesse", "Speed"],
    preview: ["....ZZ....", ".....ZZ...", "..........", "..........", "*.........", "**........", ".*........"],
  },
  {
    id: "tki-opener",
    title: "TKI-3 opener",
    level: "intermediate",
    status: "ready",
    summary: "Build the first-bag TSD opener, fixed order first, then random.",
    skills: ["Openers", "T-spin doubles"],
    preview: [".......J..", "L..ZZ.SJJJ", "L***ZZSSOO", "LL*IIIISOO"],
  },
  {
    id: "pc-opener",
    title: "Perfect clear opener",
    level: "intermediate",
    status: "ready",
    summary: "Build the PCO and clear the board in ten pieces.",
    skills: ["Openers", "Perfect clears"],
    preview: ["LLL*****SS", "LOO****SST", "JOO***ZZTT", "JJJ****ZZT"],
  },
  {
    id: "tst-entry",
    title: "T-spin triple entry",
    level: "intermediate",
    status: "ready",
    summary: "Use the SRS+ kick to drop a T three rows into a slot.",
    skills: ["T-spin triples", "Kicks"],
    preview: ["....X.....", "..........", "XXXX*XXXXX", "XXXX**XXXX", "XXXX*XXXXX"],
  },
  {
    id: "pc-finder",
    title: "Perfect clear finder",
    level: "intermediate",
    status: "planned",
    summary: "Lists every perfect clear reachable from your board and queue.",
    skills: ["Perfect clears", "Second-bag planning"],
    preview: ["LLL*****SS", "LOO****SST", "JOO***ZZTT", "JJJ****ZZT"],
    needs: "A perfect-clear solver (exhaustive search over the queue)",
    willDo: [
      "Read the current board, hold, and visible queue.",
      "Search all placements, including spins and hold swaps, for a 4-line perfect clear.",
      "Show each solution step by step and grade the one you chose.",
      "Report the odds of a perfect clear before the next bag is known.",
    ],
    practiseWith: ["pc-opener"],
  },
  {
    id: "dig-optimizer",
    title: "Cheese dig optimizer",
    level: "intermediate",
    status: "planned",
    summary: "Finds the fewest-piece route through garbage and grades yours.",
    skills: ["Downstacking", "Efficiency"],
    preview: ["...*......", "..***.....", "XXXX.XXXXX", "X.XXXXXXXX", "XXXXXXX.XX", "XX.XXXXXXX"],
    needs: "A downstack search engine",
    willDo: [
      "Compute the minimum number of pieces needed to clear the garbage on screen.",
      "Replay your dig next to the optimal route and mark the first mistake.",
      "Suggest the next placement when you are stuck.",
    ],
    practiseWith: ["t-spin-basics"],
  },
  {
    id: "dt-cannon",
    title: "DT Cannon",
    level: "advanced",
    status: "ready",
    summary: "A T-spin Double that opens a T-spin Triple, over three bags.",
    skills: ["Openers", "TSD", "TST"],
    preview: ["..OO......", "...L......", "JJ.LXXXXXX", "J..LLSXXXX", "J***TSSZZX", "OO*TTTSJZZ", "OO.IIIIJJJ"],
  },
  {
    id: "st-stacking",
    title: "ST stacking solver",
    level: "advanced",
    status: "planned",
    summary: "Solves and suggests optimal ST / LST stacking placements.",
    skills: ["ST stacking", "LST", "T-spin doubles"],
    preview: ["..........", "L..**.....", "L...*.SSOO", "LL.IIIISOO", "XX.XXXXXXX", "X...XXXXXX"],
    needs: "An ST/LST stacking solver",
    willDo: [
      "Suggest the placement that keeps the ST (LST) shape alive for every piece in the queue.",
      "Flag positions that lose the shape, such as a T stuck in hold with no slot ready.",
      "Grade sustained runs by T-spin doubles per bag and height kept.",
    ],
    practiseWith: ["tki-opener", "t-spin-basics"],
    research: [
      "lst-solver (sibling project): exact and bag-level search over LST positions under 7-bag.",
      "As of 2026-11-12 strict LST has no proven closed strategy; most failures come from a T stuck in hold.",
      "Branches lst-stacking and lst-construction-evaluator hold an earlier in-app evaluator prototype.",
    ],
  },
  {
    id: "opener-planner",
    title: "Opener continuation planner",
    level: "advanced",
    status: "planned",
    summary: "Picks the best follow-up after an opener for the bag you got.",
    skills: ["Openers", "Bag planning"],
    preview: [".......J..", "L..ZZ.SJJJ", "L...ZZSSOO", "LL.IIIISOO"],
    needs: "A multi-bag search with an attack-based score",
    willDo: [
      "After an opener, enumerate continuations that are possible with the next bag.",
      "Rank them by attack, back-to-back safety, and perfect-clear chances.",
      "Let you play the chosen line and compare it with the top suggestion.",
    ],
    practiseWith: ["tki-opener", "dt-cannon", "pc-opener"],
  },
];

export function findModule(id: string): ModuleInfo | undefined {
  return MODULES.find((module) => module.id === id);
}

export function modulesAt(level: Level): ModuleInfo[] {
  // Playable modules first, then planned ones, keeping catalog order.
  const atLevel = MODULES.filter((module) => module.level === level);
  return [
    ...atLevel.filter((module) => module.status === "ready"),
    ...atLevel.filter((module) => module.status === "planned"),
  ];
}
