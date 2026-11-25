import type { Piece, Tetromino } from "./board";
import { findDrill } from "./drillLookup";
import type { Goal, PuzzleDef } from "./puzzle";
import { mirrorPosition } from "./position";
import { sessionsFor } from "./progress";
import type { Progress, SessionRecord } from "./progress";

/** Four boards, exactly one of which holds the structure. */
export type RecognizeRound = {
  boards: readonly [string[], string[], string[], string[]];
  answer: 0 | 1 | 2 | 3;
  /** Why the answer is the structure and the others are not. */
  note: string;
};

export type LessonStep = { id: string; title: string; text: string } & (
  | {
      /** Build the structure from a stack with a fixed queue; ghosts show each placement in order. */
      kind: "guided";
      puzzle: PuzzleDef;
      guides: readonly Piece[];
    }
  | { kind: "recognize"; rounds: readonly RecognizeRound[] }
  | {
      /** Build and fire from a start with no ghosts; the mirror is added automatically. */
      kind: "practice";
      puzzles: readonly PuzzleDef[];
    }
  | {
      /** A random-bag drill; done once its primary metric reaches `target`. */
      kind: "drill";
      drillId: string;
      target: number;
    }
);
export type StepKind = LessonStep["kind"];

export type Lesson = {
  id: string;
  /** The `Structure.id` this lesson teaches. */
  structureId: string;
  title: string;
  summary: string;
  why: string;
  whenToUse: string;
  mistakes: string[];
  steps: LessonStep[];
};

/** Left-right mirror of a puzzle; the id gets an `-m` suffix and the guide is dropped. */
export function mirrorPuzzle(def: PuzzleDef): PuzzleDef {
  const { guide: _guide, ...rest } = def;
  void _guide;
  return {
    ...rest,
    id: `${def.id}-m`,
    title: `${def.title} (mirrored)`,
    position: mirrorPosition(def.position),
  };
}

/** The puzzles a practice step plays: each one, then its mirror unless `noMirror`. */
export function practiceQueue(defs: readonly PuzzleDef[]): PuzzleDef[] {
  return defs.flatMap((d) => (d.noMirror ? [d] : [d, mirrorPuzzle(d)]));
}

/**
 * Puzzle for a build: `place` fills the stack, then one T per spin step, then
 * the `after` pieces (an I for the quad). Hold is off on a guided build, since
 * the ghosts follow the queue in order.
 */
export function buildPuzzle(opts: {
  id: string;
  title: string;
  prompt: string;
  hint?: string;
  explanation: string;
  rows: string[];
  place: readonly Tetromino[];
  spins: number;
  after?: readonly Tetromino[];
  goal: Goal;
  guide?: Piece[];
  noMirror?: boolean;
  allowHold?: boolean;
}): PuzzleDef {
  const { rows, place, spins, after = [], ...rest } = opts;
  const queue = [...place, ...Array<Tetromino>(spins).fill("T"), ...after];
  return {
    themes: ["Lessons"],
    ...rest,
    position: { rows, queue },
    pieceLimit: queue.length + 1,
  };
}

/** Progress key for a lesson step. */
export const lessonDrillId = (lessonId: string, stepId: string) =>
  `lesson:${lessonId}:${stepId}`;

export function lessonStepRecord(
  lessonId: string,
  stepId: string,
  id: string,
  endedAt: number,
): SessionRecord {
  return {
    id,
    drillId: lessonDrillId(lessonId, stepId),
    endedAt,
    durationMs: 0,
    completed: true,
    metrics: { score: 1 },
  };
}

/** Holes per 100 pieces a drill run may show and still finish a lesson step. */
export const LESSON_HOLE_CAP = 4;

/**
 * A non-drill step is done by its own marker record (a completed score of 1).
 * A drill step is done only by a completed run of its drill that reaches the
 * target with holes per 100 pieces under the cap; markers never count for it.
 */
export function stepDone(
  progress: Progress,
  lesson: Lesson,
  step: LessonStep,
): boolean {
  if (step.kind !== "drill")
    return sessionsFor(progress, lessonDrillId(lesson.id, step.id)).some(
      (s) => s.completed && s.metrics.score === 1,
    );
  const found = findDrill(step.drillId);
  if (!found) return false;
  const { id, primary } = found.drill;
  return sessionsFor(progress, id).some(
    (s) =>
      s.completed &&
      (s.metrics[primary] ?? -Infinity) >= step.target &&
      (s.metrics.holesPer100 ?? Infinity) <= LESSON_HOLE_CAP,
  );
}

export type LessonStatus = { done: boolean[]; count: number; complete: boolean };

export function lessonStatus(progress: Progress, lesson: Lesson): LessonStatus {
  const done = lesson.steps.map((s) => stepDone(progress, lesson, s));
  const count = done.filter(Boolean).length;
  return { done, count, complete: count === done.length };
}
