import { expect, it } from "vitest";
import {
  emptyBoard,
  spawn,
  TYPES,
  lock,
  move,
  type Piece,
} from "../src/core/board";
import {
  reachablePlacements,
  placementKey,
  transition,
} from "../src/core/solver/placements";
function field(rows: string[]) {
  const b = emptyBoard();
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === "#") b[y][x] = "X";
    }),
  );
  return b;
}
it("returns unique grounded placements with replayable engine paths for every piece", () => {
  for (const type of TYPES)
    for (const instant of [false, true]) {
      const b = emptyBoard(),
        placements = reachablePlacements(b, spawn(type), instant);
      expect(placements.length).toBeGreaterThan(8);
      expect(new Set(placements.map((p) => placementKey(p.piece))).size).toBe(
        placements.length,
      );
      for (const p of placements) {
        let replay = spawn(type);
        for (const action of p.path) replay = transition(b, replay, action);
        expect(replay).toEqual(p.piece);
        expect(move(b, replay, 0, -1)).toBe(replay);
        expect(() => lock(b, replay)).not.toThrow();
      }
    }
});
it.each([
  [
    "T",
    ["####.#####", "####..####", "####.#####", "..........", "....#....."],
    { type: "T", x: 4, y: 1, rotation: 1 },
    3,
  ],
  [
    "S",
    ["###..#####", "####..####"],
    { type: "S", x: 4, y: 1, rotation: 2 },
    2,
  ],
  [
    "Z",
    ["#####..###", "####..####"],
    { type: "Z", x: 5, y: 1, rotation: 2 },
    2,
  ],
] as const)(
  "finds the independent %s spin fixture from spawn",
  (type, rows, target, clears) => {
    const b = field([...rows]);
    const found = reachablePlacements(b, spawn(type)).find(
      (p) => placementKey(p.piece) === placementKey(target as Piece),
    );
    expect(found).toBeDefined();
    expect(lock(b, found!.piece).cleared).toBe(clears);
  },
);
it("does not teleport into a sealed cavity or rescue a blocked spawn", () => {
  const b = field(["###...####", "###...####", "##########"]);
  expect(reachablePlacements(b, spawn("T")).every((p) => p.piece.y >= 3)).toBe(
    true,
  );
  b[21][4] = "X";
  expect(reachablePlacements(b, spawn("T"))).toEqual([]);
});
it("can bound work without mutating the input", () => {
  const b = emptyBoard();
  expect(reachablePlacements(b, spawn("T"), true, () => true)).toEqual([]);
  expect(b).toEqual(emptyBoard());
});

it("counts optimal O finesse across every column, including wall backtracking and hard drop", () => {
  const placements = reachablePlacements(emptyBoard(), spawn("O"));
  const expected = [2, 3, 3, 2, 1, 2, 3, 3, 2];
  for (let x = 0; x < expected.length; x++) {
    const found = placements.find((p) => p.piece.x === x)!;
    expect(found.effort, `column ${x}`).toBe(expected[x]);
    expect(found.path.length).toBe(found.effort);
  }
  expect(placements.find((p) => p.piece.x === 1)!.path).toEqual([
    "wallLeft",
    "right",
    "drop",
  ]);
});
it("uses a single 180 input and does not charge a soft drop before a plain lock", () => {
  const placements = reachablePlacements(emptyBoard(), spawn("T"));
  expect(
    placements.find((p) => p.piece.x === 4 && p.piece.rotation === 0)!.effort,
  ).toBe(1);
  expect(
    placements.find((p) => p.piece.x === 4 && p.piece.rotation === 2)!.effort,
  ).toBe(2);
});
it("counts a timed finite soft-drop hold as one replayable action", () => {
  const start = spawn("T"),
    board = emptyBoard();
  expect(transition(board, start, "down:5").y).toBe(start.y - 5);
  for (const p of reachablePlacements(board, start, false))
    expect(p.effort).toBe(p.path.length);
});
