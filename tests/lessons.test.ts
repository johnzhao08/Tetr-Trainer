import { describe, expect, it } from "vitest";
import { cells } from "../src/core/board";
import type { Board } from "../src/core/board";
import { flattenGoal } from "../src/core/puzzle";
import { findDrill } from "../src/core/drillLookup";
import { lessonStatus, lessonStepRecord, practiceQueue, mirrorPuzzle } from "../src/core/lesson";
import { LESSONS, findLesson } from "../src/core/lessons";
import { validatePosition, boardFromRows } from "../src/core/position";
import { emptyProgress, recordSession } from "../src/core/progress";
import { findPlacements, findSpins } from "../src/core/spins";
import { STRUCTURES, chainSearch } from "../src/core/structures";
import { solveGuided } from "./support/guidedSolve";

const structure = (id: string) => STRUCTURES.find((s) => s.id === id)!;
const boardOfRows = (rows: readonly string[]): Board => boardFromRows(rows);
const key = (p: Parameters<typeof cells>[0]) =>
  cells(p).map(([x, y]) => y * 10 + x).sort((a, b) => a - b).join();

describe("lesson data", () => {
  it("has the seven lessons with unique ids and step ids", () => {
    expect(LESSONS.map((l) => l.id)).toEqual([
      "overhangs", "kaidan", "stsd", "tst", "triple-double", "fractal", "imperial-cross",
    ]);
    for (const l of LESSONS) {
      expect(new Set(l.steps.map((s) => s.id)).size).toBe(l.steps.length);
      expect(l.mistakes.length).toBeGreaterThan(0);
      expect(STRUCTURES.some((s) => s.id === l.structureId)).toBe(true);
      expect(findLesson(l.id)).toBe(l);
    }
  });
  it("points drill steps at real drills with a structure score", () => {
    for (const l of LESSONS)
      for (const s of l.steps)
        if (s.kind === "drill") {
          const found = findDrill(s.drillId);
          expect(found, s.drillId).not.toBeNull();
          expect(s.target).toBeGreaterThan(0);
        }
  });
  it("uses valid puzzle positions with unique ids", () => {
    const ids = new Set<string>();
    for (const l of LESSONS)
      for (const s of l.steps) {
        const defs = s.kind === "guided" ? [s.puzzle] : s.kind === "practice" ? practiceQueue(s.puzzles) : [];
        for (const d of defs) {
          expect(validatePosition(d.position), d.id).toEqual([]);
          expect(ids.has(d.id), d.id).toBe(false);
          ids.add(d.id);
        }
      }
  });
});

describe("guided builds", () => {
  it("places the ghost pieces legally and ends in the structure", () => {
    for (const l of LESSONS)
      for (const s of l.steps) {
        if (s.kind !== "guided") continue;
        const def = s.puzzle;
        let board = boardOfRows(def.position.rows);
        const fillers = def.position.queue.length - flattenGoal(def.goal).length;
        s.guides.slice(0, fillers).forEach((piece, i) => {
          const hit = findPlacements(board, piece.type).find((p) => key(p.piece) === key(piece));
          expect(hit, `${def.id} ghost ${i}`).toBeDefined();
          expect(hit!.lines, `${def.id} ghost ${i} clears`).toBe(0);
          board = hit!.after;
        });
        if (l.id === "overhangs")
          expect(findSpins(board, "T").some((m) => m.spin === "full" && m.lines === 2), def.id).toBe(true);
        else {
          const st = structure(l.structureId);
          expect(st.cue(board), `${def.id} cue`).toBe(true);
          const want = st.chain.map((c) => `${c.spin}${c.lines}`).join();
          expect(
            chainSearch(board, st.chain.length).some((c) => c.spins.map((x) => `${x.spin}${x.lines}`).join() === want),
            `${def.id} chain`,
          ).toBe(true);
        }
      }
  });
});

describe("recognition rounds", () => {
  it("has exactly one structure board per round", () => {
    for (const l of LESSONS)
      for (const s of l.steps) {
        if (s.kind !== "recognize") continue;
        const st = structure(l.structureId);
        expect(s.rounds.length).toBeGreaterThanOrEqual(2);
        for (const r of s.rounds) {
          const want = st.chain.map((c) => `${c.spin}${c.lines}`).join();
          r.boards.forEach((rows, i) => {
            const board = boardOfRows(rows);
            if (i === r.answer) {
              expect(st.cue(board), `${l.id} answer cue`).toBe(true);
              expect(
                chainSearch(board, st.chain.length).some((c) => c.spins.map((x) => `${x.spin}${x.lines}`).join() === want),
                `${l.id} answer chain`,
              ).toBe(true);
            } else expect(st.cue(board), `${l.id} board ${i} cue`).toBe(false);
          });
        }
      }
  });
});

describe("puzzles are solvable", () => {
  const cases = LESSONS.flatMap((l) =>
    l.steps.flatMap((s) => {
      if (s.kind === "guided") {
        const flip = [false, true].map((m) => [`${s.puzzle.id}${m ? "-m" : ""}`, m ? mirrorPuzzle(s.puzzle) : s.puzzle, s.guides, m] as const);
        return flip;
      }
      if (s.kind !== "practice") return [];
      return s.puzzles.flatMap((d) =>
        [false, true]
          .filter((m) => !m || !d.noMirror)
          .map((m) => [`${d.id}${m ? "-m" : ""}`, m ? mirrorPuzzle(d) : d, d.guide!, m] as const),
      );
    }),
  );
  it.each(cases)("%s", (_id, def, outline, mirrored) => {
    expect(solveGuided(def, outline, mirrored)).toBe(true);
  }, 60000);
});

describe("lesson progress", () => {
  it("marks a step done by its record or by the drill target", () => {
    const lesson = findLesson("kaidan")!;
    const empty = lessonStatus(emptyProgress(), lesson);
    expect(empty.count).toBe(0);
    expect(empty.complete).toBe(false);
    let p = recordSession(emptyProgress(), lessonStepRecord("kaidan", "build", "r1", 1));
    expect(lessonStatus(p, lesson).done).toEqual([true, false, false, false]);
    p = recordSession(p, {
      id: "d1", drillId: "kaidan-run", endedAt: 2, durationMs: 1, completed: true,
      metrics: { structureCount: 1, score: 1 },
    });
    expect(lessonStatus(p, lesson).done[3]).toBe(true);
    for (const id of ["spot", "practice"]) p = recordSession(p, lessonStepRecord("kaidan", id, `r-${id}`, 3));
    expect(lessonStatus(p, lesson).complete).toBe(true);
  });
});
