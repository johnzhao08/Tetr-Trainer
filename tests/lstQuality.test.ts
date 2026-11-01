import { evaluateLST } from "../src/core/solver/lstEvaluation";
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
it("does not break the LST clear sequence in the tall-right-stack screenshot", () => {
  const result = analyze(screenshot(), "right", { mode: "lst", now: () => 0 });
  expect(result.lines.length).toBeGreaterThan(0);
  expect(
    result.lines.every((l) =>
      l.moves.every(
        (m) =>
          m.cleared === 0 ||
          m.cleared === 4 ||
          (m.cleared === 2 && m.spin === "full"),
      ),
    ),
    JSON.stringify(
      result.lines.map((l) => ({
        cost: l.cost,
        moves: l.moves.map((m) => ({ p: m.piece, c: m.cleared })),
      })),
    ),
  ).toBe(true);
});

it("does not deepen the screenshot's piece dependencies", () => {
  const position = screenshot();
  const result = analyze(position, "right", { mode: "lst", now: () => 0 });
  for (const best of result.lines) {
    expect(
      best.metrics.dependencies,
      JSON.stringify({
        metrics: best.metrics,
        moves: best.moves.map((m) => m.piece),
      }),
    ).toBeLessThanOrEqual(evaluateLST(position.board, 6).dependencies);
  }
});
it("counts deep notches in the freestyle stack without charging the intended well", () => {
  const flat = emptyBoard(),
    narrow = emptyBoard();
  for (let x = 0; x < 10; x++)
    if (x !== 2)
      for (let y = 0; y < 5; y++) {
        flat[y][x] = "X";
        if (x !== 9 || y === 0) narrow[y][x] = "X";
      }
  expect(evaluateLST(flat, 6).dependencies).toBe(0);
  expect(evaluateLST(narrow, 6).dependencies).toBe(120);
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
