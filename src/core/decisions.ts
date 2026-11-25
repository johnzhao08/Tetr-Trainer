import type { Tetromino } from "./board";
import { PIECE_MS, robustAnswer } from "./decision";
import type { DecisionFamily, DecisionScenario, Line } from "./decision";
import { mirrorPosition } from "./position";
import type { SessionRecord } from "./progress";
import { nextRandom } from "./rng";

// Seeded break-or-keep scenarios, built in pairs. Both sides of a pair share
// the board, queue, chain, match window and opponent, and differ in exactly
// one visible cue. Only pairs whose two answers are robust (see
// robustAnswer) and opposite are published, so the cue is what decides it.
// Titles are neutral: nothing on screen names the answer.

type Rng = { rng: number };
const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(nextRandom(rng) * items.length)];
const between = (rng: Rng, lo: number, hi: number) =>
  lo + Math.floor(nextRandom(rng) * (hi - lo + 1));

/**
 * Cue strength, 0 to 5. Cues 0 to 2 are the first side of a family (garbage
 * opponent tall; I arrives soon), 3 to 5 the other side
 * at three strengths.
 */
export type Cue = 0 | 1 | 2 | 3 | 4 | 5;
export const CUES: readonly Cue[] = [0, 1, 2, 3, 4, 5];
const FAMILY_SALT: Record<DecisionFamily, number> = { height: 2, wait: 3 };

/** Match windows: inside the opener phase, mid game, and past the 3:00 ramp. */
const WINDOWS = [
  { pieces: 6, ms: 12000 },
  { pieces: 40, ms: 80000 },
  { pieces: 90, ms: 200000 },
] as const;

/** Where the I sits in the queue (0-based). */
export const iIndex = (queue: readonly Tetromino[]) => queue.indexOf("I");

export function buildScenario(
  family: DecisionFamily,
  seed: number,
  cue: Cue,
): DecisionScenario {
  const rng = { rng: (seed * 2654435761 + FAMILY_SALT[family] * 40503) >>> 0 };
  // Surface above the well; col 8 of row 4 stays empty so the L reaches the well.
  const row4 = Array.from({ length: 10 }, (_, x) =>
    x >= 8 ? "." : nextRandom(rng) < 0.6 ? "X" : ".",
  );
  const row5 = row4.map((c, x) => (c === "X" && x < 8 && nextRandom(rng) < 0.5 ? "X" : "."));
  const rows = [
    ...(row5.includes("X") ? [row5.join("")] : []),
    row4.join(""),
    ...Array(4).fill("XXXXXXXXX."),
  ];
  // Draw both sides' variation before choosing, so the shared base never shifts.
  const side = cue < 3 ? "a" : "b";
  const level = cue % 3;
  const mid = between(rng, 3, 5);
  const iAt = family === "wait" ? [[1, 2, 3], [3, 4, 5]][cue < 3 ? 0 : 1][level] : mid;
  const rest: Tetromino[] = ["O", "S", "T", "Z", "L", "O", "J", "T", "S", "Z", "J", "O"];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(rng) * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  rest.splice(iAt - 1, 0, "I");
  const queue: Tetromino[] = ["L", ...rest];
  const b2b = between(rng, 5, 9);
  const match = pick(rng, WINDOWS);
  const base = { seed: between(rng, 1, 1e6), apm: pick(rng, [30, 40, 50]), pps: 2, burst: [5, 6] };
  const opB2b = between(rng, 0, 3);
  const tall = { stack: 6, dirt: [6, 8, 10][level], b2b: opB2b };
  // Only the height family varies the opponent's board by cue.
  const flat =
    family === "height"
      ? { stack: [2, 3, 4][level], dirt: [0, 2, 3][level], b2b: opB2b }
      : { stack: 2, dirt: 0, b2b: opB2b };
  const start = family === "height" && side === "a" ? tall : flat;
  const scenario: DecisionScenario = {
    id: `${family}-${seed}-${cue}`,
    family,
    title: "",
    rows,
    queue,
    b2b,
    match,
    incoming: [],
    opponent: { ...base, start },
  };
  // Half the scenarios put the well on the left (L and J, S and Z swap).
  if (seed % 2 === 0) {
    const mirrored = mirrorPosition({ rows, queue });
    return { ...scenario, rows: mirrored.rows, queue: mirrored.queue };
  }
  return scenario;
}

