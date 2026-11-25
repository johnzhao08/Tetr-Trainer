import { describe, expect, it } from "vitest";
import { lock } from "../src/core/board";
import { reviewPlacement } from "../src/core/coach";
import { findDrill } from "../src/core/drillLookup";
import { DrillSession } from "../src/core/drillSession";
import {
  addPuzzles,
  betterPlacement,
  harvestPuzzles,
  harvestRecord,
  loadPuzzles,
  MAX_HARVEST,
  mergePuzzles,
  puzzleFromStep,
  saveMoment,
  PUZZLES_KEY,
  SET_SIZE,
  themeCounts,
} from "../src/core/harvest";
import { createRun, finishRun } from "../src/core/drillRun";
import { boardFromRows } from "../src/core/position";
import { PuzzleSession } from "../src/core/puzzle";
import type { PuzzleDef } from "../src/core/puzzle";
import { replaySession } from "../src/core/replay";
import { defaultSettings } from "../src/core/settings";
import type { Action } from "../src/core/settings";

const press = (s: DrillSession, action: Action) => {
  s.keyDown(action);
  s.keyUp(action);
};
const drill = findDrill("clean-100")!.drill;

/** Careless play that stacks badly, so the coach finds mistakes. */
function sloppy(seed: number, id: string, endedAt: number) {
  const s = new DrillSession(drill, seed, defaultSettings());
  for (let n = 0; n < 60 && s.status === "playing"; n++) {
    const k = (n * 5 + seed) % 9;
    if (k === 0) press(s, "hold");
    for (let i = 0; i < k % 4; i++) press(s, "cw");
    for (let i = 0; i < k; i++) press(s, k % 2 ? "left" : "right");
    press(s, "hardDrop");
  }
  return s.record(id, endedAt);
}

