import { STAGES } from "./curriculum";
import type { Stage } from "./curriculum";
import type { DrillDef } from "./drill";
import { best, betterOf, METRIC_INFO } from "./progress";
import type { Gate, Progress } from "./progress";

/** The drill with this id and the stage that holds it, or null. */
export function findDrill(id: string): { drill: DrillDef; stage: Stage } | null {
  for (const stage of STAGES) {
    const drill = stage.drills.find((d) => d.id === id);
    if (drill) return { drill, stage };
  }
  return null;
}

/**
 * Best completed run of a drill's primary metric, honoring the drill's own
 * direction (cheese-100 is better lower). The one place that decides this.
 */
export function drillBest(
  progress: Progress,
  drill: Pick<DrillDef, "id" | "primary" | "better">,
): number | null {
  return best(progress, drill.id, drill.primary, {
    completedOnly: true,
    better: drill.better,
  });
}

/** "APP at least 0.50 at 1.6+ PPS, average of last 3". */
export function gateText(gate: Gate): string {
  const info = METRIC_INFO[gate.metric];
  const bound = betterOf(gate.metric, gate.better) === "higher" ? "at least" : "at most";
  const speed = gate.minPps !== undefined ? ` at ${gate.minPps}+ PPS` : "";
  const span =
    gate.over === "best" ? "best run" : `average of last ${gate.over.recent}`;
  return `${info.label} ${bound} ${info.format(gate.target)}${speed}, ${span}`;
}
