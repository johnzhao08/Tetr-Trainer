import { expect, it } from "vitest";
import { emptyBoard, lock, spawn, TYPES, type Board } from "../src/core/board";
import {
  fastPlacements,
  lockRows,
  toPiece,
  toRows,
} from "../src/core/solver/bitboard";
import {
  placementKey,
  reachablePlacements,
} from "../src/core/solver/placements";

// Deterministic stacks with overhangs, caves and T-slots.
function randomBoard(seed: number): Board {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const board = emptyBoard();
  const height = 2 + Math.floor(random() * 12);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < 10; x++)
      if (random() < 0.82 - y * 0.035) board[y][x] = "X";
  // Never start with a completed row.
  for (let y = 0; y < height; y++)
    if (board[y].every((c) => c !== null))
      board[y][Math.floor(random() * 10)] = null;
  return board;
}

function exact(board: Board, type: (typeof TYPES)[number], instant: boolean) {
  const best = new Map<string, number>();
  for (const p of reachablePlacements(
    board,
    spawn(type),
    instant,
    () => false,
    true,
  )) {
    const key = placementKey(p.piece);
    const spin = p.spin === "full" ? 2 : p.spin === "mini" ? 1 : 0;
    best.set(key, Math.max(best.get(key) ?? 0, type === "T" ? spin : 0));
  }
  return best;
}

it.each([true, false])(
  "finds exactly the placements and spins of the path search (instant soft drop: %s)",
  (instant) => {
    for (let seed = 1; seed <= 60; seed++) {
      const board = randomBoard(seed);
      const rows = toRows(board);
      for (const type of TYPES) {
        const fast = new Map(
          fastPlacements(rows, type, instant).map((p) => [
            placementKey(toPiece(type, p)),
            p.spin,
          ]),
        );
        expect([...fast].sort(), `seed ${seed} ${type}`).toEqual(
          [...exact(board, type, instant)].sort(),
        );
      }
    }
  },
  60000,
);

it("classifies a real T-spin double slot as a full spin", () => {
  const board = emptyBoard();
  ["##.#######", "#...######", "##........"].forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "#") board[y][x] = "X";
    }),
  );
  const slot = fastPlacements(toRows(board), "T", true).find(
    (p) => p.x === 2 && p.y === 1 && p.rotation === 2,
  );
  expect(slot?.spin).toBe(2);
  expect(lockRows(toRows(board), "T", 2, 1, 2).cleared).toBe(2);
});

it("locks and clears rows like the cell board", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const board = randomBoard(seed);
    // Leave single gaps so some placements complete rows.
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 10; x++) board[y][x] = x === 4 ? null : "X";
    const rows = toRows(board);
    for (const type of TYPES)
      for (const p of fastPlacements(rows, type, true)) {
        const expected = lock(board, toPiece(type, p));
        const actual = lockRows(rows, type, p.x, p.y, p.rotation);
        expect(actual.cleared).toBe(expected.cleared);
        expect([...actual.rows]).toEqual([...toRows(expected.board)]);
      }
  }
});
