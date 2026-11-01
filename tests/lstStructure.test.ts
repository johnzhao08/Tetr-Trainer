import { analyze } from "../src/core/solver/search";
import { spawn } from "../src/core/board";
import { expect, it } from "vitest";
import { emptyBoard } from "../src/core/board";
import { preservesLST } from "../src/core/solver/lstStructure";
import { LST_PATTERNS } from "../src/core/solver/lstPatterns";
function field(rows: readonly string[]) {
  const b = emptyBoard();
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === "#") b[y][x] = "X";
    }),
  );
  return b;
}
it.each(LST_PATTERNS)("accepts source pure/mixed pattern $id", (p) =>
  expect(preservesLST(field(p.rows))).toBe(true),
);
it("rejects the source's unfillable continuation even though the current TSD exists", () => {
  expect(
    preservesLST(
      field([
        "##.#######",
        "##.#######",
        "#...######",
        "#..#######",
        "....#.....",
        "....#.....",
      ]),
    ),
  ).toBe(false);
});
it("rejects the screenshot's vertical I through the next boundary", () => {
  const rows = [
    "LS.ZZJSOOI",
    "SS.JJJLOOI",
    "S...ZZLLLI",
    "...ZZJ...I",
    ".....J....",
  ];
  const b = emptyBoard();
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ".") b[y][x] = "X";
    }),
  );
  expect(preservesLST(b)).toBe(true);
  for (let y = 4; y < 8; y++) b[y][4] = "I";
  expect(preservesLST(b)).toBe(false);
});

it("does not return a continuation that buys a broken pattern with a TSD reward", () => {
  const rows = [
    "LS.ZZJSOOI",
    "SS.JJJLOOI",
    "S...ZZLLLI",
    "...ZZJ...I",
    ".....J....",
  ];
  const board = emptyBoard();
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ".") board[y][x] = "X";
    }),
  );
  // Representative queue: the screenshot does not show the original next queue.
  const result = analyze(
    {
      board,
      active: spawn("I"),
      hold: "T",
      canHold: true,
      visibleQueue: ["O", "Z", "S", "J", "L"],
      tsds: 2,
    },
    "right",
    { mode: "lst", now: () => 0 },
  );
  expect(result.lines.length).toBeGreaterThan(0);
  for (const line of result.lines)
    for (const move of line.moves) expect(preservesLST(move.after)).toBe(true);
});
