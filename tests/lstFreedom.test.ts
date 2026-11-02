import { expect, it } from "vitest";
import { emptyBoard } from "../src/core/board";
import { heights } from "../src/core/solver/evaluation";
import { rightPackingTypes } from "../src/core/solver/lstEvaluation";
it("distinguishes a right-side O landing from a surface requiring other pieces", () => {
  const state = {
    rows: Array.from({ length: 40 }, (_, y) => [27, 27, 17, 27, 17][y % 5]),
  };
  const flat = emptyBoard(),
    jagged = emptyBoard();
  for (const x of [4, 6, 8]) jagged[0][x] = "X";
  expect(rightPackingTypes(flat, heights(flat), state)).toContain("O");
  expect(rightPackingTypes(jagged, heights(jagged), state)).not.toContain("O");
  expect(rightPackingTypes(jagged, heights(jagged), state)).toContain("I");
});
