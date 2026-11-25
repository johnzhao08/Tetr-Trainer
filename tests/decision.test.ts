import { describe, expect, it } from "vitest";
import type { Placement } from "../src/core/game";
import { compare, MIN_MARGIN, scoreLine, summarize } from "../src/core/decision";
import type { Comparison, LineResult } from "../src/core/decision";
import {
  buildScenario,
  decisionRecord,
  DECISION_SEEDS,
  DECISIONS,
  findSeeds,
  KIND_ANSWER,
} from "../src/core/decisions";
import { DrillSession } from "../src/core/drillSession";
import { Opponent } from "../src/core/opponent";
import { boardFromRows, validatePosition } from "../src/core/position";
import { emptyProgress, METRIC_INFO, recordSession } from "../src/core/progress";
import { PuzzleSession } from "../src/core/puzzle";
import { MINI_PUZZLES } from "../src/core/puzzles";
import { defaultSettings } from "../src/core/settings";
import { findSpins, pathToInputs } from "../src/core/spins";
import { findDrill } from "../src/core/drillLookup";

describe("decision scenarios", () => {
  it("has 12 scenarios, four of each kind, with unique ids", () => {
    expect(DECISIONS).toHaveLength(12);
    expect(new Set(DECISIONS.map((s) => s.id)).size).toBe(12);
    for (const kind of ["spike", "cancel", "calm"] as const)
      expect(DECISIONS.filter((s) => s.kind === kind)).toHaveLength(4);
  });
  it("starts from valid positions with Surge charged", () => {
    for (const s of DECISIONS) {
      expect(validatePosition({ rows: s.rows, queue: s.queue }), s.id).toEqual([]);
      expect(s.b2b, s.id).toBeGreaterThanOrEqual(4);
      expect(s.queue.length, s.id).toBeGreaterThanOrEqual(8);
    }
  });
  it("matches its kind: tall opponent, garbage on the way, or a quiet board", () => {
    for (const s of DECISIONS) {
      const o = new Opponent(s.opponent.seed, { ...s.opponent, surge: true });
      if (s.kind === "spike") expect(o.state.height, s.id).toBeGreaterThanOrEqual(12);
      else expect(o.state.height, s.id).toBeLessThan(8);
      expect(s.incoming.length > 0, s.id).toBe(s.kind === "cancel");
    }
  });
});

describe("simulation", () => {
  it("is deterministic and leaves the scenario untouched", () => {
    const s = DECISIONS[0];
    const copy = structuredClone(s);
    const first = compare(s);
    expect(compare(s)).toEqual(first);
    expect(s).toEqual(copy);
  });
  it("breaks the chain on the Break line and keeps it on the Keep line", () => {
    for (const s of DECISIONS) {
      const c = compare(s);
      expect(c.break.b2b, s.id).toBeLessThan(s.b2b);
      expect(c.keep.b2b, s.id).toBeGreaterThanOrEqual(s.b2b);
    }
  });
  it("scores KO, death, sent, received and banked Surge", () => {
    const base = {
      sent: 6, received: 2, ko: false, died: false, b2b: 7, banked: 7,
      myHeight: 5, oppHeight: 9,
    };
    expect(scoreLine(base)).toBe(11);
    expect(scoreLine({ ...base, ko: true })).toBe(61);
    expect(scoreLine({ ...base, died: true })).toBe(-39);
  });
  it("formats the played-out comparison", () => {
    const r = (sent: number, ko: boolean): LineResult => ({
      sent, received: 0, ko, died: false, b2b: 0, banked: 0, myHeight: 4, oppHeight: 8, score: 0,
    });
    const c: Comparison = { break: r(9, true), keep: r(6, false), answer: "break", margin: 40 };
    expect(summarize(c)).toBe("Breaking now sent 9 and topped them out; keeping sent 6.");
  });
});

