import { analyze } from "../src/core/solver/search";
import { lock, spawn } from "../src/core/board";
import { expect, it } from "vitest";
import { emptyBoard } from "../src/core/board";
import { preservesLST } from "../src/core/solver/lstStructure";
import {
  reachablePlacements,
  placementKey,
} from "../src/core/solver/placements";
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
  // The old finite whitelist is deliberately not the new acceptance oracle.
  // Still reject the damaging first I and report unresolved branches honestly.
  for (const line of result.lines) {
    expect(
      line.moves[0].piece.type === "I" &&
        line.moves[0].piece.rotation % 2 === 1 &&
        line.moves[0].piece.x === 4,
    ).toBe(false);
    expect(line.evidence).toBeDefined();
  }
  expect(result.lines[0].evidence).toBe("construction");
});

// Screenshot reconstruction before the later TSD; rows are bottom-up.
// The O bridges two consecutive boundary rows above the first Z.
it("rejects the screenshot O that flattens the alternating overhang", () => {
  const b = field([
    "##.#######",
    "##..######",
    "##...#####",
    "#....#####",
    ".....#####",
  ]);
  // First planned Z, then the O at x=3..4, y=4..5.
  for (const [x, y] of [
    [3, 1],
    [3, 2],
    [4, 2],
    [4, 3],
  ])
    b[y][x] = "Z";
  expect(preservesLST(b)).toBe(true);
  const target = { type: "O" as const, x: 3, y: 4, rotation: 0 as const };
  const reachable = reachablePlacements(b, spawn("O")).find(
    (p) => placementKey(p.piece) === placementKey(target),
  );
  expect(reachable).toBeDefined();
  expect(preservesLST(lock(b, reachable!.piece).board)).toBe(false);
  const analysis = analyze(
    {
      board: b,
      active: spawn("O"),
      hold: null,
      canHold: false,
      visibleQueue: ["I", "T", "I", "Z", "L"],
      tsds: 2,
    },
    "right",
    { mode: "lst", now: () => 0, maxDepth: 1 },
  );
  expect(analysis.lines.length).toBeGreaterThan(0);
  for (const line of analysis.lines)
    expect(placementKey(line.moves[0].piece)).not.toBe(placementKey(target));
});

it("keeps checking buried overhangs in tall canonical stacks", () => {
  const cycle = [
    "##.#######",
    "##.#######",
    "#...######",
    "##.#######",
    "#...######",
  ];
  const b = field(Array.from({ length: 18 }, (_, y) => cycle[y % 5]));
  expect(preservesLST(b)).toBe(true);
  b[7][3] = "O";
  expect(preservesLST(b)).toBe(false);
});

it("preserves overhang validation above pending I Quads", () => {
  const rows = [
    "##.#######",
    "##.#######",
    "#...######",
    "##.#######",
    "#...######",
  ];
  for (const prefix of [4, 8]) {
    const b = field([...Array<string>(prefix).fill("##.#######"), ...rows]);
    expect(preservesLST(b)).toBe(true);
    b[prefix + 2][3] = "O";
    expect(preservesLST(b)).toBe(false);
  }
});
