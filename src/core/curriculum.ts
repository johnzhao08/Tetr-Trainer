// Stages and drills from reports/Competitive Tetris learning progression.md
// ("Stack, dig, spin, chain, then speed up" and "Rebuild the trainer").
import type { DrillDef } from "./drill";
import { LEAGUE_PRESSURE, SLOW_ROOM_PPS } from "./incoming";
import { evaluateGate } from "./progress";
import type { Gate, GateStatus, Progress } from "./progress";

export type Rank = "D" | "C" | "B" | "A" | "S" | "SS" | "U" | "X" | "X+";
export type RankBenchmark = {
  rank: Rank;
  pps: number;
  app: number;
  apm: number;
  /** Garbage lines dug per piece. */
  digPerPiece: number;
  /** Median 40-line personal best, seconds. */
  median40LSec: number;
  /** Share of 40L pieces placed with perfect finesse, 0-1. */
  finesse: number;
};

// Official TETRA LEAGUE rank averages (TETRA CHANNEL API league_ranks); dig
// rate, 40L and finesse columns are the report's own medians.
export const RANK_BENCHMARKS: readonly RankBenchmark[] = [
  { rank: "D", pps: 0.71, app: 0.16, apm: 6.9, digPerPiece: 0.04, median40LSec: 167, finesse: 0.34 },
  { rank: "C", pps: 0.89, app: 0.24, apm: 12.9, digPerPiece: 0.06, median40LSec: 106, finesse: 0.45 },
  { rank: "B", pps: 1.07, app: 0.3, apm: 19.3, digPerPiece: 0.09, median40LSec: 79, finesse: 0.59 },
  { rank: "A", pps: 1.27, app: 0.38, apm: 28.6, digPerPiece: 0.11, median40LSec: 80, finesse: 0.66 },
  { rank: "S", pps: 1.6, app: 0.49, apm: 46.8, digPerPiece: 0.13, median40LSec: 53, finesse: 0.72 },
  { rank: "SS", pps: 1.98, app: 0.61, apm: 72.6, digPerPiece: 0.15, median40LSec: 36, finesse: 0.85 },
  { rank: "U", pps: 2.36, app: 0.7, apm: 98.8, digPerPiece: 0.16, median40LSec: 29, finesse: 0.93 },
  { rank: "X", pps: 2.92, app: 0.79, apm: 139.4, digPerPiece: 0.16, median40LSec: 23, finesse: 0.97 },
  { rank: "X+", pps: 3.5, app: 0.87, apm: 183.5, digPerPiece: 0.17, median40LSec: 18, finesse: 0.99 },
];

/**
 * Closest rank band to a player's PPS and APP. Distance is Euclidean in
 * (ln PPS, ln APP). Since APM = APP x PPS x 60, ln APM is the sum of the two
 * axes, so this tracks APM on a log scale while keeping speed and efficiency
 * equally weighted (the report finds they split the climb almost evenly).
 * Non-positive inputs return the lowest rank.
 */
export function estimateRank(stats: { pps: number; app: number }): Rank {
  if (!(stats.pps > 0) || !(stats.app > 0)) return RANK_BENCHMARKS[0].rank;
  let best = RANK_BENCHMARKS[0];
  let bestDistance = Infinity;
  for (const row of RANK_BENCHMARKS) {
    const distance = Math.hypot(
      Math.log(stats.pps / row.pps),
      Math.log(stats.app / row.app),
    );
    if (distance < bestDistance) {
      best = row;
      bestDistance = distance;
    }
  }
  return best.rank;
}

export type Stage = {
  id: string;
  title: string;
  rankBand: string;
  focus: string;
  drills: DrillDef[];
  gates: Gate[];
};

export const STRETCH = "stretch";

