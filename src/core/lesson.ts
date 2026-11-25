import type { Piece, Tetromino } from "./board";
import { findDrill, drillBest } from "./drillLookup";
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

/** Puzzle for a build: `place` fills the stack, then one T per spin step. */
export function buildPuzzle(opts: {
  id: string;
  title: string;
  prompt: string;
  hint?: string;
  explanation: string;
  rows: string[];
  place: readonly Tetromino[];
  spins: number;
  goal: Goal;
  guide?: Piece[];
  noMirror?: boolean;
}): PuzzleDef {
  const { rows, place, spins, ...rest } = opts;
  const queue = [...place, ...Array<Tetromino>(spins).fill("T")];
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

/** A step is done by its own record; a drill step also by its drill's best. */
export function stepDone(
  progress: Progress,
  lesson: Lesson,
  step: LessonStep,
): boolean {
  if (
    sessionsFor(progress, lessonDrillId(lesson.id, step.id)).some(
      (s) => s.completed,
    )
  )
    return true;
  if (step.kind !== "drill") return false;
  const found = findDrill(step.drillId);
  if (!found) return false;
  const best = drillBest(progress, found.drill);
  return best !== null && best >= step.target;
}

export type LessonStatus = { done: boolean[]; count: number; complete: boolean };

export function lessonStatus(progress: Progress, lesson: Lesson): LessonStatus {
  const done = lesson.steps.map((s) => stepDone(progress, lesson, s));
  const count = done.filter(Boolean).length;
  return { done, count, complete: count === done.length };
}
