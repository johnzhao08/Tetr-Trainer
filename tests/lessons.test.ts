import { describe, expect, it } from "vitest";
import { cells } from "../src/core/board";
import type { Board } from "../src/core/board";
import { PuzzleSession, flattenGoal } from "../src/core/puzzle";
import { defaultSettings } from "../src/core/settings";
import { findDrill } from "../src/core/drillLookup";
import { LESSON_HOLE_CAP, lessonStatus, lessonStepRecord, practiceQueue, mirrorPuzzle } from "../src/core/lesson";
import { LESSONS, findLesson } from "../src/core/lessons";
import { validatePosition, boardFromRows } from "../src/core/position";
import { emptyProgress, METRIC_INFO, recordSession } from "../src/core/progress";
import { LESSON_DRILLS } from "../src/core/lessonDrills";
import { STAGES } from "../src/core/curriculum";
import { findPlacements, findSpins } from "../src/core/spins";
import { KAIDAN_PARITY, STRUCTURES, chainSearch } from "../src/core/structures";
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

describe("prompts", () => {
  const defs = LESSONS.flatMap((l) =>
    l.steps.flatMap((s) =>
      s.kind === "guided" ? [s.puzzle] : s.kind === "practice" ? practiceQueue(s.puzzles) : [],
    ),
  );
  it("name only pieces in the queue, and no side on a mirror", () => {
    for (const d of defs) {
      const text = `${d.prompt} ${d.hint ?? ""}`;
      const named = text.match(/\b[IJLOSTZ]\b/g) ?? [];
      for (const piece of named) expect(d.position.queue, `${d.id} names ${piece}`).toContain(piece);
      if (d.id.endsWith("-m")) expect(text, d.id).not.toMatch(/\b(left|right)\b/i);
    }
  });
  it("gives each structure one piece-neutral prompt that ends at its goal", () => {
    for (const l of LESSONS) {
      const [build, , practice] = l.steps;
      if (build.kind !== "guided" || practice.kind !== "practice" || !l.structureId || l.id === "overhangs") continue;
      for (const d of [build.puzzle, ...practiceQueue(practice.puzzles)]) {
        expect(d.prompt, d.id).not.toMatch(/fire the spins/i);
        expect(d.prompt, d.id).not.toMatch(/\b[IJLOSTZ]\b/);
        expect(d.prompt, d.id).not.toMatch(/\bagain\b/i);
        expect(d.prompt.match(/\bthen\b/gi)?.length ?? 0, d.id).toBeLessThanOrEqual(1);
      }
      expect(build.puzzle.prompt, l.id).toBe(practice.puzzles[0].prompt);
    }
    const kaidan = findLesson("kaidan")!.steps[0];
    if (kaidan.kind !== "guided") throw new Error("shape");
    expect(kaidan.puzzle.prompt).toMatch(/quad down the reopened well\.$/);
  });
  it("turns Hold off for guided builds so the ghosts stay in order", () => {
    for (const l of LESSONS)
      for (const s of l.steps) {
        if (s.kind !== "guided") continue;
        expect(s.puzzle.allowHold, s.puzzle.id).toBe(false);
        const session = new PuzzleSession(s.puzzle, 1, defaultSettings());
        const first = session.game.state.active!.type;
        session.keyDown("hold");
        session.keyUp("hold");
        expect(session.game.state.active!.type, s.puzzle.id).toBe(first);
      }
  });
});

