import { describe, expect, it } from "vitest";
import { TYPES } from "../src/core/board";
import type { Board } from "../src/core/board";
import { generateStack } from "../src/core/stackGen";
import { findPlacements, findSpins } from "../src/core/spins";
import { boardOf, deadBoard, STRUCTURES } from "../src/core/structures";
import {
  DEAD_HORIZON,
  generateQuestion,
  judgeFindSlot,
  judgePiece,
  judgeYesNo,
  noSlotWhy,
  questionById,
  VISION_KINDS,
} from "../src/core/vision";
import { bestSlot, creates, planSlot, runPlan, slotReady } from "../src/core/visionSearch";
import { replay, VisionGame } from "../src/core/visionGame";
import { defaultSettings } from "../src/core/settings";

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7 + 1);
// whichPiece and forecast search every placement, so they use fewer seeds.
const HEAVY = SEEDS.slice(0, 20);
/** Generate a question and add its cost to `clock.ms`. */
const clock = { ms: 0, n: 0 };
const timed = <K extends (typeof VISION_KINDS)[number]>(
  seed: number,
  kind: K,
) => {
  const start = performance.now();
  const q = generateQuestion(seed, kind);
  clock.ms += performance.now() - start;
  clock.n++;
  return q;
};
const same = (a: Board, b: Board) =>
  a.map((r) => r.join()).join("|") === b.map((r) => r.join()).join("|");

describe("bestSlot", () => {
  it("never misses a slot the full spin search finds", () => {
    const boards = [
      ...SEEDS.map((seed) => generateStack(seed, { pieces: 10 + (seed % 20) }).board),
      ...STRUCTURES.map(boardOf),
    ];
    for (const b of boards) {
      const raw = findSpins(b, "T").some((s) => s.spin === "full" && s.lines >= 2);
      expect(bestSlot(b) !== null).toBe(raw);
    }
  });
});

describe("generateStack", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = generateStack(5, { pieces: 20 });
    expect(same(generateStack(5, { pieces: 20 }).board, a.board)).toBe(true);
    expect(same(generateStack(6, { pieces: 20 }).board, a.board)).toBe(false);
  });
  it("stays within piece bounds and under 30 ms on average", () => {
    const start = performance.now();
    for (let seed = 0; seed < 20; seed++) {
      const stack = generateStack(seed, { pieces: 8 + (seed % 23) });
      expect(stack.pieces).toBeGreaterThanOrEqual(8);
      expect(stack.pieces).toBeLessThanOrEqual(30);
    }
    expect((performance.now() - start) / 20).toBeLessThan(30);
  });
});