const store = () => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe("harvest", () => {
  const record = sloppy(11, "r1", 1000);
  const puzzles = harvestRecord(record);

  it("finds puzzles in sloppy play", () => {
    expect(puzzles.length).toBeGreaterThan(0);
    for (const p of puzzles) {
      expect(p.source).toBe("session");
      expect(p.goal.kind).toBe("noFlag");
      expect(p.pieceLimit).toBe(1);
    }
  });

  it("only harvests mistakes and blunders, with the player's flag kinds as themes", () => {
    const steps = replaySession(record)!.steps;
    const mistakes = steps.filter((s) => s.review.band === "mistake" || s.review.band === "blunder");
    const expected = mistakes.filter((s) => s.review.flags.length > 0 && puzzleFromStep(s, { id: "x", drillTitle: "t" }));
    expect(puzzles).toHaveLength(expected.length);
    for (const step of steps) {
      const def = puzzleFromStep(step, { id: "x", drillTitle: "t" });
      if (!def) continue;
      expect(["mistake", "blunder"]).toContain(step.review.band);
      const kinds = step.review.flags.map((f) => f.kind);
      if (def.goal.kind === "noFlag") expect([...def.goal.kinds].sort()).toEqual([...new Set(kinds)].sort());
      if (kinds.includes("hole")) expect(def.themes[0]).toBe("Holes");
    }
    // A fine placement is never a puzzle.
    const fine = steps.find((s) => s.review.band === "best" || s.review.band === "good");
    if (fine) expect(puzzleFromStep(fine, { id: "y", drillTitle: "t" })).toBeNull();
  });

  it("is solvable: the shown better placement is best or good and solves it", () => {
    for (const def of puzzles) {
      const board = boardFromRows(def.position.rows);
      const guide = def.guide![0];
      const current = def.position.queue[0];
      const held = guide.type !== current;
      const after = lock(board, guide);
      const review = reviewPlacement(board, after.board, { cleared: after.cleared });
      expect(["best", "good"]).toContain(review.band);
      // And the real puzzle engine accepts it.
      const session = new PuzzleSession(def, 1, defaultSettings());
      expect(session.game.placeAt(guide, held, null)).toBe(true);
      session.tick(0);
      expect(session.status).toBe("solved");
    }
  });

  it("betterPlacement is null when every placement leaves a hole", () => {
    // Every O lands across one filled and one empty column.
    expect(betterPlacement(boardFromRows(["X.X.X.X.X."]), "O", null)).toBeNull();
    const flat = betterPlacement(boardFromRows(["XXXXXXXX.."]), "O", null)!;
    expect(["best", "good"]).toContain(flat.review.band);
  });

  it("dedupes similar positions and caps newest first", () => {
    const again = { ...record, id: "r2", endedAt: 2000 };
    expect(harvestPuzzles([record, again]).length).toBe(harvestPuzzles([record]).length);
    const many: PuzzleDef[] = Array.from({ length: MAX_HARVEST + 10 }, (_, i) => ({
      ...puzzles[0],
      id: `p${i}`,
      position: {
        ...puzzles[0].position,
        rows: [...puzzles[0].position.rows, ".".repeat(10)].map((r, j, a) =>
          j === a.length - 1 ? "X".repeat(i % 9) + ".".repeat(10 - (i % 9)) : r,
        ),
      },
    }));
    const merged = mergePuzzles(many, []);
    expect(merged.length).toBeLessThanOrEqual(MAX_HARVEST);
    expect(merged[0].id).toBe("p0");
    expect(new Set(merged.map((p) => p.id)).size).toBe(merged.length);
  });

  it("stores, reloads and rejects bad puzzles", () => {
    const s = store();
    addPuzzles(s, puzzles);
    expect(loadPuzzles(s)).toEqual(mergePuzzles(puzzles, []));
    const bad = JSON.parse(s.m.get(PUZZLES_KEY)!);
    bad.puzzles[0].position.rows[0] = "nope";
    bad.puzzles[0].goal = { kind: "tspin", lines: 2 };
    s.m.set(PUZZLES_KEY, JSON.stringify(bad));
    expect(loadPuzzles(s).length).toBe(mergePuzzles(puzzles, []).length - 1);
    s.m.set(PUZZLES_KEY, "garbage");
    expect(loadPuzzles(s)).toEqual([]);
  });

  it("counts themes and sets are bounded", () => {
    const counts = themeCounts(puzzles);
    expect(counts.reduce((n, c) => n + c.count, 0)).toBe(puzzles.length);
    expect(SET_SIZE).toBe(10);
  });

  it("saves mistakes when a run finishes and saves a chosen moment", () => {
    const s = store();
    const run = createRun(drill, 11, defaultSettings());
    // Same scripted play as `sloppy`, through the run's own session.
    for (let n = 0; n < 60 && run.session.status === "playing"; n++) {
      const k = (n * 5 + 11) % 9;
      if (k === 0) press(run.session, "hold");
      for (let i = 0; i < k % 4; i++) press(run.session, "cw");
      for (let i = 0; i < k; i++) press(run.session, k % 2 ? "left" : "right");
      press(run.session, "hardDrop");
    }
    finishRun(s, run, "fin", 5);
    expect(loadPuzzles(s).length).toBeGreaterThan(0);
    expect(loadPuzzles(s).every((p) => p.id.startsWith("h-fin-"))).toBe(true);
    // A flagged moment can be saved on request; a clean one cannot.
    const rec = run.session.record("fin", 5);
    const steps = replaySession(rec)!.steps;
    const meta = { id: "z", drillTitle: "t" };
    const flagged = steps.findIndex((st) => puzzleFromStep(st, meta, true));
    const clean = steps.findIndex((st) => st.review.flags.length === 0);
    expect(flagged).toBeGreaterThanOrEqual(0);
    expect(saveMoment(store(), rec, flagged)).toBe(true);
    expect(clean).toBeGreaterThanOrEqual(0);
    expect(saveMoment(store(), rec, clean)).toBe(false);
    expect(saveMoment(store(), rec, 999)).toBe(false);
  });
});
