import { useCallback, useRef, useState } from "react";
import { lessonStatus, practiceQueue } from "../core/lesson";
import type { Lesson, LessonStep } from "../core/lesson";
import { findLesson } from "../core/lessons";
import { saveSettings } from "../core/settings";
import type { Settings } from "../core/settings";
import { STRUCTURES } from "../core/structures";
import { LessonDrillStep } from "./LessonDrillStep";
import { LessonOverview } from "./LessonOverview";
import { LessonPuzzle } from "./LessonPuzzle";
import { LessonRecognize } from "./LessonRecognize";
import { withStepDone } from "./lessonProgress";
import { LessonSteps } from "./LessonSteps";
import { ModuleHeader } from "./ModuleHeader";
import { readProgress, writeProgress } from "./progressStorage";
import { SettingsDialog } from "./SettingsDialog";
import { newSessionId } from "./sessionId";

export function LessonScreen({
  id,
  settings,
  onDrill,
  onHome,
}: {
  id: string;
  settings: Settings;
  onDrill: (id: string, settings: Settings) => void;
  onHome: (settings?: Settings) => void;
}) {
  const lesson = findLesson(id);
  if (!lesson) return null;
  return (
    <div className="app-shell">
      <LessonRun lesson={lesson} settings={settings} onDrill={onDrill} onHome={onHome} />
    </div>
  );
}

function LessonRun({
  lesson,
  settings: initial,
  onDrill,
  onHome,
}: {
  lesson: Lesson;
  settings: Settings;
  onDrill: (id: string, settings: Settings) => void;
  onHome: (settings?: Settings) => void;
}) {
  const [settings, setSettings] = useState(initial);
  const [dialog, setDialog] = useState(false);
  const [progress, setProgress] = useState(readProgress);
  const [current, setCurrent] = useState<number | null>(null);
  // Which puzzle of a practice step is on the board (original, then mirror).
  const [practiceAt, setPracticeAt] = useState(0);
  const status = lessonStatus(progress, lesson);
  const step = current === null ? null : lesson.steps[current];

  // In-memory progress is the source of truth, so a step completes once even
  // when the storage write fails; the write is best effort.
  const latest = useRef(progress);
  const complete = useCallback(
    (done: LessonStep) => {
      const next = withStepDone(latest.current, lesson, done, newSessionId(), Date.now());
      if (next === latest.current) return;
      latest.current = next;
      writeProgress(next);
      setProgress(next);
    },
    [lesson],
  );
  const open = (index: number | null) => {
    setCurrent(index);
    setPracticeAt(0);
  };
  const advance = current !== null && current + 1 < lesson.steps.length
    ? () => open(current + 1)
    : null;
  const side = (
    <LessonSteps lesson={lesson} status={status} current={current} onOpen={open} />
  );
  const apply = (next: Settings) => {
    setSettings(next);
    try {
      saveSettings(localStorage, next);
    } catch {
      /* Settings stay active for this session. */
    }
  };

  if (step && (step.kind === "guided" || step.kind === "practice")) {
    const queue = step.kind === "practice" ? practiceQueue(step.puzzles) : [step.puzzle];
    const last = step.kind === "guided" || practiceAt >= queue.length - 1;
    const def = queue[Math.min(practiceAt, queue.length - 1)];
    return (
      <LessonPuzzle
        key={`${step.id}-${def.id}`}
        def={def}
        guides={step.kind === "guided" ? step.guides : undefined}
        title={lesson.title}
        side={side}
        settings={settings}
        onSettingsChange={apply}
        onSolved={() => last && complete(step)}
        onNext={last ? advance : () => setPracticeAt(practiceAt + 1)}
        onHome={() => onHome(settings)}
      />
    );
  }
  return (
    <>
      <ModuleHeader title={lesson.title} onHome={() => onHome(settings)} onSettings={() => setDialog(true)} />
      <main className="lesson-layout">
        {side}
        <div className="lesson-body">
          {step === null && <LessonOverview lesson={lesson} onStart={() => open(0)} />}
          {step?.kind === "recognize" && (
            <>
              <p>{step.text}</p>
              <LessonRecognize
                key={step.id}
                rounds={step.rounds}
                name={STRUCTURES.find((s) => s.id === lesson.structureId)?.name ?? lesson.title}
                active={!dialog}
                onDone={() => complete(step)}
              />
            </>
          )}
          {step?.kind === "drill" && (
            <LessonDrillStep step={step} progress={progress} settings={settings} onDrill={onDrill} />
          )}
          {advance && step?.kind === "recognize" && status.done[current!] && (
            <button className="button primary" onClick={advance}>
              Next step
            </button>
          )}
        </div>
      </main>
      {dialog && (
        <SettingsDialog
          settings={settings}
          seed={0}
          onApply={(next) => {
            apply(next);
            setDialog(false);
          }}
          onClose={() => setDialog(false)}
        />
      )}
    </>
  );
}
