import type { SessionRecord } from "./progress";
import { generateQuestion } from "./vision";
import type { VisionQuestion } from "./vision";
import { modeKind, SyncFeed } from "./visionFeed";
import type { Feed, Generate, VisionMode } from "./visionFeed";

export { MAX_SALTS, modeKind } from "./visionFeed";
export type { VisionMode } from "./visionFeed";
export const STORM_MS = 180_000;
export const STORM_PENALTY_MS = 10_000;
export const PRACTICE_QUESTIONS = 10;

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
  /**
   * The current question. Undefined while `loading` at the start, or when the
   * run ended before its first question; the screen never reads it then.
   */
  question: VisionQuestion = undefined as unknown as VisionQuestion;
  correct = 0;
  wrong = 0;
  streak = 0;
  bestStreak = 0;
  over = false;
  /** True when the run ended early because no unseen question was left. */
  exhausted = false;
  private index = 0;
  private started = false;
  private shownAt: number | null = null;
  // True while the question is built but its clock has not started.
  private awaiting = true;
  // The player asked for the next question before it was built.
  private advancing = false;
  private activeMs = 0;
  private times: number[] = [];
  // Built while the answer is being read, so the clock never pays for it.
  private upcoming: VisionQuestion | null = null;
  private readonly feed: Feed;

  /**
   * `source` is a `Feed` (the screen passes one that builds off the UI
   * thread) or a plain generator, which builds each question when asked.
   */
  constructor(
    readonly mode: VisionMode,
    readonly seed: number,
    now: number | null = null,
    source: Feed | Generate = generateQuestion,
  ) {
    this.feed =
      typeof source === "function" ? new SyncFeed(mode, seed, source) : source;
    this.poll();
    if (this.started && !this.over && now !== null) {
      this.shownAt = now;
      this.awaiting = false;
    }
  }

  /**
   * Take whatever the feed has finished since the last call. The screen calls
   * this when the feed reports progress.
   */
  poll() {
    if (this.over) return;
    if (!this.started) {
      const first = this.feed.get(0);
      if (first === undefined) return;
      this.started = true;
      if (first === null) {
        // Without a first question the run is over before it starts, and the
        // record says it was cut short.
        this.exhausted = true;
        this.over = true;
        return;
      }
      this.question = first;
      this.feed.want(1);
      return;
    }
    this.peek();
    if (this.advancing && this.upcoming) this.commit();
  }

  /** Listen for questions finishing; returns the way to stop listening. */
  subscribe(listener: () => void) {
    return this.feed.subscribe(listener);
  }
  /** Release the feed's resources; call once when the run is left. */
  dispose() {
    this.feed.dispose();
  }
  /** No question is on screen yet: the first, or the next one asked for early. */
  get loading() {
    return !this.over && (!this.started || this.advancing);
  }

  /**
   * Start the clock for the current question once it is on screen; building
   * it can take a moment and the player is not charged for that. A no-op
   * once the clock is running.
   */
  show(now: number) {
    if (!this.awaiting || this.over || !this.started || this.advancing) return;
    this.awaiting = false;
    this.shownAt = now;
  }

  /** Look for the next question; null from the feed means none is left. */
  private peek() {
    if (this.upcoming || this.over) return;
    const next = this.feed.get(this.index + 1);
    if (next === undefined) return;
    if (next === null) {
      // The feed keeps answering null, so an empty next slot is remembered.
      // A question still open on screen is finished first; the run ends at
      // the next peek, which `answer` and `poll` both make.
      if (!this.asking && !this.awaiting) {
        this.exhausted = true;
        this.over = true;
      }
    } else this.upcoming = next;
  }

  private commit() {
    this.index++;
    this.question = this.upcoming!;
    this.upcoming = null;
    this.advancing = false;
    this.awaiting = true;
    this.feed.want(this.index + 1);
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
    const live = this.shownAt === null ? 0 : Math.max(0, now - this.shownAt);
    return Math.max(0, STORM_MS - this.activeMs - live - this.penaltyMs);
  }

  /** Record the answer to the current question; false if it did not count. */
  answer(right: boolean, now: number): boolean {
    if (!this.asking) return false;
    // An answer after the storm clock ran out does not count.
    if (this.mode === "storm" && this.timeLeft(now) === 0) {
      this.expire(now);
      return false;
    }
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
    if (!this.over) this.peek();
    return true;
  }

  /**
   * Move on to the next question once the answer has been read. Its clock
   * starts at the next `show`, when the question is on screen.
   */
  next() {
    if (this.over || this.shownAt !== null || this.awaiting || !this.started)
      return;
    this.advancing = true;
    this.poll();
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
      completed: this.over && !this.exhausted,
      metrics,
    };
  }
}