const finesseLive: DrillDef = {
  id: "finesse-live",
  title: "Live finesse",
  summary: "Place 100 pieces on a real stack with as few key presses as possible.",
  why: "Finesse is cheap to repay: about a third of D players place pieces perfectly, against two thirds at A and 97-99% at X. Measuring it on a real stack, not an empty board, is what carries over to games.",
  how: ["Keep ARR low and DAS short.", "Plan the move, then press once.", "Do not trade finesse for speed yet."],
  options: { cheese: { rows: 4, total: 4, messiness: 0.5 } },
  end: { pieces: 100 },
  primary: "finesse",
  metrics: ["finesse", "kpp", "pps", "holesPer100"],
};
const quads40: DrillDef = {
  id: "quads-40l",
  title: "Quad-only 40L",
  summary: "Clear 40 lines using only quads.",
  why: "winterNebs gates versus play behind a Tetris-only sprint under 1:15 on fast games. Building a clean well and waiting for the I is the core stacking skill.",
  how: ["Keep one side column empty.", "Use hold to avoid bad placements.", "A single, double or triple is a violation, spins included."],
  quadsOnly: true,
  end: { lines: 40 },
  failOn: { violations: 3 },
  primary: "timeMs",
  metrics: ["timeMs", "pps", "holesPer100", "finesse"],
};
const noHold40: DrillDef = {
  id: "no-hold-40l",
  title: "No-hold 40L",
  summary: "Clear 40 lines without using hold.",
  why: "Avergrove's rank studies prescribe no-hold sprints at C rank. Losing hold forces you to read the queue and place every piece cleanly.",
  how: ["Plan two pieces ahead.", "Keep the surface flat.", "Hold does nothing and counts as a violation."],
  noHold: true,
  end: { lines: 40 },
  primary: "timeMs",
  metrics: ["timeMs", "pps", "holesPer100", "finesse"],
};
const clean100: DrillDef = {
  id: "clean-100",
  title: "Clean 100",
  summary: "Play 100 pieces creating as few holes as you can.",
  why: "About 100 placements carry most of the skill signal, and new covered holes are among the strongest predictors of skill (Lindstedt & Gray 2013).",
  how: ["Never cover a hole to save time.", "Prefer flat surfaces over height.", "Use hold when a piece does not fit."],
  end: { pieces: 100 },
  primary: "holesPer100",
  metrics: ["holesPer100", "pps", "finesse", "lines"],
};
const slowRoom: DrillDef = {
  id: "slow-room",
  title: "Slow room",
  summary: "Play 100 clean pieces with speed capped at 1.5 pieces per second.",
  why: "Galactoid argues speed should be trained only after efficiency, because speed multiplies mistakes. Jstris runs a Slow Room capped at 1.5 PPS, which leaves time to plan every placement.",
  how: ["Use the extra time to read the queue.", "A drop made too early waits for the cap.", "Keep the metronome on and match its click."],
  options: { ppsCap: SLOW_ROOM_PPS },
  end: { pieces: 100 },
  primary: "holesPer100",
  metrics: ["holesPer100", "app", "finesse", "pps"],
};
const cheese10: DrillDef = {
  id: "cheese-10",
  title: "Cheese 10",
  summary: "Dig a 10-line garbage race in as few pieces as possible.",
  why: "Hard Drop opens its downstacking guide with a 10-line dig race, and winterNebs says cheese efficiency is about placing the fewest blocks. Dig efficiency separates low and middle ranks the most.",
  how: ["Know where the next hole is and keep its column open.", "Every block over a hole costs a line to dig.", "Aim for garbage doubles early, and place the fewest blocks."],
  options: { cheese: { rows: 9, total: 10, messiness: 0.5 } },
  end: { garbage: true },
  primary: "piecesPerGarbage",
  metrics: ["piecesPerGarbage", "garbageShare", "timeMs", "pieces"],
};
const cheeseMessy: DrillDef = {
  id: "cheese-messy",
  title: "Messy cheese",
  summary: "Dig 18 lines where every hole moves.",
  why: "Fully messy garbage removes the easy vertical dig and forces real downstacking decisions, the skill that quadruples from D to U.",
  how: ["Read two holes ahead.", "Spend I pieces on garbage rows.", "Hold the piece the next hole needs."],
  options: { cheese: { rows: 9, total: 18, messiness: 1 } },
  end: { garbage: true },
  primary: "piecesPerGarbage",
  metrics: ["piecesPerGarbage", "garbageShare", "timeMs", "holesPer100"],
};
const cheeseClean: DrillDef = {
  id: "cheese-clean",
  title: "Clean cheese",
  summary: "Dig 20 lines of garbage whose holes stay in the same column for runs of rows.",
  why: "Hard Drop's downstacking rules reward garbage doubles early: with clean cheese, two rows share a hole column, so one placement can clear both. 61bi's advice is the same, finish with the fewest pieces, not the least time.",
  how: ["Look for the run of rows sharing a hole.", "Fill two garbage rows with one piece for a double.", "Keep the hole column open until the piece that clears it."],
  options: { cheese: { rows: 9, total: 20, messiness: 0, clean: true } },
  end: { garbage: true },
  primary: "digEfficiency",
  metrics: ["digEfficiency", "earlyDoubles", "piecesPerGarbage", "garbageShare"],
};
const cheese2Hole: DrillDef = {
  id: "cheese-2hole",
  title: "Two-hole cheese",
  summary: "Dig 14 lines where every row has two holes.",
  why: "Real garbage is not always one hole wide. Two holes per row give you a choice of piece, so the Hard Drop rule of holding the piece the next hole needs matters more.",
  how: ["Pick the hole that your current or held piece fits.", "Spend I pieces on garbage rows.", "Self-check: if you mostly clear your own coloured lines, you are removing your own stack."],
  options: { cheese: { rows: 9, total: 14, messiness: 0.5, holes: 2 } },
  end: { garbage: true },
  primary: "piecesPerGarbage",
  metrics: ["piecesPerGarbage", "digEfficiency", "earlyDoubles", "garbageShare"],
};
const cheese100: DrillDef = {
  id: "cheese-100",
  title: "Cheese 100",
  summary: "Dig a 100-line race using as few pieces as possible.",
  why: "A player at high SS reports a best of 244 pieces on Jstris's 100-line cheese race and finishes under 300 only about 30% of the time, roughly 2.4-3.0 pieces per garbage line. It is scored by pieces, not time.",
  how: ["Fewest pieces, not time.", "If you mostly clear your own coloured lines, you are just removing your own stacking.", "Stay calm when the board gets tall."],
  options: { cheese: { rows: 9, total: 100, messiness: 0.5 } },
  end: { garbage: true },
  primary: "pieces",
  // Fewer pieces is the better dig, unlike the usual pieces metric.
  better: "lower",
  metrics: ["pieces", "piecesPerGarbage", "garbageShare", "timeMs"],
};
const tsdHunt: DrillDef = {
  id: "tsd-hunt",
  title: "TSD hunt",
  summary: "Build T-spin doubles from random bags without making holes.",
  why: "winterNebs: T-spinning comes back to stacking, and you should never compromise your stack for it. The score is TSDs per bag, with holes as the check.",
  how: ["Look for overhangs the bag lets you build.", "Keep a T for the slot.", "Skip a TSD that needs a hole."],
  end: { pieces: 100 },
  primary: "tsdRate",
  metrics: ["tsdRate", "holesPer100", "app", "maxB2b"],
};
const app100: DrillDef = {
  id: "app-100",
  title: "APP at 1.0 PPS",
  summary: "Keep attack per piece up at a steady 1.0 pieces per second.",
  why: "Progress gates read APP at a target PPS, because neither stat alone captures it. Around 0.4 APP is where the median ranked player sits.",
  how: ["Follow the pacer.", "Prefer TSDs and quads over singles.", "Do not rush into holes."],
  targetPps: 1,
  end: { pieces: 100 },
  primary: "app",
  metrics: ["app", "pps", "apm", "holesPer100"],
};
const b2bChain: DrillDef = {
  id: "b2b-chain",
  title: "B2B chain",
  summary: "Build the longest back-to-back chain you can in 150 pieces.",
  why: "Season 2 made back-to-back the currency of attack: Surge charges from a chain of 4 or more and releases when it breaks.",
  how: ["Clear only with quads and spins.", "Use mini spins to keep B2B.", "Dig with combos, not singles."],
  end: { pieces: 150 },
  primary: "maxB2b",
  metrics: ["maxB2b", "app", "attack", "holesPer100"],
};
const b2bDig: DrillDef = {
  id: "b2b-dig",
  title: "B2B dig",
  summary: "Dig 10 lines of light cheese while keeping your B2B alive.",
  why: "Clearing garbage with quads and spins earns a +1 bonus, so digging and attacking can happen in the same piece.",
  how: ["Keep B2B through garbage.", "Use spins on garbage rows.", "Fewer pieces beats faster pieces."],
  options: { cheese: { rows: 9, total: 10, messiness: 0.3 } },
  end: { garbage: true },
  primary: "piecesPerGarbage",
  metrics: ["piecesPerGarbage", "maxB2b", "app", "timeMs"],
};
const appPace16: DrillDef = {
  id: "app-pace-16",
  title: "APP at 1.6 PPS",
  summary: "Hold 0.5 attack per piece while keeping 1.6 pieces per second.",
  why: "S rank averages about 1.6 PPS and 0.49 APP. Speed should be trained only after efficiency, so the pace rises only when APP holds.",
  how: ["Stay just ahead of the pacer.", "Slow down if holes appear.", "Keep B2B running."],
  targetPps: 1.6,
  end: { pieces: 120 },
  primary: "app",
  metrics: ["app", "pps", "apm", "holesPer100"],
};
const underFire: DrillDef = {
  id: "under-fire",
  title: "Under fire",
  summary: "Survive two minutes against an attacker with gravity and lock delay.",
  why: "TETRA LEAGUE averages include garbage, so solo numbers overstate you. Incoming lines with travel time, gravity and a lock delay add the pressure.",
  how: ["Cancel garbage with your attacks.", "Keep your stack low.", "Break B2B only to survive."],
  options: { ...LEAGUE_PRESSURE, opponent: { seed: 1, apm: 30 } },
  end: { timeMs: 120000 },
  primary: "app",
  metrics: ["app", "pps", "apm", "attack"],
};
const underFireHard: DrillDef = {
  id: "under-fire-hard",
  title: "Under heavy fire",
  summary: "The same, against an attacker that sends 60 APM with big bursts.",
  why: "SS and U players hold APP of 0.6 or more at 2+ PPS, which includes defending against spikes of 6 to 8 lines.",
  how: ["Expect a spike every so often.", "Cancel before it lands.", "Do not panic dig."],
  options: { ...LEAGUE_PRESSURE, opponent: { seed: 1, apm: 60, burst: [6, 8] } },
  end: { timeMs: 120000 },
  primary: "app",
  metrics: ["app", "pps", "apm", "attack"],
};
const versusBot: DrillDef = {
  id: "versus-bot",
  title: "Versus bot",
  summary: "Top out a simulated opponent before it tops you out.",
  why: "Season 2 tempo: the first 14 pieces cancel at double rate for the player who is behind, B2B chains charge Surge, and after 3:00 attacks grow stronger. Sending when the rival is tall wins games.",
  how: [
    "Cancel early garbage while the opener phase doubles it.",
    "Watch the opponent height; spike when it is 12 or more.",
    "Keep your B2B within 8 of theirs.",
  ],
  options: {
    ...LEAGUE_PRESSURE,
    opponent: {
      seed: 1,
      apm: 40,
      burst: [5, 6],
      pps: 2,
      surge: true,
      receives: true,
    },
  },
  end: { opponentKO: true, timeMs: 360000 },
  primary: "win",
  metrics: ["win", "app", "pps", "cancelled"],
};
const cancelOrSend: DrillDef = {
  id: "cancel-or-send",
  title: "Cancel or send",
  summary: "A big garbage queue is already coming. Clear lines to cancel it.",
  why: "Clearing lines cancels queued garbage before it lands, and attack that cancels sends nothing. Knowing when to cancel and when to send is the core of versus tempo.",
  how: [
    "Every line you clear spends attack on the queue first.",
    "In the opener phase each attack line cancels 2 incoming lines.",
    "Do not place a piece that adds no clear while garbage is ready.",
  ],
  options: { ...LEAGUE_PRESSURE },
  startIncoming: [
    { lines: 6, delayMs: 4000 },
    { lines: 6, delayMs: 8000 },
    { lines: 8, delayMs: 12000 },
  ],
  end: { pieces: 30 },
  primary: "cancelled",
  metrics: ["cancelled", "app", "pps", "attack"],
};
const appPace20: DrillDef = {
  id: "app-pace-20",
  title: "APP at 2.0 PPS",
  summary: "Hold 0.6 attack per piece at 2.0 pieces per second.",
  why: "APP of 0.6 or more sustained at 2+ PPS is the SS to U signal. At this speed efficiency usually breaks first.",
  how: ["Follow the pacer.", "Trust your finesse.", "Plan the next two pieces."],
  targetPps: 2,
  end: { pieces: 150 },
  primary: "app",
  metrics: ["app", "pps", "apm", "holesPer100"],
};

