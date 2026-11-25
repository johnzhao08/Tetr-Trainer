import { describe, expect, it } from "vitest";
import { lock } from "../src/core/board";
import { reviewPlacement } from "../src/core/coach";
import { findDrill } from "../src/core/drillLookup";
import { DrillSession } from "../src/core/drillSession";
import {
  addPuzzles,
  reconcileHarvest,
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
import type { Piece } from "../src/core/board";
import type { Spin } from "../src/core/attack";
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
function sloppy(seed: number, id: string, endedAt: number, d = drill) {
  const s = new DrillSession(d, seed, defaultSettings());
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
      expect(p.goal).toEqual({ kind: "band", atLeast: "good" });
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
      expect(def.themes.length).toBe(new Set(kinds).size);
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
      // The guide may be a spin, which the engine only accepts claimed as such.
      const placed = [null, "mini", "full"].some((spin) => {
        session.retry();
        return session.game.placeAt(guide, held, spin as null);
      });
      expect(placed).toBe(true);
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
    expect(saveMoment(store(), rec, flagged)).toBe("saved");
    expect(clean).toBeGreaterThanOrEqual(0);
    expect(saveMoment(store(), rec, clean)).toBe("none");
    expect(saveMoment(store(), rec, 999)).toBe("none");
  });
});