describe("kaidan lesson", () => {
  const kaidan = findLesson("kaidan")!;
  it("starts from the sourced parity board and ends in the quad", () => {
    const [build, , practice] = kaidan.steps;
    if (build.kind !== "guided" || practice.kind !== "practice") throw new Error("shape");
    expect(flattenGoal(build.puzzle.goal).map((g) => g.kind)).toEqual(["tspin", "clear"]);
    expect(build.puzzle.position.queue).toEqual(["T", "I"]);
    expect(build.puzzle.position.rows).toEqual(KAIDAN_PARITY);
    expect(practice.puzzles[0].position.rows).toEqual(KAIDAN_PARITY);
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
          // The Kaidan parity board (diagram 11) is a mid-board stair; the edge
          // stair cue is for diagram 0.
          if (l.id !== "kaidan") expect(st.cue(board), `${def.id} cue`).toBe(true);
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

describe("guided replay", () => {
  it("fails when a ghost is moved off its square", () => {
    const step = findLesson("tst")!.steps[0];
    if (step.kind !== "guided") throw new Error("shape");
    const guides = step.guides.map((g, i, all) => (i === all.length - 1 ? { ...g, x: g.x + 1 } : g));
    expect(solveGuided(step.puzzle, step.guides, false)).toBe(true);
    expect(solveGuided(step.puzzle, guides, false)).toBe(false);
  });
});

describe("lesson progress", () => {
  const run = (drillId: string, metrics: Record<string, number>, completed = true) => ({
    id: `d-${drillId}-${JSON.stringify(metrics)}`, drillId, endedAt: 2, durationMs: 1, completed, metrics,
  });
  it("marks a step done by its record, a drill step by a clean qualifying run", () => {
    const lesson = findLesson("kaidan")!;
    const empty = lessonStatus(emptyProgress(), lesson);
    expect(empty.count).toBe(0);
    expect(empty.complete).toBe(false);
    let p = recordSession(emptyProgress(), lessonStepRecord("kaidan", "build", "r1", 1));
    expect(lessonStatus(p, lesson).done).toEqual([true, false, false, false]);
    p = recordSession(p, run("kaidan-run", { structureCount: 1, holesPer100: 2, score: 1 }));
    expect(lessonStatus(p, lesson).done[3]).toBe(true);
    for (const id of ["spot", "practice"]) p = recordSession(p, lessonStepRecord("kaidan", id, `r-${id}`, 3));
    expect(lessonStatus(p, lesson).complete).toBe(true);
  });
  it("rejects a drill run that misses the target, has no holes metric, or is too sloppy", () => {
    const lesson = findLesson("kaidan")!;
    const drillDone = (r: ReturnType<typeof run>) =>
      lessonStatus(recordSession(emptyProgress(), r), lesson).done[3];
    expect(drillDone(run("kaidan-run", { structureCount: 0, holesPer100: 1 }))).toBe(false);
    expect(drillDone(run("kaidan-run", { structureCount: 3 }))).toBe(false);
    expect(drillDone(run("kaidan-run", { structureCount: 3, holesPer100: LESSON_HOLE_CAP + 1 }))).toBe(false);
    expect(drillDone(run("kaidan-run", { structureCount: 3, holesPer100: 0 }, false))).toBe(false);
    expect(drillDone(run("kaidan-run", { structureCount: 3, holesPer100: LESSON_HOLE_CAP }))).toBe(true);
  });
  it("ignores imported markers with empty metrics, and markers for a drill step", () => {
    const lesson = findLesson("kaidan")!;
    const marker = (stepId: string, metrics: Record<string, number>) => ({
      ...lessonStepRecord("kaidan", stepId, `m-${stepId}`, 1), metrics,
    });
    let p = recordSession(emptyProgress(), marker("build", {}));
    p = recordSession(p, marker("spot", { score: 2 }));
    p = recordSession(p, lessonStepRecord("kaidan", "drill", "m-drill", 1));
    expect(lessonStatus(p, lesson).count).toBe(0);
  });
});

describe("lesson drills", () => {
  it("are in a stage and score structureCount", () => {
    const staged = new Set(STAGES.flatMap((s) => s.drills.map((d) => d.id)));
    for (const d of LESSON_DRILLS) {
      expect(staged.has(d.id), d.id).toBe(true);
      expect(d.primary).toBe("structureCount");
      expect(d.structure).toBeDefined();
    }
    expect(METRIC_INFO.structureCount.format(2)).toBe("2");
  });
  it("gives each structure its own drill", () => {
    const kinds = LESSON_DRILLS.map((d) => d.structure);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
