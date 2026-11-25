import { STRETCH } from "./curriculum";
import type { Stage } from "./curriculum";
import type { DrillDef } from "./drill";
import { evaluateGate } from "./progress";
import type { Progress } from "./progress";
import { FREEPLAY_ID } from "./trends";

/** How many recent sessions feed the rank estimate. */
export const SKILL_WINDOW = 10;

/**
 * Average PPS and APP over the newest sessions that recorded both, or null
 * when there are none. Failed runs count: they still show how you play, and
 * an APP of 0 is a real result, not a missing one. `runs` is how many
 * sessions contributed.
 */
export function recentSkill(
  progress: Progress,
  n = SKILL_WINDOW,
): { pps: number; app: number; runs: number } | null {
  const usable = progress.sessions
    // Freeplay is zero-gravity and unscored; it has its own trend chart.
    .filter((s) => s.drillId !== FREEPLAY_ID)
    .filter((s) => (s.metrics.pps ?? 0) > 0 && s.metrics.app !== undefined)
    .slice(-n);
  if (usable.length === 0) return null;
  const mean = (key: "pps" | "app") =>
    usable.reduce((sum, s) => sum + (s.metrics[key] ?? 0), 0) / usable.length;
  return { pps: mean("pps"), app: mean("app"), runs: usable.length };
}

/**
 * Whether a drill counts as passed: every non-stretch gate on it is met, or,
 * for a drill with no gate, it has been completed once.
 */
export function drillPassed(
  progress: Progress,
  stage: Stage,
  drill: DrillDef,
): boolean {
  const gates = stage.gates.filter(
    (g) => g.drillId === drill.id && g.label !== STRETCH,
  );
  if (gates.length > 0) return gates.every((g) => evaluateGate(progress, g).met);
  return progress.sessions.some((s) => s.drillId === drill.id && s.completed);
}

/** The first drill of the stage not yet passed; the first drill once all are. */
export function firstUnpassedDrill(progress: Progress, stage: Stage): DrillDef {
  return (
    stage.drills.find((d) => !drillPassed(progress, stage, d)) ??
    stage.drills[0]
  );
}
