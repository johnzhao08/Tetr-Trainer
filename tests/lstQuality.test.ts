import { expect, it } from "vitest";
import { emptyBoard, spawn } from "../src/core/board";
import { analyze, type SolverPosition } from "../src/core/solver/search";
function screenshot(): SolverPosition {
  const board = emptyBoard();
  [
    "LS.ZZJSOOI",
    "LS.SSZZOOI",
    "LS.SSJJJJJ",
    "LL.TTJIZOO",
    "L...TJILOO",
    "L..JJJILLL",
    "......III.",
    ".......II.",
    ".......II.",
    ".......II.",
  ].forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ".") board[y][x] = "X";
    }),
  );
  return {
    board,
    active: spawn("Z"),
    hold: "Z",
    canHold: true,
    visibleQueue: ["O", "S", "Z", "L", "S"],
    tsds: 6,
  };
}
it("keeps viable constructions available instead of vetoing any dependency increase", () => {
  const result = analyze(screenshot(), "right", { mode: "lst", now: () => 0 });
  expect(result.lines.length).toBeGreaterThan(0);
  expect(result.lines[0].evidence).toBe("construction");
  expect(result.lines[0].metrics.holes).toBe(0);
  expect(result.lines[0].metrics.wellBlocks).toBe(0);
});
it("still permits the corrective I Quad in the central well", () => {
  const board = emptyBoard();
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 10; x++) if (x !== 2) board[y][x] = "X";
  const result = analyze(
    {
      board,
      active: spawn("I"),
      hold: null,
      canHold: false,
      visibleQueue: [],
      tsds: 6,
    },
    "right",
    { mode: "lst", now: () => 0 },
  );
  expect(result.lines[0].moves[0].cleared).toBe(4);
});