describe("questions", { timeout: 120_000 }, () => {
  it("are deterministic", () => {
    for (const kind of VISION_KINDS)
      expect(generateQuestion(3, kind)).toEqual(generateQuestion(3, kind));
  });

  it("findSlot: every answer is a real T-spin in the engine", () => {
    for (const seed of SEEDS) {
      const q = generateQuestion(seed, "findSlot");
      expect(q.best).toBeGreaterThanOrEqual(2);
      for (const move of q.answers) {
        const { state } = replay(q.board, "T", move.path);
        expect(judgeFindSlot(q, state)).toBe(true);
      }
      // A plain hard drop is not a T-spin, so it is judged wrong.
      const drop = replay(q.board, "T", []);
      expect(judgeFindSlot(q, drop.state)).toBe(false);
    }
  });

  it("findSlot: the hold key does nothing when disabled", () => {
    const q = generateQuestion(1, "findSlot");
    const game = new VisionGame(1, defaultSettings(), q.board, ["T"]);
    game.noHold = true;
    game.keyDown("hold");
    expect(game.state.hold).toBeNull();
    expect(game.state.active?.type).toBe("T");
  });

  it("noSlot: the answer matches the spin finder, dead boards have none", () => {
    let yes = 0;
    let dead = 0;
    clock.ms = clock.n = 0;
    for (const seed of SEEDS) {
      const q = timed(seed, "noSlot");
      const has = bestSlot(q.board) !== null;
      expect(q.answer).toBe(has);
      expect(judgeYesNo(q, has)).toBe(true);
      expect(judgeYesNo(q, !has)).toBe(false);
      if (q.answer) yes++;
      else {
        expect(findSpins(q.board, "T")).toHaveLength(0);
        expect(q.dead).toBe(deadBoard(q.board, { horizon: DEAD_HORIZON }));
      }
      if (q.dead) dead++;
    }
    expect(yes).toBeGreaterThan(5);
    expect(yes).toBeLessThan(SEEDS.length - 5);
    expect(dead).toBeGreaterThan(0);
    expect(clock.ms / clock.n).toBeLessThan(100);
  });

  it("whichPiece: answers are exactly the piece types that create a slot", () => {
    clock.ms = clock.n = 0;
    for (const seed of HEAVY) {
      const q = timed(seed, "whichPiece");
      expect(slotReady(q.board)).toBe(false);
      for (const t of TYPES) {
        expect(judgePiece(q, t)).toBe(creates(q.board, t) !== null);
      }
      const { type, placement, slot } = q.example;
      expect(q.answers).toContain(type);
      const game = replay(q.board, type, placement.path);
      expect(same(game.state.board, placement.after)).toBe(true);
      expect(slot.lines).toBeGreaterThanOrEqual(2);
    }
    expect(clock.ms / clock.n).toBeLessThan(250);
  });

  it("noSlot: feedback only claims what a placement proves", () => {
    for (const seed of SEEDS) {
      const q = generateQuestion(seed, "noSlot");
      if (q.answer || q.dead) continue;
      const quad = TYPES.some((t) =>
        findPlacements(q.board, t).some((p) => p.lines >= 4),
      );
      const piece = TYPES.find((t) => creates(q.board, t) !== null);
      if (q.why.includes("would build one")) {
        expect(q.why).toContain(`a ${piece} would`);
        expect(quad).toBe(false);
      }
      if (q.why.includes("quad is ready")) expect(quad).toBe(true);
    }
    // A board with a quad ready and no spin must not promise a spin.
    const quadBoard = generateStack(1, { pieces: 4 }).board.map((r) => [...r]);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 9; x++) quadBoard[y][x] = "X";
    expect(noSlotWhy(quadBoard, false)).toContain("quad is ready");
  });

  it("forecast: the target is the first T and hold has none", () => {
    for (const seed of [9, 188, ...HEAVY]) {
      const q = generateQuestion(seed, "forecast");
      expect(q.queue.indexOf("T")).toBe(q.tIndex);
      expect(q.hold).not.toBe("T");
    }
  });

  it("forecast: a no is proven by a complete search, never a beam miss", () => {
    for (const seed of [188, ...HEAVY]) {
      const q = generateQuestion(seed, "forecast");
      if (q.answer) continue;
      const found = planSlot(q.board, q.queue, q.hold, q.tIndex, {
        exhaustive: true,
        budgetMs: 20_000,
      });
      expect(found).toBeNull();
    }
  });

  it("planSlot: a null is unproven if the clock expires during the terminal scan", () => {
    const q = SEEDS.map((seed) => generateQuestion(seed, "forecast")).find(
      (f) => !f.answer,
    )!;
    const run = (budgetMs: number) => {
      let calls = 0;
      const now = () => calls++;
      const result = planSlot(q.board, q.queue, q.hold, q.tIndex, {
        exhaustive: true,
        budgetMs,
        now,
      });
      return { result, calls };
    };
    const full = run(Infinity);
    expect(full.result).toBeNull();
    expect(run(full.calls - 2).result).toBeUndefined();
  });

  it("questionById rebuilds the same question, with or without the clock", () => {
    let t = 0;
    const expired = () => (t += 1000);
    for (const kind of VISION_KINDS)
      for (const seed of [188, 9, 3]) {
        const q = generateQuestion(seed, kind, { now: expired });
        expect(q.id).toBe(`${kind}-${q.seed}`);
        expect(questionById(q.id)).toEqual(q);
      }
  });

  it("dead-board feedback names what the search checked", () => {
    const board = Array.from({ length: 40 }, () => Array(10).fill(null)) as Board;
    [..."XXXXX.X..."].forEach((c, x) => (board[0][x] = c === "X" ? "X" : null));
    // A T-spin Mini Single is still reachable, so "no spin" would be false.
    expect(deadBoard(board, { horizon: DEAD_HORIZON })).toBe(true);
    expect(noSlotWhy(board, true)).toContain("T-spin Double or better");
  });

  it("planSlot: the complete search finds plans the beam misses", () => {
    const board = generateStack(225, { pieces: 11 }).board;
    const queue = ["J", "S"] as const;
    expect(planSlot(board, queue, null, 2)).toBeNull();
    const plan = planSlot(board, queue, null, 2, { exhaustive: true })!;
    expect(plan).toBeTruthy();
    const game = runPlan(board, queue, null, plan.steps);
    expect(slotReady(game.state.board)).toBe(true);
    // An exhausted budget is unproven, not a no.
    expect(
      planSlot(board, queue, null, 2, { exhaustive: true, budgetMs: -1 }),
    ).toBeUndefined();
  });

  it("forecast: yes answers carry a plan the real engine reproduces", () => {
    let yes = 0;
    clock.ms = clock.n = 0;
    for (const seed of HEAVY) {
      const q = timed(seed, "forecast");
      expect(q.queue[q.tIndex]).toBe("T");
      expect(q.queue).toHaveLength(5);
      if (q.answer) {
        yes++;
        const game = runPlan(q.board, q.queue, q.hold, q.plan!.steps);
        expect(same(game.state.board, q.plan!.board)).toBe(true);
        expect(slotReady(game.state.board)).toBe(true);
      } else expect(q.plan).toBeNull();
    }
    expect(yes).toBeGreaterThan(2);
    expect(yes).toBeLessThan(HEAVY.length - 2);
    // The complete search behind each no is the cost, so allow more here.
    expect(clock.ms / clock.n).toBeLessThan(250);
  });
});
