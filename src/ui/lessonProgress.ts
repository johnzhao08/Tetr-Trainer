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