/** Both sides of a pair, if each has a robust answer and the answers differ. */
export function findPair(
  family: DecisionFamily,
  seed: number,
): { cues: [Cue, Cue]; answers: [Line, Line]; margin: number } | null {
  const robust = new Map(
    CUES.map((c) => [c, robustAnswer(buildScenario(family, seed, c))] as const),
  );
  let best: ReturnType<typeof findPair> = null;
  for (const a of [0, 1, 2] as const)
    for (const b of [3, 4, 5] as const) {
      const ra = robust.get(a);
      const rb = robust.get(b);
      if (!ra || !rb || ra.answer === rb.answer) continue;
      const margin = Math.min(ra.margin, rb.margin);
      if (!best || margin > best.margin)
        best = { cues: [a, b], answers: [ra.answer, rb.answer], margin };
    }
  return best;
}

/** Drill id and record id suffix for this set: `decision:surge`. */
export const DECISION_SET = "surge";

export type Published = { family: DecisionFamily; seed: number; cue: Cue; answer: Line };

// Pairs found with findPair; the answers are stored so a change to the
// simulation that flips a key fails the tests instead of changing a lesson.
// Partners sit half a set apart.
export const PUBLISHED: readonly Published[] = [
  { family: "height", seed: 269, cue: 1, answer: "break" },
  { family: "wait", seed: 286, cue: 5, answer: "break" },
  { family: "height", seed: 322, cue: 3, answer: "keep" },
  { family: "wait", seed: 299, cue: 0, answer: "keep" },
  { family: "height", seed: 25, cue: 0, answer: "break" },
  { family: "height", seed: 350, cue: 3, answer: "keep" },
  { family: "height", seed: 161, cue: 1, answer: "break" },
  { family: "height", seed: 269, cue: 3, answer: "keep" },
  { family: "wait", seed: 286, cue: 0, answer: "keep" },
  { family: "height", seed: 322, cue: 1, answer: "break" },
  { family: "wait", seed: 299, cue: 4, answer: "break" },
  { family: "height", seed: 25, cue: 3, answer: "keep" },
  { family: "height", seed: 350, cue: 1, answer: "break" },
  { family: "height", seed: 161, cue: 3, answer: "keep" },
];

/** The cue that differs inside a pair, stated as fact about the scenario. */
export function cueText(s: DecisionScenario): string {
  if (s.family === "height") {
    const h = Math.round((s.opponent.start?.stack ?? 0) + (s.opponent.start?.dirt ?? 0));
    return h >= 12
      ? `The opponent starts ${h} rows tall, inside the range a Surge can top out.`
      : `The opponent starts ${h} rows tall, nowhere near topping out.`;
  }
  const at = iIndex(s.queue) + 1;
  return `Your I is piece ${at} in the queue, locking at ${(at * PIECE_MS / 1000).toFixed(1)} s.`;
}

/** Progress record for a finished set: score is correct answers. */
export function decisionRecord(
  id: string,
  endedAt: number,
  correct: number,
  total: number,
  durationMs: number,
): SessionRecord {
  return {
    id,
    drillId: `decision:${DECISION_SET}`,
    endedAt,
    durationMs: Math.max(0, Math.round(durationMs)),
    completed: total > 0,
    metrics: { score: correct, accuracy: total > 0 ? correct / total : 0 },
  };
}

export const DECISIONS: readonly DecisionScenario[] = PUBLISHED.map((p, i) => ({
  ...buildScenario(p.family, p.seed, p.cue),
  title: `Position ${i + 1}`,
}));

/** Stored answers in play order. */
export const ANSWERS: readonly Line[] = PUBLISHED.map((p) => p.answer);

/** Why the answer holds: the one cue that differs from the partner position. */
export function lessonFor(index: number): string {
  const p = PUBLISHED[index];
  const partner = PUBLISHED.findIndex(
    (q, i) => i !== index && q.family === p.family && q.seed === p.seed,
  );
  return (
    cueText(DECISIONS[index]) +
    (partner >= 0
      ? ` Position ${partner + 1} has the same board, queue and opponent and differs only in this cue; its best line is the opposite.`
      : "")
  );
}
