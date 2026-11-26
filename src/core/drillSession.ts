import type { Board } from "./board";
import { bandForPenalty, COACH_CONFIG, reviewPlacement } from "./coach";
import type { Band } from "./coach";
import { digPenalty, digText, isDigFlag, reviewDig } from "./dig";
import type { DrillFlag, DrillReview } from "./dig";
import type { DrillDef } from "./drill";
import { Game } from "./game";
import { hasGarbage } from "./garbage";
import type { GameOptions } from "./incoming";
import type { MetricId, SessionRecord } from "./progress";
import type { Action, Settings } from "./settings";
import { encodeReplay } from "./replayFormat";
import { competitiveMetrics, paceDelta } from "./stats";
import { rivalOf } from "./versus";
import { countStructure } from "./structureCount";

export type Violation = {
  /** Placement it belongs to (the piece in play, for a hold). */
  index: number;
  kind: "hold" | "non-quad";
  reason: string;
};
export type KeyMoment = {
  index: number;
  band: Band;
  flags: DrillFlag[];
  label: string;
};
export type DrillStatus = "playing" | "complete" | "failed";
export type EndReason =
  | "pieces"
  | "lines"
  | "garbage"
  | "time"
  | "timeout"
  | "opponentKO"
  | "topOut"
  | "violations";

function flagLabel(flag: DrillFlag): string {
  if (isDigFlag(flag)) return digText(flag);
  switch (flag.kind) {
    case "hole":
      return flag.count > 1 ? `${flag.count} new holes` : "New hole";
    case "overhang":
      return "Overhang to fill later";
    case "spike":
      return "Height spike";
    case "two-wide":
      return "2-wide gap";
    case "i-dependency":
      return "Needs an I piece";
    case "lost-tsd":
      return "Lost T-spin slot";
    case "high":
      return "Stack too high";
  }
}

/** Garbage doubles only count early, while the cheese is still fresh. */
export const EARLY_PIECES = 20;
/** Efficiency 1.0 means (attack + dug) of 0.4 per piece placed. */
const DIG_PER_PIECE = 0.4;

export class DrillSession {
  game: Game;
  status: DrillStatus = "playing";
  endReason: EndReason | null = null;
  /** reviews[i] grades placement i; it is always as long as game.log. */
  reviews: DrillReview[] = [];
  violations: Violation[] = [];
  // Game restores its clock to the undone lock, which still includes the time
  // spent on discarded attempts. `discarded` is subtracted to get drill time,
  // and `lockedAt[i]` is placement i's drill time when it locked.
  private discarded = 0;
  private lockedAt: number[] = [];
  // The board before each lock, for structure cues (see structureCount.ts).
  private befores: Board[] = [];

  constructor(
    readonly def: DrillDef,
    readonly seed: number,
    settings: Settings,
  ) {
    this.game = new Game(seed, settings, {
      ...def.options,
      ...this.rivals(seed),
    });
    this.game.onLock = ({ before, after, placement }) => {
      const base = reviewPlacement(before, after, {
        cleared: placement.cleared,
        spin: placement.spin !== null,
      });
      let review: DrillReview = base;
      if (def.options?.cheese) {
        const { hold, queue } = this.game.state;
        const dig = reviewDig(before, after, placement, { hold, next: queue });
        const extra = digPenalty(dig);
        if (extra > 0) {
          const penalty = base.penalty + extra;
          review = {
            ...base,
            flags: [...base.flags, ...dig],
            penalty,
            band: bandForPenalty(penalty, base.band === "best"),
          };
        }
      }
      this.reviews[placement.index] = review;
      this.lockedAt[placement.index] = placement.atMs - this.discarded;
      this.befores[placement.index] = before;
      const { cleared } = placement;
      if (def.quadsOnly && cleared >= 1 && cleared <= 3)
        this.violations.push({
          index: placement.index,
          kind: "non-quad",
          reason: `Cleared ${cleared} line${cleared > 1 ? "s" : ""} without a quad`,
        });
    };
    this.queueStart();
    // Game checks this between steps, after a lock has fully resolved
    // (garbage, cheese, spawn), so a lock that tops out fails the run.
    this.game.stopTick = () => {
      this.evaluate();
      return this.status !== "playing";
    };
  }

  // Each run faces a different but reproducible attacker.
  private rivals(seed: number): Partial<GameOptions> {
    const { opponent, bot } = this.def.options ?? {};
    return {
      ...(opponent && { opponent: { ...opponent, seed: seed ^ 0x5bd1e995 } }),
      ...(bot && { bot: { ...bot, seed: seed ^ 0x2f6b9d1b } }),
    };
  }

