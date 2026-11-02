import { expect, it } from "vitest";
import fixture from "./fixtures/lst-lost-repair.json";
import staleHistory from "./fixtures/lst-stale-construction.json";
import {
  analyze,
  type SolverPosition,
  type PlannedMove,
  type Continuation,
} from "../src/core/solver/search";
import { Game } from "../src/core/game";
import type { Action } from "../src/core/settings";
import { constructionBoardKey } from "../src/core/solver/lstConstruction";
import { solverSnapshot } from "../src/core/solver/snapshot";
import { ContinuationCache } from "../src/core/solver/continuationCache";

it("retains a verified repair after following the first placement", () => {
  const before = analyze(fixture.before as SolverPosition, "right", {
    mode: "lst",
    now: () => 0,
  });
  expect(before.lines[0].evidence).toBe("construction");
  // A healthy fresh search must keep its decisions, even with alternate hints.
  const hinted = analyze(fixture.before as SolverPosition, "right", {
    mode: "lst",
    now: () => 0,
    seedPlans: before.lines.map((line) => line.moves).reverse(),
  });
  expect(hinted.lines).toEqual(before.lines);
  const cache = new ContinuationCache();
  cache.remember(before.lines);
  const after = fixture.after as SolverPosition;
  const hints = cache.forBoard(after.board);
  expect(hints.seedPlans?.length).toBeGreaterThan(0);
  const next = analyze(after, "right", { mode: "lst", now: () => 0, ...hints });
  expect(next.lines[0].evidence).toBe("construction");
  expect(next.lines[0].metrics.holes).toBe(0);
  const game = new Game(1);
  Object.assign(game.state, structuredClone(after), {
    queue: [...after.visibleQueue],
    fullTSpinDoubles: after.tsds,
  });
  for (const move of next.lines[0].moves) {
    expect(game.state.board).toEqual(move.before);
    if (move.useHold) {
      game.keyDown("hold");
      game.keyUp("hold");
    }
    for (const [i, input] of move.path.entries()) {
      game.settings.das = input.startsWith("wall") ? 0 : 110;
      const action: Action =
        i === move.path.length - 1
          ? "hardDrop"
          : input === "drop"
            ? "softDrop"
            : input === "wallLeft"
              ? "left"
              : input === "wallRight"
                ? "right"
                : (input as Action);
      game.keyDown(action);
      game.keyUp(action);
    }
    expect(game.state.board).toEqual(move.after);
    expect(game.state.lastClear).toBe(move.cleared);
    if (move.spin || move.cleared)
      expect(game.state.lastEvent?.spin ?? null).toBe(move.spin);
  }
  expect(game.state.fullTSpinDoubles).toBe(2);
  // A later shallow report cannot erase the longer repair.
  cache.remember(
    before.lines.map((l) => ({ ...l, moves: l.moves.slice(0, 2) })),
  );
  expect(
    cache.forBoard(after.board).seedPlans?.some((p) => p.length >= 5),
  ).toBe(true);
});

it("rejects a stale tail whose piece is not available", () => {
  const position = fixture.after as SolverPosition;
  const stale = {
    piece: { type: "L", x: 0, y: 1, rotation: 1 },
    useHold: false,
    spin: null,
    cleared: 0,
  } as PlannedMove;
  const options = { mode: "lst" as const, now: () => 0, maxDepth: 1 };
  const normal = analyze(position, "right", options);
  const seeded = analyze(position, "right", {
    ...options,
    seedPlans: [[stale]],
  });
  expect(seeded.lines).toEqual(normal.lines);
});

it("does not reuse a hold placement after hold becomes unavailable", () => {
  const position = { ...fixture.before, canHold: false } as SolverPosition;
  const stale: PlannedMove = {
    before: position.board,
    after: position.board,
    piece: { type: "L", x: 8, y: 2, rotation: 0 },
    useHold: true,
    spin: null,
    cleared: 0,
    path: [],
  };
  const options = { mode: "lst" as const, now: () => 0, maxDepth: 1 };
  expect(
    analyze(position, "right", { ...options, seedPlans: [[stale]] }).lines,
  ).toEqual(analyze(position, "right", options).lines);
});

it("does not publish retained plans after the time budget is exhausted", () => {
  const position = fixture.after as SolverPosition;
  const seed: PlannedMove = {
    before: position.board,
    after: position.board,
    piece: { type: "Z", x: 5, y: 1, rotation: 1 },
    useHold: false,
    spin: null,
    cleared: 0,
    path: [],
  };
  let calls = 0;
  const progress: unknown[] = [];
  const result = analyze(position, "right", {
    mode: "lst",
    seedPlans: [[seed]],
    budgetMs: 10,
    now: () => (calls++ < 5 ? 0 : 11),
    onProgress: (a) => progress.push(a),
  });
  expect(result.timedOut).toBe(true);
  expect(result.depth).toBe(0);
  expect(result.lines).toEqual([]);
  expect(progress).toEqual([]);
});

it("keeps the repair plan when the player has already performed its hold", () => {
  const position = fixture.before as SolverPosition;
  const before = analyze(position, "right", { mode: "lst", now: () => 0 });
  expect(before.lines[0].moves[0].useHold).toBe(true);
  const cache = new ContinuationCache();
  cache.remember(before.lines);
  const game = new Game(1);
  Object.assign(game.state, structuredClone(position), {
    queue: [...position.visibleQueue],
    fullTSpinDoubles: position.tsds,
  });
  game.keyDown("hold");
  game.keyUp("hold");
  expect(game.state.canHold).toBe(false);
  const hints = cache.forBoard(game.state.board);
  expect(hints.seedPlans?.some((p) => p.length === 6)).toBe(true);
  const after = analyze(solverSnapshot(game.state), "right", {
    mode: "lst",
    now: () => 0,
    ...hints,
  });
  expect(after.lines[0].evidence).toBe("construction");
  expect(after.lines[0].moves[0].useHold).toBe(false);
  expect(after.lines[0].moves[0].piece).toEqual(before.lines[0].moves[0].piece);
  expect(after.lines[0].metrics.holes).toBe(0);
});

it("updates clear-history evidence without reviving superseded interpretations", () => {
  const position = staleHistory.position as SolverPosition;
  const board = position.board;
  const cache = new ContinuationCache();
  const older = staleHistory.newStates;
  const latest = staleHistory.oldStates;
  const report = (states: typeof latest) =>
    [
      {
        moves: [],
        constructionTrace: [{ boardKey: constructionBoardKey(board), states }],
      },
    ] as unknown as Continuation[];
  cache.remember(report(older));
  cache.remember(report(latest));
  expect(cache.forBoard(board).initialConstructions).toEqual(latest);
  const result = analyze(position, "right", {
    mode: "lst",
    now: () => 0,
    ...cache.forBoard(board),
  });
  expect(result.lines[0].moves[0].piece).toEqual({
    type: "J",
    x: 4,
    y: 4,
    rotation: 2,
  });
});
