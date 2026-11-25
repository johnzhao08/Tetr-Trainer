import type { Tetromino } from "./board";
import { compare, MIN_MARGIN } from "./decision";
import type { DecisionKind, DecisionScenario, Line } from "./decision";
import { mirrorPosition } from "./position";
import type { SessionRecord } from "./progress";
import { nextRandom } from "./rng";

// Seeded break-or-keep scenarios. Every scenario shares one skeleton: a Quad
// well on the right, an L first in the queue that can only clear by spending
// the well (a Double: the Break), and an I somewhere later (the Keep). What
// changes per kind is the opponent and the garbage on its way to you.

type Rng = { rng: number };
const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(nextRandom(rng) * items.length)];
const between = (rng: Rng, lo: number, hi: number) =>
  lo + Math.floor(nextRandom(rng) * (hi - lo + 1));

const KIND_TITLE: Record<DecisionKind, string> = {
  spike: "Opponent is tall",
  cancel: "Garbage is coming",
  calm: "Quiet board",
};

export function buildScenario(kind: DecisionKind, seed: number): DecisionScenario {
  const rng = { rng: (seed * 2654435761 + kind.length) >>> 0 };
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
  const iAt = kind === "calm" ? between(rng, 1, 2) : kind === "spike" ? between(rng, 4, 6) : between(rng, 3, 6);
  const rest: Tetromino[] = ["O", "S", "T", "Z", "L", "O"];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(rng) * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  rest.splice(iAt - 1, 0, "I");
  const queue: Tetromino[] = ["L", ...rest.slice(0, 7)];
  const b2b = between(rng, 5, 9);
  const base = {
    seed: between(rng, 1, 1e6),
    apm: pick(rng, [30, 40, 50]),
    pps: 2,
    burst: [5, 6],
  };
  let incoming: DecisionScenario["incoming"] = [];
  let start;
  if (kind === "spike") {
    start = { stack: between(rng, 5, 6), dirt: 7, b2b: between(rng, 0, 3) };
  } else if (kind === "cancel") {
    start = { stack: between(rng, 2, 4), dirt: 0, b2b: between(rng, 0, 3) };
    incoming = [
      { lines: between(rng, 7, 9), delayMs: between(rng, 500, 900) },
      { lines: between(rng, 6, 8), delayMs: between(rng, 1300, 1800) },
    ];
  } else {
    start = { stack: 2, dirt: 0, b2b: between(rng, 0, 2) };
  }
  const scenario: DecisionScenario = {
    id: `${kind}-${seed}`,
    kind,
    title: KIND_TITLE[kind],
    rows,
    queue,
    b2b,
    incoming,
    opponent: { ...base, start },
  };
  // Half the scenarios put the well on the left (L and J, S and Z swap).
  if (seed % 2 === 0) {
    const mirrored = mirrorPosition({ rows, queue });
    return { ...scenario, rows: mirrored.rows, queue: mirrored.queue };
  }
  return scenario;
}

/** The answer a kind is meant to teach. */
export const KIND_ANSWER: Record<DecisionKind, Line> = {
  spike: "break",
  cancel: "break",
  calm: "keep",
};

/** First `count` seeds of a kind whose outcome is clear and teaches its answer. */
export function findSeeds(kind: DecisionKind, count: number, from = 1, limit = 400): number[] {
  const seeds: number[] = [];
  for (let seed = from; seed < from + limit && seeds.length < count; seed++) {
    const c = compare(buildScenario(kind, seed));
    if (c.answer === KIND_ANSWER[kind] && c.margin >= MIN_MARGIN) seeds.push(seed);
  }
  return seeds;
}

/** Drill id and record id suffix for this set: `decision:surge`. */
export const DECISION_SET = "surge";

// Seeds picked with findSeeds: each outcome is clear (margin of MIN_MARGIN or
// more) and teaches its kind. `answer` is stored so a change to the
// simulation that flips a key fails the tests instead of silently changing a
// lesson.
export const DECISION_SEEDS: readonly { kind: DecisionKind; seed: number; answer: Line }[] = [
  { kind: "spike", seed: 2, answer: "break" },
  { kind: "calm", seed: 1, answer: "keep" },
  { kind: "cancel", seed: 2, answer: "break" },
  { kind: "spike", seed: 9, answer: "break" },
  { kind: "calm", seed: 2, answer: "keep" },
  { kind: "cancel", seed: 3, answer: "break" },
  { kind: "spike", seed: 15, answer: "break" },
  { kind: "calm", seed: 5, answer: "keep" },
  { kind: "cancel", seed: 5, answer: "break" },
  { kind: "spike", seed: 26, answer: "break" },
  { kind: "calm", seed: 6, answer: "keep" },
  { kind: "cancel", seed: 6, answer: "break" },
];

/** Why the answer holds, by kind. Shown with the played-out comparison. */
export const KIND_LESSON: Record<DecisionKind, string> = {
  spike:
    "A tall opponent is in the spike window: a Surge plus a clear can top them out before a quad would arrive.",
  cancel:
    "Garbage is already on its way. Releasing Surge cancels it before it lands; waiting for the quad lets it land.",
  calm:
    "Nothing is threatening you or them, so the chain is worth more kept: every quad adds attack and a later Surge.",
};

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

export const DECISIONS: readonly DecisionScenario[] = DECISION_SEEDS.map((d) =>
  buildScenario(d.kind, d.seed),
);