  private queueStart() {
    if (this.def.startB2b !== undefined) this.game.state.b2b = this.def.startB2b;
    for (const e of this.def.startIncoming ?? [])
      this.game.receive(e.lines, e.delayMs);
  }

  /** Drill time in ms; time spent on undone attempts is given back. */
  get elapsedMs() {
    return this.game.elapsedMs - this.discarded;
  }
  /** Pieces ahead (+) or behind (-) the target pace; null without one. */
  get pace() {
    const pps = this.def.targetPps;
    return pps === undefined
      ? null
      : paceDelta(this.game.state.pieces, this.elapsedMs, pps);
  }

  /** Drill time in ms at which each kept placement locked. */
  get lockTimes(): readonly number[] {
    return this.lockedAt.slice(0, this.game.state.pieces);
  }

  keyDown(action: Action) {
    if (this.status !== "playing") return;
    if (action === "hold" && this.def.noHold) {
      if (this.game.state.active && this.game.state.status === "playing")
        this.violations.push({
          index: this.game.state.pieces,
          kind: "hold",
          reason: "Used hold in a no-hold drill",
        });
    } else this.game.keyDown(action);
    this.evaluate();
  }
  keyUp(action: Action) {
    this.game.keyUp(action);
  }
  tick(dt: number) {
    if (this.status !== "playing") return;
    // Never run past the time limit; Game stops the tick at the first
    // terminal lock (see onLock), so a long frame cannot overshoot.
    const limit = this.def.end.timeMs;
    this.game.tick(
      limit === undefined ? dt : Math.min(dt, Math.max(0, limit - this.elapsedMs)),
    );
    this.evaluate();
  }
  restart(seed = this.seed) {
    this.game.setOptions(this.rivals(seed));
    this.game.restart(seed);
    this.queueStart();
    this.discarded = 0;
    this.lockedAt = [];
    this.befores = [];
    this.reviews = [];
    this.violations = [];
    this.status = "playing";
    this.endReason = null;
  }
  undo() {
    if (!this.game.canUndo) return;
    this.game.undo();
    this.resync();
  }
  /** Go back to just before placement `index` and play on from there. */
  retryFrom(index: number) {
    if (!Number.isInteger(index) || index < 0) return;
    if (index >= this.game.state.pieces) return;
    this.game.rewindTo(index);
    this.resync();
  }

  // After a rewind: drop what belongs to undone placements and resume.
  private resync() {
    const pieces = this.game.state.pieces;
    this.reviews.length = pieces;
    this.violations = this.violations.filter((v) => v.index < pieces);
    // The restored position is worth the drill time of the last kept lock.
    this.lockedAt.length = pieces;
    this.befores.length = pieces;
    this.discarded = this.game.elapsedMs - (this.lockedAt[pieces - 1] ?? 0);
    this.status = "playing";
    this.endReason = null;
  }

  private evaluate() {
    if (this.status !== "playing") return;
    const { def, game } = this;
    const { state } = game;
    const end = def.end;
    const finish = (status: DrillStatus, reason: EndReason) => {
      this.status = status;
      this.endReason = reason;
    };
    const rival = rivalOf(state);
    if (end.opponentKO && rival && !rival.alive)
      return finish("complete", "opponentKO");
    if (state.status === "over")
      return finish(def.failOn?.topOut === false ? "complete" : "failed", "topOut");
    const limit = def.failOn?.violations;
    if (limit !== undefined && this.violations.length >= limit)
      return finish("failed", "violations");
    if (end.pieces !== undefined && state.pieces >= end.pieces)
      return finish("complete", "pieces");
    if (end.lines !== undefined && state.lines >= end.lines)
      return finish("complete", "lines");
    const cheese = def.options?.cheese;
    if (
      end.garbage &&
      cheese &&
      state.cheese &&
      state.cheese.dealt >= cheese.total &&
      !state.board.some(hasGarbage)
    )
      return finish("complete", "garbage");
    if (end.timeMs !== undefined && this.elapsedMs >= end.timeMs - 1e-6)
      // A knockout drill that runs out of time was not won.
      return end.opponentKO
        ? finish("failed", "timeout")
        : finish("complete", "time");
  }

  // Time the results use: the full limit, the last lock, or now.
  private resultMs() {
    const limit = this.def.end.timeMs;
    if (
      (this.endReason === "time" || this.endReason === "timeout") &&
      limit !== undefined
    )
      return limit;
    const last = this.game.log.at(-1);
    // A knockout lands on the rival's clock, not at the player's last lock.
    if (
      this.status === "complete" &&
      this.endReason !== "topOut" &&
      this.endReason !== "opponentKO" &&
      last
    )
      return this.lockedAt[last.index];
    return this.elapsedMs;
  }

