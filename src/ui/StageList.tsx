import { STAGES, STRETCH, stageStatus } from "../core/curriculum";
import type { Stage } from "../core/curriculum";
import type { DrillDef } from "../core/drill";
import { drillBest } from "../core/drillLookup";
import { DECISION_SET, DECISIONS } from "../core/decisions";
import { best, METRIC_INFO } from "../core/progress";
import type { Progress } from "../core/progress";
import { lessonStatus } from "../core/lesson";
import { LESSONS, STAGE_LESSONS } from "../core/lessons";
import { GateBars } from "./GateBars";

function bestText(progress: Progress, drill: DrillDef): string {
  const value = drillBest(progress, drill);
  const info = METRIC_INFO[drill.primary];
  return value === null
    ? "Not completed yet"
    : `Best ${info.label}: ${info.format(value)}`;
}

function visionBestText(progress: Progress): string {
  const value = best(progress, "vision:storm", "score", { completedOnly: true });
  return value === null
    ? "Storm: not played yet"
    : `Best storm score: ${value}`;
}

function decisionText(progress: Progress): string {
  const value = best(progress, `decision:${DECISION_SET}`, "accuracy");
  return value === null
    ? `${DECISIONS.length} scenarios`
    : `Best ${METRIC_INFO.accuracy.label}: ${METRIC_INFO.accuracy.format(value)}`;
}

// Every stage can be opened and played; the recommended one starts expanded.
export function StageList({
  progress,
  recommendedId,
  onDrill,
  onVision,
  onLesson,
  onHandling,
  onDecision,
}: {
  progress: Progress;
  recommendedId: string;
  onDrill: (id: string) => void;
  onVision: () => void;
  onLesson: (id: string) => void;
  onHandling: () => void;
  onDecision: () => void;
}) {
  return (
    <section aria-labelledby="stages-title">
      <div className="level-heading">
        <h2 id="stages-title">Curriculum</h2>
        <p>Work through the stages in order. Every drill is open to play.</p>
      </div>
      <ol className="stage-list">
        {STAGES.map((stage, index) => (
          <StageItem
            key={stage.id}
            stage={stage}
            index={index}
            progress={progress}
            recommended={stage.id === recommendedId}
            onDrill={onDrill}
            onVision={onVision}
            onLesson={onLesson}
            onHandling={onHandling}
            onDecision={onDecision}
          />
        ))}
      </ol>
    </section>
  );
}

function StageItem({
  stage,
  index,
  progress,
  recommended,
  onDrill,
  onVision,
  onLesson,
  onHandling,
  onDecision,
}: {
  stage: Stage;
  index: number;
  progress: Progress;
  recommended: boolean;
  onDrill: (id: string) => void;
  onVision: () => void;
  onLesson: (id: string) => void;
  onHandling: () => void;
  onDecision: () => void;
}) {
  const status = stageStatus(progress, stage);
  const required = status.gates.filter((g) => g.gate.label !== STRETCH);
  const metCount = required.filter((g) => g.met).length;
  const lessons = LESSONS.filter((l) => STAGE_LESSONS[stage.id]?.includes(l.id));
  const state = status.passed ? "Passed" : recommended ? "Recommended" : null;
  return (
    <li>
      <details
        className={`stage${recommended ? " recommended" : ""}${status.passed ? " passed" : ""}`}
        open={recommended}
      >
        <summary>
          <span className="stage-name">
            {index + 1}. {stage.title}
          </span>
          <span className="step-note">{stage.rankBand}</span>
          <span className="stage-progress">
            {metCount} of {required.length} gates met
            {state && <strong className="stage-state"> · {state}</strong>}
          </span>
        </summary>
        <p className="stage-focus">{stage.focus}</p>
        <GateBars stage={stage} progress={progress} />
        <div className="drill-cards">
          {stage.drills.map((drill) => (
            <button
              key={drill.id}
              className="drill-card"
              onClick={() => onDrill(drill.id)}
            >
              <strong>{drill.title}</strong>
              <span>{drill.summary}</span>
              <span className="drill-card-best">{bestText(progress, drill)}</span>
            </button>
          ))}
          {stage.id === "tsd" && (
            <button className="drill-card" onClick={onVision}>
              <strong>T-spin vision</strong>
              <span>
                Spot slots, rule out dead boards and forecast what the next
                pieces build.
              </span>
              <span className="drill-card-best">
                {visionBestText(progress)}
              </span>
            </button>
          )}
          {stage.id === "b2b" && (
            <button className="drill-card" onClick={onDecision}>
              <strong>Break or keep? (simulated)</strong>
              <span>
                Simulated decision drill: positions are generated and scored by
                simulating both choices against a scripted opponent. They are practice
                for reading the situation, not rules.
              </span>
              <span className="drill-card-best">{decisionText(progress)}</span>
            </button>
          )}
          {stage.id === "controls" && (
            <button className="drill-card" onClick={onHandling}>
              <strong>Handling setup</strong>
              <span>
                Set ARR 0, then find the lowest DAS where finesse holds.
              </span>
              <span className="drill-card-best">6 short runs</span>
            </button>
          )}
        </div>
        {lessons.length > 0 && (
          <>
            <h3 className="stage-subhead">Structures</h3>
            <div className="drill-cards">
              {lessons.map((lesson) => {
                const { count, complete } = lessonStatus(progress, lesson);
                return (
                  <button
                    key={lesson.id}
                    className="drill-card"
                    onClick={() => onLesson(lesson.id)}
                  >
                    <strong>{lesson.title}</strong>
                    <span>{lesson.summary}</span>
                    <span className="drill-card-best">
                      {complete ? "Complete" : `${count} of ${lesson.steps.length} steps`}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </details>
    </li>
  );
}