describe("answer keys", () => {
  it("are stored, stable and clear", () => {
    for (const [i, d] of DECISION_SEEDS.entries()) {
      const c = compare(DECISIONS[i]);
      expect(c.answer, DECISIONS[i].id).toBe(d.answer);
      expect(d.answer).toBe(KIND_ANSWER[d.kind]);
      expect(c.margin, DECISIONS[i].id).toBeGreaterThanOrEqual(MIN_MARGIN);
    }
  });
  it("only publishes seeds past the margin threshold", () => {
    // spike seed 1 plays out to a gap below MIN_MARGIN, so it is never picked.
    expect(compare(buildScenario("spike", 1)).margin).toBeLessThan(MIN_MARGIN);
    for (const kind of ["spike", "cancel", "calm"] as const)
      expect(findSeeds(kind, 4)).toEqual(
        DECISION_SEEDS.filter((d) => d.kind === kind).map((d) => d.seed),
      );
  });
});

describe("opponent start", () => {
  it("begins with the given stack, garbage and chain", () => {
    const o = new Opponent(1, { apm: 30, start: { stack: 5, dirt: 8, b2b: 3 } });
    expect(o.state.height).toBe(13);
    expect(o.state.b2b).toBe(3);
  });
});

describe("decision progress", () => {
  it("records score and accuracy under decision:<set>", () => {
    const rec = decisionRecord("a", 10, 9, 12, 4000);
    expect(rec.drillId).toBe("decision:surge");
    expect(rec.metrics).toEqual({ score: 9, accuracy: 0.75 });
    expect(recordSession(emptyProgress(), rec).sessions).toHaveLength(1);
  });
  it("rejects an accuracy above 1 and explains the new metrics", () => {
    const bad = { ...decisionRecord("b", 10, 9, 12, 0), metrics: { accuracy: 1.5 } };
    expect(recordSession(emptyProgress(), bad).sessions).toHaveLength(0);
    for (const id of ["b2bBreaks", "accuracy"] as const)
      expect(METRIC_INFO[id].explain.length).toBeGreaterThan(40);
  });
});

describe("all-mini B2B keepers", () => {
  const settings = { ...defaultSettings(), instantSoftDrop: false };
  it("has a non-T mini spin that clears lines on every board", () => {
    for (const p of MINI_PUZZLES) {
      const piece = p.position.queue[0];
      expect(piece, p.id).not.toBe("T");
      const found = findSpins(boardFromRows(p.position.rows), piece);
      expect(found.some((s) => s.spin === "mini" && s.lines > 0), p.id).toBe(true);
    }
  });
  it("is solved by replaying a found spin through the engine, and by nothing else", () => {
    for (const p of MINI_PUZZLES) {
      const piece = p.position.queue[0];
      const board = boardFromRows(p.position.rows);
      const spin = findSpins(board, piece).find((s) => s.spin === "mini" && s.lines > 0)!;
      const { inputs, exact } = pathToInputs(board, piece, spin.path, settings);
      expect(exact, p.id).toBe(true);
      const s = new PuzzleSession(p, 1, settings);
      for (const key of [...inputs, "hardDrop" as const]) {
        s.keyDown(key);
        s.keyUp(key);
      }
      expect(s.status, p.id).toBe("solved");
      expect(s.game.state.b2b, p.id).toBe(4);
      // A straight drop clears at most a plain line: B2B breaks, no solve.
      const drop = new PuzzleSession(p, 1, settings);
      drop.keyDown("hardDrop");
      expect(drop.status, p.id).toBe("failed");
    }
  });
});

describe("mini-keeper drill", () => {
  const drill = findDrill("mini-keeper")!.drill;
  it("starts with a live chain, also after a restart", () => {
    const s = new DrillSession(drill, 1, defaultSettings());
    expect(s.game.state.b2b).toBe(3);
    s.restart();
    expect(s.game.state.b2b).toBe(3);
  });
  it("counts each clear that ends a live chain", () => {
    const s = new DrillSession(drill, 1, defaultSettings());
    // Chain starts at 3: 4 keeps, -1 breaks, -1 has nothing to break, 0 starts anew.
    for (const b2b of [4, -1, -1, 0, 1, -1])
      s.game.log.push({ b2b } as Placement);
    expect(s.metrics().b2bBreaks).toBe(2);
  });
});
