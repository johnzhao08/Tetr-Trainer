import { expect, it } from "vitest";
import { emptyBoard, spawn } from "../src/core/board";
import { analyze, type SolverPosition } from "../src/core/solver/search";
const position: SolverPosition = {
  board: emptyBoard(),
  active: spawn("O"),
  hold: null,
  canHold: false,
  visibleQueue: ["I", "L", "T"],
};
it("withholds recommendations when a later round times out, even after a complete first round", () => {
  let rootChecks = 0;
  const first = analyze(position, "right", {
    maxDepth: 1,
    now: () => {
      rootChecks++;
      return 0;
    },
  });
  expect(first.lines.length).toBeGreaterThan(0);
  expect(first.complete).toBe(true);
  let calls = 0;
  const result = analyze(position, "right", {
    maxDepth: 4,
    budgetMs: 500,
    now: () => (calls++ < rootChecks + 100 ? 0 : 501),
  });
  expect(result.complete).toBe(false);
  expect(result.timedOut).toBe(true);
  expect(result.depth).toBeGreaterThanOrEqual(1);
  expect(result.depth).toBeLessThan(4);
  expect(result.lines).toEqual([]);
});
it("publishes only after completing the requested horizon", () => {
  const result = analyze({ ...position, hold: "O" }, "right", {
    maxDepth: 4,
    now: () => 0,
  });
  expect(result.complete).toBe(true);
  expect(result.timedOut).toBe(false);
  expect(result.lines.length).toBeGreaterThan(0);
  expect(result.lines.every((line) => line.moves.length === 4)).toBe(true);
});
it("distinguishes running out of visible pieces from a time-limited shallow search", () => {
  const result = analyze({ ...position, visibleQueue: [] }, "right", {
    now: () => 0,
  });
  expect(result.complete).toBe(true);
  expect(result.depth).toBe(1);
  expect(result.lines.length).toBeGreaterThan(0);
});
