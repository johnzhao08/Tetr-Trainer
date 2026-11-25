import type { DrillDef } from "./drill";
import type { Settings } from "./settings";

/** DAS values the wizard tries, in order (ms). */
export const HANDLING_DAS_STEPS = [130, 120, 110, 100, 90, 80] as const;
/** Pieces per wizard run. */
export const HANDLING_PIECES = 20;
/** A DAS counts as safe when finesse is within this many points of the best run. */
export const FINESSE_TOLERANCE = 0.05;
/** DCD the wizard sets (ms): a small delay that stops accidental wall overshoots. */
export const HANDLING_DCD = 10;

export type HandlingRun = {
  das: number;
  /** Share of pieces placed with no extra presses, 0 to 1. */
  finesse: number;
  /** Extra key presses over the fewest needed (finesse faults). */
  extraPresses: number;
};

/**
 * A finished wizard run as a sample, or null when it ended early (a top-out
 * before all HANDLING_PIECES) or has no finesse reading. Short runs would
 * flatter a DAS the player could not hold control at.
 */
export function acceptRun(
  das: number,
  result: { pieces: number; finesse: number | undefined; extraPresses: number },
): HandlingRun | null {
  if (result.pieces < HANDLING_PIECES || result.finesse === undefined) return null;
  return { das, finesse: result.finesse, extraPresses: result.extraPresses };
}

/** A short finesse run on the same kind of stack as the live finesse drill. */
export const HANDLING_DRILL: DrillDef = {
  id: "handling-run",
  title: "Handling run",
  summary: `Place ${HANDLING_PIECES} pieces on a real stack at one DAS value.`,
  why: "Lowering DAS only helps while you keep control. Finesse on a real stack shows where control starts to slip.",
  how: ["Plan the move, then press once.", "Do not rush."],
  options: { cheese: { rows: 4, total: 4, messiness: 0.5 } },
  end: { pieces: HANDLING_PIECES },
  primary: "finesse",
  metrics: ["finesse"],
};

/** The player's settings with the wizard's ARR and DCD and one DAS to test. */
export function handlingSettings(base: Settings, das: number): Settings {
  return { ...base, das, arr: 0, dcd: HANDLING_DCD };
}

/** The next DAS to test after `done` runs, or null when every step is done. */
export function nextDas(done: readonly HandlingRun[]): number | null {
  return HANDLING_DAS_STEPS[done.length] ?? null;
}

/**
 * The lowest DAS whose finesse is within FINESSE_TOLERANCE of the best run, or
 * null with no runs. Lower DAS is faster, so it wins among the safe ones.
 */
export function recommendDas(runs: readonly HandlingRun[]): number | null {
  if (runs.length === 0) return null;
  const best = Math.max(...runs.map((r) => r.finesse));
  const safe = runs.filter((r) => r.finesse >= best - FINESSE_TOLERANCE - 1e-9);
  return Math.min(...safe.map((r) => r.das));
}
