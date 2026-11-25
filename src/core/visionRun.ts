import type { SessionRecord } from "./progress";
import { generateQuestion, VISION_KINDS } from "./vision";
import type { VisionKind, VisionQuestion } from "./vision";

export type VisionMode = "streak" | "storm" | `practice:${VisionKind}`;
export const STORM_MS = 180_000;
export const STORM_PENALTY_MS = 10_000;
export const PRACTICE_QUESTIONS = 10;

export const modeKind = (mode: VisionMode): VisionKind | null =>
  mode.startsWith("practice:") ? (mode.slice(9) as VisionKind) : null;
export const drillIdOf = (mode: VisionMode) => `vision:${mode}`;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * One run of the vision trainer. The caller passes the clock in, so the
 * class is deterministic. Time only counts while a question is on screen;
 * reading the answer afterwards is free.
 *
 * - streak: ends on the first wrong answer; score is the streak.
 * - storm: 3 minutes, each wrong answer costs 10 s; score is correct answers.
 * - practice: 10 questions of one kind; score is correct answers.
 */
export class VisionRun {
  question: VisionQuestion;
  correct = 0;
  wrong = 0;
  streak = 0;
  bestStreak = 0;
  over = false;
  private index = 0;
  private shownAt: number | null;
  private activeMs = 0;
  private times: number[] = [];
  // Built while the answer is being read, so the clock never pays for it.
  private upcoming: VisionQuestion | null = null;

  constructor(
    readonly mode: VisionMode,
    readonly seed: number,
    now: number,
  ) {
    this.question = this.make(0);
    this.shownAt = now;
  }

  private make(index: number): VisionQuestion {
    const kind =
      modeKind(this.mode) ??
      VISION_KINDS[(this.seed + index) % VISION_KINDS.length];
    const seed = (this.seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
    return generateQuestion(seed, kind);
  }

  /** True while the player is looking at an unanswered question. */
  get asking() {
    return !this.over && this.shownAt !== null;
  }
  get answered() {
    return this.correct + this.wrong;
  }
  get score() {
    return this.mode === "streak" ? this.bestStreak : this.correct;
  }
  private get penaltyMs() {
    return this.mode === "storm" ? this.wrong * STORM_PENALTY_MS : 0;
  }
  /** Storm only: milliseconds left, never negative. */
  timeLeft(now: number): number {
    const live = this.shownAt === null ? 0 : now - this.shownAt;
    return Math.max(0, STORM_MS - this.activeMs - live - this.penaltyMs);
  }

  /** Record the answer to the current question. */
  answer(right: boolean, now: number) {
    if (!this.asking) return;
    const ms = Math.max(0, now - this.shownAt!);
    this.shownAt = null;
    this.activeMs += ms;
    if (right) {
      this.correct++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.times.push(ms);
    } else {
      this.wrong++;
      this.streak = 0;
    }
    if (
      (this.mode === "streak" && !right) ||
      (this.mode === "storm" && this.timeLeft(now) === 0) ||
      (modeKind(this.mode) && this.answered >= PRACTICE_QUESTIONS)
    )
      this.over = true;
    if (!this.over) this.upcoming = this.make(this.index + 1);
  }

  /** Move on to the next question once the answer has been read. */
  next(now: number) {
    if (this.over || this.shownAt !== null) return;
    this.index++;
    this.question = this.upcoming ?? this.make(this.index);
    this.upcoming = null;
    this.shownAt = now;
  }

  /** Storm: the clock ran out while a question was open. */
  expire(now: number) {
    if (this.mode === "storm" && this.asking && this.timeLeft(now) === 0) {
      this.activeMs += now - this.shownAt!;
      this.shownAt = null;
      this.over = true;
    }
  }

  record(id: string, endedAt: number): SessionRecord {
    const timeMs = Math.round(this.activeMs + this.penaltyMs);
    const metrics: SessionRecord["metrics"] = {
      score: this.score,
      timeMs,
      accuracy: this.answered ? this.correct / this.answered : 0,
    };
    if (this.times.length) metrics.recognitionMs = Math.round(median(this.times));
    return {
      id,
      drillId: drillIdOf(this.mode),
      endedAt,
      durationMs: timeMs,
      completed: this.over,
      metrics,
    };
  }
}
