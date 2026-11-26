import { VISION_KINDS, VISION_PROMPT } from "../core/vision";
import { best, METRIC_INFO } from "../core/progress";
import type { Progress } from "../core/progress";
import { drillIdOf, PRACTICE_QUESTIONS, STORM_MS } from "../core/visionRun";
import type { VisionMode } from "../core/visionRun";

const bestText = (progress: Progress, mode: VisionMode) => {
  const v = best(progress, drillIdOf(mode), "score", { completedOnly: true });
  return v === null ? "No runs yet" : `Best ${METRIC_INFO.score.label}: ${v}`;
};

export function VisionMenu({
  progress,
  onStart,
}: {
  progress: Progress;
  onStart: (mode: VisionMode) => void;
}) {
  const card = (mode: VisionMode, title: string, text: string) => (
    <button key={mode} className="drill-card" onClick={() => onStart(mode)}>
      <strong>{title}</strong>
      <span>{text}</span>
      <span className="drill-card-best">{bestText(progress, mode)}</span>
    </button>
  );
  return (
    <main className="home-layout">
      <section className="level-section" aria-labelledby="vision-modes">
        <div className="level-heading">
          <h2 id="vision-modes">T-spin vision</h2>
          <p>
            Spot slots, rule out dead boards, and forecast what the next pieces
            build. Experts plan the spin instead of probing for it, and a small
            vocabulary of shapes makes that fast.
          </p>
        </div>
        <div className="drill-cards">
          {card("streak", "Streak", "Answer until your first mistake.")}
          {card(
            "storm",
            "Storm",
            `${STORM_MS / 60000} minutes; a wrong answer costs 10 seconds.`,
          )}
        </div>
      </section>
      <section className="level-section" aria-labelledby="vision-practice">
        <div className="level-heading">
          <h2 id="vision-practice">Practice one question type</h2>
          <p>{PRACTICE_QUESTIONS} questions each.</p>
        </div>
        <div className="drill-cards">
          {VISION_KINDS.map((kind) =>
            card(`practice:${kind}`, VISION_PROMPT[kind], "Practice"),
          )}
        </div>
      </section>
    </main>
  );
}
