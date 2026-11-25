import { describe, expect, it } from "vitest";
import type { Placement } from "../src/core/game";
import {
  compare,
  DECISION_PIECES,
  HORIZONS,
  MIN_MARGIN,
  net,
  PIECE_MS,
  POLICIES,
  realized,
  robustAnswer,
  simulate,
  summarize,
} from "../src/core/decision";
import type { Comparison, LineResult } from "../src/core/decision";
import {
  ANSWERS,
  buildScenario,
  decisionRecord,
  DECISIONS,
  lessonFor,
  PUBLISHED,
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
  it("has at least 10 scenarios with unique ids and neutral titles", () => {
    expect(DECISIONS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(DECISIONS.map((s) => s.id)).size).toBe(DECISIONS.length);
    DECISIONS.forEach((s, i) => expect(s.title).toBe(`Position ${i + 1}`));
  });
  it("starts from valid positions with Surge charged and every piece visible", () => {
    for (const s of DECISIONS) {
      expect(validatePosition({ rows: s.rows, queue: s.queue }), s.id).toEqual([]);
      expect(s.b2b, s.id).toBeGreaterThanOrEqual(4);
      expect(s.queue.length, s.id).toBeGreaterThanOrEqual(DECISION_PIECES);
      expect(s.queue.slice(0, 6), s.id).toContain("I");
    }
  });
  it("states a match window the rules apply to", () => {
    for (const s of DECISIONS) {
      expect(s.match.pieces, s.id).toBeGreaterThan(0);
      expect(s.match.ms, s.id).toBeGreaterThan(0);
    }
  });
});

describe("pairs", () => {
  const partnerOf = (i: number) =>
    PUBLISHED.findIndex(
      (q, j) => j !== i && q.family === PUBLISHED[i].family && q.seed === PUBLISHED[i].seed,
    );
  it("gives every scenario a partner that differs in one cue and has the opposite answer", () => {
    for (const [i, s] of DECISIONS.entries()) {
      const j = partnerOf(i);
      expect(j, s.id).toBeGreaterThanOrEqual(0);
      const t = DECISIONS[j];
      expect(t.b2b, s.id).toBe(s.b2b);
      expect(t.match, s.id).toEqual(s.match);
      expect(t.opponent.seed, s.id).toBe(s.opponent.seed);
      expect(PUBLISHED[j].answer, s.id).not.toBe(PUBLISHED[i].answer);
      const differs = [
        s.incoming,
        s.opponent.start,
        s.queue,
      ].filter((v, k) => JSON.stringify(v) !== JSON.stringify([t.incoming, t.opponent.start, t.queue][k]));
      expect(differs, s.id).toHaveLength(1);
      expect(lessonFor(i), s.id).toContain(`Position ${j + 1}`);
    }
  });
  it("does not leak the answer in a title, and mixes answers", () => {
    for (const s of DECISIONS) expect(s.title).not.toMatch(/break|keep|quiet|tall|garbage|calm/i);
    expect(ANSWERS).toContain("break");
    expect(ANSWERS).toContain("keep");
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
  it("constrains only the first piece: Break breaks the chain, Keep does not", () => {
    for (const s of DECISIONS) {
      const c = compare(s);
      expect(c.break.brokeFirst, s.id).toBe(true);
      expect(c.keep.brokeFirst, s.id).toBe(false);
    }
  });
  it("lets the kept chain release later", () => {
    // At least one Keep line realizes a Surge after the first piece.
    expect(DECISIONS.some((s) => compare(s).keep.surge > 0)).toBe(true);
  });
  it("scores realized outcomes only, never held Surge", () => {
    const base: LineResult = {
      sent: 6, cancelled: 3, received: 2, surge: 0, ko: false, died: false,
      brokeFirst: false, endedMs: 5000, b2b: 9, myHeight: 5, oppHeight: 9, oppB2b: 2, arrivals: [],
    };
    expect(net(base)).toBe(7);
    expect(net(base, 0)).toBe(4);
    expect(realized({ ...base, b2b: 20 })).toBe(7);
    expect(realized({ ...base, ko: true })).toBeGreaterThan(realized({ ...base, sent: 60 }));
    expect(realized({ ...base, died: true })).toBeLessThan(realized({ ...base, received: 60 }));
  });
  it("formats the played-out comparison", () => {
    const r = (sent: number, ko: boolean): LineResult => ({
      sent, cancelled: 0, received: 0, surge: 0, ko, died: false, brokeFirst: false,
      endedMs: 0, b2b: 0, myHeight: 4, oppHeight: 8, oppB2b: 0, arrivals: [],
    });
    const c: Comparison = { break: r(9, true), keep: r(6, false), answer: "break", gap: 40 };
    expect(summarize(c)).toBe("Breaking now sent 9 and topped them out; keeping sent 6.");
  });
});

describe("answer keys", () => {
  it("hold under every policy variant, horizon and cancel weighting", () => {
    expect(POLICIES.length).toBeGreaterThanOrEqual(3);
    expect(HORIZONS).toEqual([6, 10]);
    for (const [i, s] of DECISIONS.entries()) {
      const r = robustAnswer(s);
      expect(r?.answer, s.id).toBe(PUBLISHED[i].answer);
      expect(r!.margin, s.id).toBeGreaterThanOrEqual(MIN_MARGIN);
      expect(compare(s).answer, s.id).toBe(PUBLISHED[i].answer);
    }
  }, 180_000);
  it("rejects a scenario whose answer flips under another policy", () => {
    expect(robustAnswer(buildScenario("height", 1, 0))).toBeNull();
  }, 60_000);
});

describe("attack timing and terminal events", () => {
  const s = DECISIONS.find((d) => simulate(d, "keep").arrivals.length > 0)!;
  it("keeps each opponent attack at its own time, not the step end", () => {
    const o = new Opponent(s.opponent.seed, { ...s.opponent, surge: true, receives: true });
    const first = o.state.wait;
    const { arrivals } = simulate(s, "keep");
    const at = arrivals[0] - 333;
    // Within one frame of the attack, and off the 500 ms piece grid.
    expect(at).toBeGreaterThanOrEqual(first);
    expect(at - first).toBeLessThan(1000 / 60 + 1e-6);
    expect(arrivals.some((t) => (t - 333) % 500 > 1e-6 && (t - 333) % 500 < 499)).toBe(true);
  });
  it("ends scoring when you top out, with no settle time and no pending credit", () => {
    const blocked = { ...s, rows: Array(24).fill("XXXXXXXXX.") };
    const r = simulate(blocked, "keep");
    expect(r.died).toBe(true);
    expect(r.ko).toBe(false);
    expect(r.endedMs).toBeLessThanOrEqual(PIECE_MS + 20);
    expect(r.received).toBe(0);
  });
  it("ends scoring at a knockout without counting later garbage", () => {
    const ko = DECISIONS.flatMap((d) => [compare(d).break, compare(d).keep]).find((r) => r.ko);
    expect(ko).toBeDefined();
    expect(ko!.endedMs).toBeLessThan(DECISION_PIECES * PIECE_MS + 1500);
    expect(ko!.died).toBe(false);
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
      expect(METRIC_INFO[id].explain.length).toBeGreaterThan(20);
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
