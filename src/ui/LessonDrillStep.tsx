import { findDrill, drillBest } from "../core/drillLookup";
import { LESSON_HOLE_CAP } from "../core/lesson";
import type { LessonStep } from "../core/lesson";
import { METRIC_INFO } from "../core/progress";
import type { Progress } from "../core/progress";
import type { Settings } from "../core/settings";

/** A drill step: what to score, your best, and a button to start it. */
export function LessonDrillStep({
  step,
  progress,
  settings,
  onDrill,
}: {
  step: Extract<LessonStep, { kind: "drill" }>;
  progress: Progress;
  /** The settings in force in the lesson, handed to the drill so changes made here apply. */
  settings: Settings;
  onDrill: (id: string, settings: Settings) => void;
}) {
  const found = findDrill(step.drillId);
  if (!found) return null;
  const { drill } = found;
  const info = METRIC_INFO[drill.primary];
  const best = drillBest(progress, drill);
  return (
    <section aria-labelledby="lesson-drill-title">
      <h2 id="lesson-drill-title">{drill.title}</h2>
      <p>{step.text}</p>
      <p>{drill.why}</p>
      <ul>
        {drill.how.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <p className="key-help">
        Goal: {info.label} {info.format(step.target)} or more, with at most {LESSON_HOLE_CAP} holes
        per 100 pieces. Best:{" "}
        {best === null ? "none yet" : info.format(best)}.
      </p>
      <button className="button primary" onClick={() => onDrill(drill.id, settings)}>
        Start drill
      </button>
    </section>
  );
}