  metrics(): Partial<Record<MetricId, number>> {
    const { state, log } = this.game;
    const t = this.resultMs();
    const pieces = state.pieces;
    const c = competitiveMetrics(state.stats, pieces, t);
    let holes = 0;
    for (const review of this.reviews)
      for (const flag of review.flags)
        if (flag.kind === "hole") holes += flag.count;
    const tsds = log.filter(
      (p) => p.type === "T" && p.spin === "full" && p.cleared === 2,
    ).length;
    // A break is a clear that ends a live chain (counter 0 or more).
    let b2bBreaks = 0;
    let chain = this.def.startB2b ?? -1;
    for (const p of log) {
      if (chain >= 0 && p.b2b < 0) b2bBreaks++;
      chain = p.b2b;
    }
    const out: Partial<Record<MetricId, number>> = {
      b2bBreaks,
      pps: c.pps,
      app: c.app,
      apm: c.apm,
      kpp: c.kpp,
      attack: state.stats.attack,
      pieces,
      lines: state.lines,
      timeMs: t,
      maxB2b: state.stats.maxB2b,
      violations: this.violations.length,
      cancelled: state.stats.cancelled,
    };
    if (this.def.end.opponentKO)
      out.win = this.endReason === "opponentKO" ? 1 : 0;
    if (pieces > 0) {
      out.finesse = c.finesse;
      out.holesPer100 = (holes * 100) / pieces;
      out.tsdRate = tsds / (pieces / 7);
    }
    if (this.def.structure)
      out.structureCount = countStructure(
        log.map((p) => ({ ...p, before: this.befores[p.index] })),
        this.def.structure,
      );
    if (c.piecesPerGarbage !== null) out.piecesPerGarbage = c.piecesPerGarbage;
    if (this.def.options?.cheese && pieces > 0) {
      out.earlyDoubles = log.filter(
        (p) => p.index < EARLY_PIECES && p.garbageCleared >= 2,
      ).length;
      out.digEfficiency =
        (state.stats.attack + state.stats.garbageCleared) /
        (pieces * DIG_PER_PIECE);
    }
    if (state.lines > 0)
      out.garbageShare = state.stats.garbageCleared / state.lines;
    // Each drill's score is its primary value.
    const score = out[this.def.primary];
    if (score !== undefined) out.score = score;
    for (const key of Object.keys(out) as MetricId[])
      if (!Number.isFinite(out[key])) delete out[key];
    return out;
  }

  record(id: string, endedAt: number): SessionRecord {
    const metrics = this.metrics();
    const replay = encodeReplay(this.def, this.game.state.seed, this.game.log);
    return {
      id,
      drillId: this.def.id,
      endedAt,
      durationMs: Math.round(metrics.timeMs ?? this.elapsedMs),
      completed: this.status === "complete",
      metrics,
      ...(replay && { replay }),
    };
  }

  /**
   * The worst placements and every violation, worst first (ties go to the
   * earlier piece). Placements below an inaccuracy are skipped, and no two
   * moments are within 3 pieces of each other.
   */
  keyMoments(n = 5): KeyMoment[] {
    const moments = new Map<number, KeyMoment>();
    const weight = new Map<number, number>();
    this.reviews.forEach((review, index) => {
      if (review.penalty < COACH_CONFIG.inaccuracyAt) return;
      moments.set(index, {
        index,
        band: review.band,
        flags: review.flags,
        label: review.flags.map(flagLabel).join(", "),
      });
      weight.set(index, review.penalty);
    });
    for (const v of this.violations) {
      const found = moments.get(v.index);
      moments.set(v.index, {
        index: v.index,
        band: "blunder",
        flags: found?.flags ?? [],
        label: [v.reason, found?.label].filter(Boolean).join(", "),
      });
      weight.set(
        v.index,
        Math.max(weight.get(v.index) ?? 0, COACH_CONFIG.blunderAt),
      );
    }
    const ranked = [...moments.values()].sort(
      (a, b) => weight.get(b.index)! - weight.get(a.index)! || a.index - b.index,
    );
    const picked: KeyMoment[] = [];
    for (const moment of ranked) {
      if (picked.length >= n) break;
      if (picked.every((m) => Math.abs(m.index - moment.index) > 3))
        picked.push(moment);
    }
    return picked;
  }
}
