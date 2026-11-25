import type { GameOptions } from "./incoming";
import type { MetricId } from "./progress";
import type { StructureKind } from "./structureCount";

/** One short stretch of random-bag play toward a narrow objective. */
export type DrillDef = {
  id: string;
  title: string;
  /** One line. */
  summary: string;
  /** One to three sentences on why this drill matters, grounded in the research. */
  why: string;
  /** Short tips shown before starting. */
  how: readonly string[];
  /** Gravity, lock delay, cheese, opponent, garbageCap... */
  options?: Partial<GameOptions>;
  /** The hold key does nothing; each attempt is a violation. */
  noHold?: boolean;
  /** Any 1-3 line clear, spins included, is a violation. */
  quadsOnly?: boolean;
  /** Counts uses of a structure in the run, for the `structureCount` metric. */
  structure?: StructureKind;
  /** Shows a pacer; sessions below it do not count for gates with minPps. */
  targetPps?: number;
  /** The first condition reached completes the drill. */
  end: {
    pieces?: number;
    lines?: number;
    /** All cheese dealt and cleared. */
    garbage?: true;
    timeMs?: number;
    /** The simulated opponent tops out (you win). */
    opponentKO?: true;
  };
  /** Garbage queued at the start of every run: lines landing after delayMs. */
  startIncoming?: readonly { lines: number; delayMs: number }[];
  /** Topping out fails the drill unless `topOut` is false (then it just ends). */
  failOn?: { violations?: number; topOut?: boolean };
  /** The headline score. */
  primary: MetricId;
  /** Overrides the primary metric's usual direction (fewer pieces is better). */
  better?: "higher" | "lower";
  /** Shown in results. */
  metrics: readonly MetricId[];
};
