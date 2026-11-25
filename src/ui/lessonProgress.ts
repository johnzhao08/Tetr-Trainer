import { lessonStepRecord, stepDone } from "../core/lesson";
import type { Lesson, LessonStep } from "../core/lesson";
import { recordSession } from "../core/progress";
import type { Progress } from "../core/progress";

/**
 * Progress with `step` recorded, or the same object when it is already done,
 * so a repeated completion changes no state and cannot re-trigger itself.
 */
export function withStepDone(
  progress: Progress,
  lesson: Lesson,
  step: LessonStep,
  recordId: string,
  now: number,
): Progress {
  if (stepDone(progress, lesson, step)) return progress;
  return recordSession(progress, lessonStepRecord(lesson.id, step.id, recordId, now));
}

/** A step this screen finished, kept until it is known to be in storage. */
export type StepMark = { step: LessonStep; recordId: string; at: number };

/**
 * Finish `step` against freshly read progress rather than the snapshot from
 * mount, so records another tab wrote meanwhile are kept. Marks from earlier
 * in this screen are applied again, so a step whose write failed is not lost;
 * marks already present are no-ops. Returns null when this screen already
 * marked the step, so a repeated completion changes nothing.
 */
export function commitStep(
  io: { read: () => Progress; write: (p: Progress) => unknown },
  marks: readonly StepMark[],
  lesson: Lesson,
  step: LessonStep,
  recordId: string,
  now: number,
): { progress: Progress; marks: StepMark[] } | null {
  if (marks.some((m) => m.step.id === step.id)) return null;
  const all = [...marks, { step, recordId, at: now }];
  const fresh = io.read();
  const progress = all.reduce(
    (p, m) => withStepDone(p, lesson, m.step, m.recordId, m.at),
    fresh,
  );
  if (progress !== fresh) io.write(progress);
  return { progress, marks: all };
}
