import { expect, it } from "vitest";
import beforeQuad from "./fixtures/lst-before-quad.json";
import { emptyBoard } from "../src/core/board";
import { evaluateLST } from "../src/core/solver/lstEvaluation";
import { analyze, type SolverPosition } from "../src/core/solver/search";

it("counts missing freestyle support and roof for the next double", () => {
  const board = emptyBoard();
  ["##.#######", "##.#######", "#...######", "#..#######"].forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === "#") board[y][x] = "X";
    });
  });
  const states = [
    { rows: Array.from({ length: 40 }, (_, y) => [27, 27, 17, 27, 17][y % 5]) },
  ];
  expect(evaluateLST(board, 2, states).supportDebt).toBe(0);
  board[1][8] = null;
  expect(evaluateLST(board, 2, states).supportDebt).toBe(1);
  board[3][3] = null;
  expect(evaluateLST(board, 2, states).supportDebt).toBe(2);
});

it("takes the captured ready TSD before a Quad that leaves a less complete successor", () => {
  const result = analyze(beforeQuad.position as SolverPosition, "right", {
    mode: "lst",
    now: () => 0,
    initialConstructions: beforeQuad.constructions,
  });
  const line = result.lines[0];
  expect(line.evidence).toBe("construction");
  expect(line.moves[0].useHold).toBe(true);
  expect(line.moves[0].piece.type).toBe("T");
  expect(line.moves[0].spin).toBe("full");
  expect(line.moves[0].cleared).toBe(2);
});