describe("harvest review fixes", () => {
  const noHold = findDrill("no-hold-40l")!.drill;

  it("never offers hold for a no-hold drill", () => {
    let seen = 0;
    for (let seed = 1; seed <= 8 && seen === 0; seed++) {
      for (const p of harvestRecord(sloppy(seed, `n${seed}`, seed, noHold))) {
        seen++;
        expect(p.allowHold).toBe(false);
        expect(p.guide![0].type).toBe(p.position.queue[0]);
        expect(p.explanation).not.toMatch(/hold, then/i);
        expect(p.position.hold).toBeNull();
      }
    }
    expect(seen).toBeGreaterThan(0);
    // The same positions in a hold-allowed drill do not set the flag.
    const p = harvestRecord(sloppy(11, "h", 1))[0];
    expect(p.allowHold).toBeUndefined();
  }, 60_000);

  it("grades a harvested puzzle by the coach band, not the original flags", () => {
    const puzzles = harvestRecord(sloppy(11, "g", 1));
    expect(puzzles.length).toBeGreaterThan(0);
    let solved = 0;
    let failed = 0;
    for (const def of puzzles.slice(0, 4)) {
      for (let rot = 0; rot < 4; rot++)
        for (let dx = -5; dx <= 5; dx++) {
          const s = new PuzzleSession(def, 1, defaultSettings());
          for (let i = 0; i < rot; i++) press(s as never, "cw");
          for (let i = 0; i < Math.abs(dx); i++) press(s as never, dx < 0 ? "left" : "right");
          press(s as never, "hardDrop");
          const band = s.reviews[0]?.band;
          if (!band) continue;
          const ok = band === "best" || band === "good";
          expect(s.status).toBe(ok ? "solved" : "failed");
          if (ok) solved++;
          else failed++;
        }
    }
    expect(solved).toBeGreaterThan(0);
    expect(failed).toBeGreaterThan(0);
  }, 60_000);

  it("themes dig flags from cheese reviews", () => {
    const meta = { id: "d", drillTitle: "t" };
    const steps = replaySession(sloppy(11, "dg", 1))!.steps;
    const step = steps.find((st) => puzzleFromStep(st, meta));
    expect(step).toBeDefined();
    const dig = {
      ...step!,
      review: {
        ...step!.review,
        flags: [{ kind: "wasted-i" as const }, { kind: "hold-fit" as const, piece: "T" as const }],
      },
    };
    const def = puzzleFromStep(dig, meta)!;
    expect(def.themes).toEqual(["Wasted I pieces", "Missed holds"]);
  });

  it("reports a failed storage write instead of success", () => {
    const rec = sloppy(11, "sv", 1);
    const steps = replaySession(rec)!.steps;
    const meta = { id: "z", drillTitle: "t" };
    const i = steps.findIndex((st) => puzzleFromStep(st, meta, true));
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(saveMoment(broken, rec, i)).toBe("failed");
    expect(addPuzzles(broken, [])).toBe(false);
    expect(saveMoment(store(), rec, i)).toBe("saved");
    expect(saveMoment(store(), rec, 999)).toBe("none");
  });

  it("reconciles replayable sessions that were never harvested", () => {
    const a = sloppy(11, "ra", 1000);
    const b = sloppy(7, "rb", 2000);
    const s = store();
    const first = reconcileHarvest(s, [a, b]);
    expect(first.length).toBeGreaterThan(0);
    expect(first.some((p) => p.id.startsWith("h-rb-") || p.id.startsWith("h-ra-"))).toBe(true);
    // Idempotent: nothing is re-added, even after puzzles were evicted.
    expect(reconcileHarvest(s, [a, b])).toEqual(first);
    const raw = JSON.parse(s.m.get(PUZZLES_KEY)!);
    expect(raw.processed).toEqual(expect.arrayContaining(["ra", "rb"]));
    raw.puzzles = [];
    s.m.set(PUZZLES_KEY, JSON.stringify(raw));
    expect(reconcileHarvest(s, [a, b])).toEqual([]);
    // A session already harvested on finish is not duplicated.
    const t = store();
    addPuzzles(t, harvestRecord(a), ["ra"]);
    expect(reconcileHarvest(t, [a])).toEqual(loadPuzzles(t));
    // A failed write leaves sessions unprocessed so the next load retries.
    const bad = { getItem: () => null, setItem: () => { throw new Error("x"); } };
    expect(reconcileHarvest(bad, [a]).length).toBeGreaterThan(0);
  }, 60_000);

  it("grades cheese drills with the dig penalty", () => {
    const cheese = findDrill("cheese-10")!.drill;
    // Seed 4: the first L costs 3 lines to dig; no placement instead is clean.
    const s = new DrillSession(cheese, 4, defaultSettings());
    press(s, "hardDrop");
    expect(s.reviews[0].band).toBe("mistake");
    const rec = s.record("l", 1);
    expect(harvestRecord(rec)).toEqual([]);
    const first = replaySession(rec)!.steps[0];
    expect(puzzleFromStep(first, { id: "a", drillTitle: "t", dig: true }, true)).toBeNull();
    // A move that already passes the grader is no puzzle; harvested ones fail it.
    const fine = { ...first, review: { ...first.review, penalty: 0, band: "good" as const } };
    expect(puzzleFromStep(fine, { id: "b", drillTitle: "t" }, true)).toBeNull();
    let checked = 0;
    for (const seed of [1, 2, 3, 5]) {
      const steps = replaySession(sloppy(seed, `c${seed}`, 1, cheese))!.steps;
      steps.forEach((step, i) => {
        const def = puzzleFromStep(step, { id: `c${i}`, drillTitle: "t", dig: true });
        if (!def) return;
        checked++;
        const kept = store();
        expect((addPuzzles(kept, [def]), loadPuzzles(kept)[0].dig)).toBe(true);
        const play = (pose: Piece, held: boolean, spin: Spin) => {
          const p = new PuzzleSession(def, 1, defaultSettings());
          const ok = p.game.placeAt(pose, held, spin);
          p.tick(0);
          return ok ? p.status : "illegal";
        };
        const { landing, held, spin } = step.placement;
        expect(play(landing, held, spin)).toBe("failed");
        const g = def.guide![0];
        const tries = [null, "mini", "full"] as Spin[];
        expect(tries.map((c) => play(g, g.type !== step.current, c))).toContain("solved");
      });
    }
    expect(checked).toBeGreaterThan(0);
  }, 60_000);
});
