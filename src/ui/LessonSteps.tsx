import type { Lesson } from "../core/lesson";
import type { LessonStatus } from "../core/lesson";

const KIND_NAMES = {
  guided: "Guided",
  recognize: "Recognize",
  practice: "Practice",
  drill: "Drill",
} as const;

/** The lesson's steps with completion; `current` is null on the overview. */
export function LessonSteps({
  lesson,
  status,
  current,
  onOpen,
}: {
  lesson: Lesson;
  status: LessonStatus;
  current: number | null;
  onOpen: (index: number | null) => void;
}) {
  return (
    <nav className="lesson-steps" aria-label={`${lesson.title} steps`}>
      <h2>{lesson.title}</h2>
      <p className="key-help">
        {status.count} of {lesson.steps.length} steps done
      </p>
      <ol>
        <li>
          <button
            className={`button quiet${current === null ? " current" : ""}`}
            aria-current={current === null ? "step" : undefined}
            onClick={() => onOpen(null)}
          >
            Overview
          </button>
        </li>
        {lesson.steps.map((step, i) => (
          <li key={step.id}>
            <button
              className={`button quiet${current === i ? " current" : ""}`}
              aria-current={current === i ? "step" : undefined}
              onClick={() => onOpen(i)}
            >
              <span aria-hidden="true">{status.done[i] ? "✓" : "○"}</span>{" "}
              {step.title}
              <span className="step-note"> {KIND_NAMES[step.kind]}</span>
              <span className="visually-hidden">{status.done[i] ? ", done" : ", not done"}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