export const STAGES: readonly Stage[] = [
  {
    id: "controls",
    title: "Controls",
    rankBand: "D",
    focus: "Efficient inputs on a real stack.",
    drills: [finesseLive],
    gates: [
      // A-rank median finesse is 66% (report rank table).
      { drillId: "finesse-live", metric: "finesse", target: 0.66, over: { recent: 3 }, label: "A median" },
      // Report: rising toward ~80%.
      { drillId: "finesse-live", metric: "finesse", target: 0.8, over: { recent: 3 }, label: STRETCH },
    ],
  },
  {
    id: "clean-stacking",
    title: "Clean stacking",
    rankBand: "C",
    focus: "A flat stack with a well and no holes.",
    drills: [quads40, noHold40, clean100, slowRoom],
    gates: [
      // Report: Tetris-only 40L under about 1:15-1:30. Only runs with no
      // non-quad clears count.
      { drillId: "quads-40l", metric: "timeMs", target: 90000, over: "best", requireZero: ["violations"] },
      // Report stage 2 signal: no holes in calm play; 3 per 100 pieces.
      { drillId: "clean-100", metric: "holesPer100", target: 3, over: { recent: 3 } },
    ],
  },
  {
    id: "downstacking",
    title: "Downstacking",
    rankBand: "B",
    focus: "Dig garbage with few pieces.",
    drills: [cheese10, cheeseClean, cheese2Hole, cheeseMessy, cheese100],
    gates: [
      // Report gate: under about 3.0 pieces per garbage line.
      { drillId: "cheese-10", metric: "piecesPerGarbage", target: 3, over: "best" },
      // Report: heading toward about 2.5.
      { drillId: "cheese-10", metric: "piecesPerGarbage", target: 2.5, over: "best", label: STRETCH },
    ],
  },
  {
    id: "tsd",
    title: "TSD in random play",
    rankBand: "B-A",
    focus: "Build TSDs naturally without hurting the stack.",
    drills: [tsdHunt, app100],
    gates: [
      // Judgement: a TSD in 0.4 of bags, about one every 2.5 bags.
      { drillId: "tsd-hunt", metric: "tsdRate", target: 0.4, over: "best" },
      // Judgement: a few holes per 100 pieces keeps T-spin play honest.
      { drillId: "tsd-hunt", metric: "holesPer100", target: 4, over: { recent: 3 } },
      // Report: freeplay APP about 0.4 (A rank 0.38).
      { drillId: "app-100", metric: "app", target: 0.4, over: "best", minPps: 1 },
      // Judgement: recognition under pressure; 15 storm answers in 3 minutes
      // is unvalidated, so it stays a stretch gate.
      { drillId: "vision:storm", metric: "score", target: 15, over: "best", label: STRETCH },
    ],
  },
  {
    id: "b2b",
    title: "B2B economy",
    rankBand: "A",
    focus: "Keep back-to-back going and charge Surge.",
    drills: [b2bChain, b2bDig, appPace16],
    gates: [
      // Report: can hold B2B 4 or more to charge Surge.
      { drillId: "b2b-chain", metric: "maxB2b", target: 4, over: "best" },
      // Report: APP about 0.5 at 1.6 PPS or more (S rank).
      { drillId: "app-pace-16", metric: "app", target: 0.5, over: { recent: 3 }, minPps: 1.6 },
    ],
  },
  {
    id: "pressure",
    title: "Pressure",
    rankBand: "SS-U",
    focus: "Keep efficiency while under attack and at speed.",
    drills: [underFire, underFireHard, versusBot, cancelOrSend, appPace20],
    gates: [
      // Report: surviving two minutes at APP 0.5 against a 30 APM attacker.
      { drillId: "under-fire", metric: "app", target: 0.5, over: "best" },
      // Report: APP 0.6 or more sustained at 2+ PPS.
      { drillId: "under-fire-hard", metric: "app", target: 0.6, over: "best", minPps: 2 },
      { drillId: "app-pace-20", metric: "app", target: 0.6, over: { recent: 3 }, minPps: 2 },
    ],
  },
];

export type StageStatus = { gates: GateStatus[]; passed: boolean };

/** Every non-stretch gate must be met; stretch gates are shown but optional. */
export function stageStatus(progress: Progress, stage: Stage): StageStatus {
  const gates = stage.gates.map((gate) => evaluateGate(progress, gate));
  return {
    gates,
    passed: gates.every((s) => s.gate.label === STRETCH || s.met),
  };
}

/** The first stage not passed; the last stage once all are. */
export function recommendedStage(progress: Progress): Stage {
  return (
    STAGES.find((stage) => !stageStatus(progress, stage).passed) ??
    STAGES[STAGES.length - 1]
  );
}
