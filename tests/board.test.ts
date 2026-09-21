import { describe, expect, it } from "vitest";
import {
  cells,
  collides,
  deserialize,
  emptyBoard,
  lock,
  move,
  project,
  rotate,
  serialize,
  spawn,
  TYPES,
} from "../src/core/board";
import type { Board, Piece } from "../src/core/board";
export function field(rows: string[]): Board {
  const board = emptyBoard();
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell === "#") board[y][x] = "X";
    }),
  );
  return board;
}
const triple = [
  "####.#####",
  "####..####",
  "####.#####",
  "..........",
  "....#.....",
];
describe("board and SRS+", () => {
  it("serializes, validates and preserves failed movement", () => {
    const board = field(triple);
    expect(deserialize(serialize(board))).toEqual(board);
    expect(() => deserialize("bad")).toThrow();
    const p: Piece = { type: "T", rotation: 0, x: 1, y: 1 };
    expect(move(emptyBoard(), p, -1, 0)).toBe(p);
  });
  it("spawns all seven pieces legally and projects onto the floor", () => {
    for (const type of TYPES) {
      const p = spawn(type);
      expect(collides(emptyBoard(), p)).toBe(false);
      expect(
        Math.min(...cells(project(emptyBoard(), p)).map(([, y]) => y)),
      ).toBe(0);
    }
  });
  it.each([false, true])(
    "enters an independently authored T-spin triple (mirror=%s)",
    (mirror) => {
      const board = field(
        mirror ? triple.map((row) => [...row].reverse().join("")) : triple,
      );
      const start: Piece = { type: "T", x: mirror ? 4 : 5, y: 3, rotation: 0 };
      expect(collides(board, start)).toBe(false);
      const result = rotate(board, start, mirror ? -1 : 1);
      expect(result).toEqual({
        type: "T",
        x: mirror ? 5 : 4,
        y: 1,
        rotation: mirror ? 3 : 1,
      });
      expect(lock(board, result).cleared).toBe(3);
    },
  );
  it("uses the first successful kick and the SRS+ I 180 table", () => {
    const board = emptyBoard();
    expect(rotate(board, { type: "T", x: 4, y: 0, rotation: 0 }, 1)).toEqual({
      type: "T",
      x: 3,
      y: 1,
      rotation: 1,
    });
    expect(rotate(board, { type: "I", x: 4, y: -1, rotation: 0 }, 2)).toEqual({
      type: "I",
      x: 4,
      y: 0,
      rotation: 2,
    });
    const o = spawn("O");
    expect(cells(rotate(board, o, 1))).toEqual(cells(o));
  });
  it("never accepts a colliding rotation on a jagged field", () => {
    const board = field([
      "###..#####",
      "##...###..",
      "#.....#...",
      "......#...",
    ]);
    for (const type of TYPES)
      for (const rotation of [0, 1, 2, 3] as const)
        for (let x = -2; x < 12; x++)
          for (let y = -2; y < 24; y++) {
            const p = { type, rotation, x, y };
            if (collides(board, p)) continue;
            for (const amount of [-1, 1, 2] as const)
              expect(collides(board, rotate(board, p, amount))).toBe(false);
          }
  });
});

it("preserves a fully blocked rotation and uses exact I floor and 180 wall kicks", () => {
  const board = emptyBoard().map((row) => row.map(() => "X" as const));
  const piece: Piece = { type: "T", x: 4, y: 5, rotation: 0 };
  const field: Board = board;
  for (const [x, y] of cells(piece)) field[y][x] = null;
  expect(rotate(field, piece, 1)).toBe(piece);
  expect(rotate(field, piece, -1)).toBe(piece);
  expect(rotate(field, piece, 2)).toBe(piece);
  expect(
    rotate(emptyBoard(), { type: "I", x: 4, y: -1, rotation: 0 }, 1),
  ).toEqual({ type: "I", x: 5, y: 1, rotation: 1 });
  expect(
    rotate(emptyBoard(), { type: "I", x: -1, y: 4, rotation: 1 }, 2),
  ).toEqual({ type: "I", x: 0, y: 4, rotation: 3 });
});
