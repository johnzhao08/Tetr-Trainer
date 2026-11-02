import { analyze } from "../src/core/solver/search";
import { lock, spawn } from "../src/core/board";
import { expect, it } from "vitest";
import { emptyBoard } from "../src/core/board";
import {
  viableConstructions,
  advanceConstructions,
  constructionEvidence,
} from "../src/core/solver/lstConstruction";
const preservesLST = (b: ReturnType<typeof emptyBoard>) =>
  viableConstructions(b).length > 0;
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

it("carries protected cells through a placement without reinterpreting its phase", () => {
  const board = field([
    "##.#######",
    "##.#######",
    "#...######",
    "##.#######",
    "#...######",
  ]);
  const states = viableConstructions(board);
  expect(states.length).toBeGreaterThan(0);
  const piece = { type: "I" as const, x: 7, y: 6, rotation: 0 as const };
  expect(advanceConstructions(states, board, piece).map((s) => s.rows)).toEqual(
    states.map((s) => s.rows),
  );
});

it("moves the construction by actual cleared rows rather than a fresh phase", () => {
  const board = field([
    "##.#######",
    "##.#######",
    "#...######",
    "##.#######",
    "#...######",
    "##.#######",
  ]);
  const states = viableConstructions(board);
  const t = { type: "T" as const, x: 2, y: 2, rotation: 2 as const };
  expect(lock(board, t).cleared).toBe(2);
  const next = advanceConstructions(states, board, t);
  expect(next.length).toBeGreaterThan(0);
  for (const state of next)
    expect(
      states.some(
        (s) =>
          JSON.stringify(s.rows.filter((_, y) => y !== 1 && y !== 2)) ===
          JSON.stringify(state.rows.slice(0, -2)),
      ),
    ).toBe(true);
});
it("allows O to complete the right boundary without assigning J/Z roles", () => {
  const board = field(LST_PATTERNS.find((p) => p.id === 27)!.rows);
  for (const y of [4, 5]) for (const x of [4, 5]) board[y][x] = null;
  const evidence = viableConstructions(board).map((s) =>
    constructionEvidence(board, s),
  );
  const o = { type: "O" as const, x: 4, y: 4, rotation: 0 as const };
  expect(
    advanceConstructions(viableConstructions(board), board, o).length,
  ).toBeGreaterThan(0);
  expect(viableConstructions(lock(board, o).board).length).toBeGreaterThan(0);
  for (const e of evidence)
    for (const o of e.obligations.filter((o) => o.x < 2))
      expect(o.pieces.every((p) => p === "L" || p === "S")).toBe(true);
});
