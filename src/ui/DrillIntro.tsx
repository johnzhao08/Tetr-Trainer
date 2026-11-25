import { useEffect, useRef } from "react";
import type { Stage } from "../core/curriculum";
import type { DrillDef } from "../core/drill";
import { constraintLines, endText } from "../core/drillView";
import { best, METRIC_INFO } from "../core/progress";
import type { Progress } from "../core/progress";
import { GateBars } from "./GateBars";

export function DrillIntro({
  def,
  stage,
  progress,
  active,
  onStart,
}: {
  def: DrillDef;
  stage: Stage;
  progress: Progress;
  /** False while a dialog is open, so Enter does not start the drill. */
  active: boolean;
  onStart: () => void;
}) {
  const start = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) start.current?.focus();
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat) return;
      if (event.target instanceof Element && event.target.closest("button,a,input,select,textarea"))
        return;
      onStart();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [active, onStart]);
  const info = METRIC_INFO[def.primary];
  const personalBest = best(progress, def.id, def.primary, {
    completedOnly: true,
    better: def.better,
  });
  const constraints = constraintLines(def);
  return (
    <main className="drill-intro">
      <section aria-labelledby="drill-title">
        <p className="eyebrow">
          {stage.title} · {stage.rankBand}
        </p>
        <h2 id="drill-title">{def.title}</h2>
        <p className="drill-why">{def.why}</p>
        <h3>How</h3>
        <ul className="plain-list">
          {def.how.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <h3>Objective</h3>
        <p>{endText(def.end)}. Your score is {info.label}.</p>
        {constraints.length > 0 && (
          <>
            <h3>Rules</h3>
            <ul className="plain-list">
              {constraints.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
        <p className="drill-best">
          Personal best {info.label}:{" "}
          <strong>
            {personalBest === null ? "none yet" : info.format(personalBest)}
          </strong>
        </p>
        <button ref={start} className="button primary" onClick={onStart}>
          Start
        </button>
        <span className="step-note"> or press Enter</span>
      </section>
      <section aria-labelledby="gates-title">
        <h3 id="gates-title">Gates for {stage.title}</h3>
        <GateBars stage={stage} progress={progress} />
      </section>
    </main>
  );
}
