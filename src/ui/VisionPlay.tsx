import { useEffect, useRef } from "react";
import { judgePiece, judgeStructure, judgeYesNo, VISION_PROMPT } from "../core/vision";
import { PRACTICE_QUESTIONS, STORM_PENALTY_MS, modeKind } from "../core/visionRun";
import type { VisionRun } from "../core/visionRun";
import type { Settings } from "../core/settings";
import { VisionChoice } from "./VisionChoice";
import { VisionFindSlot } from "./VisionFindSlot";
import { VisionReveal } from "./VisionReveal";
import { VisionSource } from "./VisionSource";

export type Feedback = { right: boolean; detail: string };

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Score, streak and clock for the current run. */
function Hud({ run, now }: { run: VisionRun; now: number }) {
  const storm = run.mode === "storm";
  const practice = modeKind(run.mode) !== null;
  return (
    <dl className="drill-stats vision-hud">
      <div>
        <dt>Score</dt>
        <dd>{run.score}</dd>
      </div>
      <div>
        <dt>Streak</dt>
        <dd>{run.streak}</dd>
      </div>
      <div>
        <dt>{storm ? "Time" : practice ? "Question" : "Answered"}</dt>
        <dd>
          {storm
            ? clock(run.timeLeft(now))
            : practice
              ? `${Math.min(run.answered + 1, PRACTICE_QUESTIONS)} / ${PRACTICE_QUESTIONS}`
              : run.answered}
        </dd>
      </div>
    </dl>
  );
}

export function VisionPlay({
  run,
  now,
  settings,
  suspended,
  feedback,
  onAnswer,
  onNext,
  onQuit,
}: {
  run: VisionRun;
  now: number;
  settings: Settings;
  suspended: boolean;
  feedback: Feedback | null;
  onAnswer: (right: boolean, detail?: string) => void;
  onNext: () => void;
  onQuit: () => void;
}) {
  const q = run.question;
  const next = useRef<HTMLButtonElement>(null);
  const prompt = useRef<HTMLHeadingElement>(null);
  // After an answer focus Next; after Next, the new prompt.
  useEffect(() => {
    (feedback ? next.current : prompt.current)?.focus();
  }, [feedback]);
  const status = (
    <section aria-label="Run status">
      <Hud run={run} now={now} />
      <button className="button quiet" onClick={onQuit}>
        Quit run
      </button>
    </section>
  );
  // Only when the next question is not built yet; the clock is not running.
  if (run.loading)
    return (
      <main className="vision-layout">
        {status}
        <p role="status" className="step-note">Preparing…</p>
      </main>
    );
  return (
    <main className="vision-layout">
      {status}
      <section aria-labelledby="vision-prompt" className="vision-question">
        <h2 id="vision-prompt" ref={prompt} tabIndex={-1}>{VISION_PROMPT[q.kind]}</h2>
        {!feedback && <VisionSource q={q} />}
        {feedback ? (
          <>
            <VisionReveal q={q} right={feedback.right} detail={feedback.detail} />
            {!feedback.right && run.mode === "storm" && !run.over && (
              <p className="step-note">
                Penalty: {STORM_PENALTY_MS / 1000} seconds.
              </p>
            )}
            <button ref={next} className="button primary" onClick={onNext}>
              {run.over ? "See results" : "Next"}
            </button>
          </>
        ) : q.kind === "findSlot" ? (
          <VisionFindSlot
            key={`${q.id}-${run.answered}`}
            q={q}
            settings={settings}
            suspended={suspended}
            ready={run.asking}
            onAnswer={onAnswer}
          />
        ) : (
          <VisionChoice
            key={`${q.id}-${run.answered}`}
            q={q}
            suspended={suspended}
            onYesNo={(yes) =>
              (q.kind === "noSlot" || q.kind === "forecast") &&
              onAnswer(judgeYesNo(q, yes))
            }
            onPiece={(type) =>
              q.kind === "whichPiece" && onAnswer(judgePiece(q, type))
            }
            onStructure={(id) =>
              q.kind === "structure" && onAnswer(judgeStructure(q, id))
            }
          />
        )}
      </section>
    </main>
  );
}
