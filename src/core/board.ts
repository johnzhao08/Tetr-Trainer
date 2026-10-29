export const WIDTH = 10;
export const VISIBLE = 20;
export const HEIGHT = 40;
export const TYPES = ["I", "J", "L", "O", "S", "T", "Z"] as const;
export type Tetromino = (typeof TYPES)[number];
export type Cell = Tetromino | "X" | null;
export type Board = Cell[][];
export type Point = readonly [number, number];
export type Rotation = 0 | 1 | 2 | 3;
export type Piece = {
  type: Tetromino;
  x: number;
  y: number;
  rotation: Rotation;
};

// Rows are authored top-down, then converted once to offsets with y pointing up.
const grids: Record<Tetromino, string[]> = {
  T: [".T.", "TTT", "..."],
  J: ["J..", "JJJ", "..."],
  L: ["..L", "LLL", "..."],
  S: [".SS", "SS.", "..."],
  Z: ["ZZ.", ".ZZ", "..."],
  I: ["....", "IIII", "....", "...."],
  O: [".OO", ".OO", "..."],
};
export const SHAPES = Object.fromEntries(
  TYPES.map((type) => {
    let offsets: Point[] = grids[type].flatMap((row, y) =>
      [...row].flatMap((cell, x) =>
        cell === "." ? [] : [[x - 1, grids[type].length - 2 - y] as Point],
      ),
    );
    const states: Point[][] = [];
    for (let r = 0; r < 4; r++) {
      states.push(offsets);
      offsets =
        type === "O"
          ? offsets
          : offsets.map(([x, y]) => (type === "I" ? [y, 1 - x] : [y, -x]));
    }
    return [type, states];
  }),
) as Record<Tetromino, Point[][]>;

// TETR.IO client, retrieved 2026-09-20. Source uses y-down; y is negated here.
// Exact provenance/hash and origin conventions: REFERENCE_NOTES.md.
const A: Point[] = [
  [0, 0],
  [-1, 0],
  [-1, 1],
  [0, -2],
  [-1, -2],
];
const B: Point[] = [
  [0, 0],
  [1, 0],
  [1, -1],
  [0, 2],
  [1, 2],
];
const C: Point[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, -2],
  [1, -2],
];
const D: Point[] = [
  [0, 0],
  [-1, 0],
  [-1, -1],
  [0, 2],
  [-1, 2],
];
export const KICKS: Record<string, Point[]> = {
  "01": A,
  "21": A,
  "10": B,
  "12": B,
  "23": C,
  "03": C,
  "32": D,
  "30": D,
  "02": [
    [0, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
    [1, 0],
    [-1, 0],
  ],
  "13": [
    [0, 0],
    [1, 0],
    [1, 2],
    [1, 1],
    [0, 2],
    [0, 1],
  ],
  "20": [
    [0, 0],
    [0, -1],
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
  ],
  "31": [
    [0, 0],
    [-1, 0],
    [-1, 2],
    [-1, 1],
    [0, 2],
    [0, 1],
  ],
};
export const I_KICKS: Record<string, Point[]> = {
  "01": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [-2, -1],
    [1, 2],
  ],
  "10": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, -2],
    [2, 1],
  ],
  "12": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "21": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, 1],
    [1, -2],
  ],
  "23": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "32": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, 2],
    [-2, -1],
  ],
  "30": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "03": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [2, -1],
    [-1, 2],
  ],
  "02": [
    [0, 0],
    [0, 1],
  ],
  "13": [
    [0, 0],
    [1, 0],
  ],
  "20": [
    [0, 0],
    [0, -1],
  ],
  "31": [
    [0, 0],
    [-1, 0],
  ],
};
export function emptyBoard(): Board {
  return Array.from({ length: HEIGHT }, () => Array<Cell>(WIDTH).fill(null));
}
export function cells(piece: Piece): Point[] {
  return SHAPES[piece.type][piece.rotation].map(([x, y]) => [
    piece.x + x,
    piece.y + y,
  ]);
}
export function collides(board: Board, piece: Piece): boolean {
  return cells(piece).some(
    ([x, y]) =>
      x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || board[y][x] !== null,
  );
}
export function move(
  board: Board,
  piece: Piece,
  dx: number,
  dy: number,
): Piece {
  const next = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return collides(board, next) ? piece : next;
}
export function rotate(board: Board, piece: Piece, amount: 1 | -1 | 2): Piece {
  const rotation = ((piece.rotation + amount + 4) % 4) as Rotation;
  if (piece.type === "O") return { ...piece, rotation };
  for (const [dx, dy] of (piece.type === "I" ? I_KICKS : KICKS)[
    `${piece.rotation}${rotation}`
  ]) {
    const next = { ...piece, rotation, x: piece.x + dx, y: piece.y + dy };
    if (!collides(board, next)) return next;
  }
  return piece;
}
export function project(board: Board, piece: Piece): Piece {
  let result = piece;
  while (true) {
    const next = move(board, result, 0, -1);
    if (next === result) return result;
    result = next;
  }
}
// Three occupied diagonal corners around the T pivot (walls/floor count).
// The caller separately verifies that rotation was the last successful movement.
export function classifyTSpin(
  board: Board,
  piece: Piece,
  kickIndex: number,
): "full" | "mini" | null {
  if (piece.type !== "T") return null;
  let occupied = 0;
  let front = 0;
  for (const dx of [-1, 1])
    for (const dy of [-1, 1]) {
      const x = piece.x + dx,
        y = piece.y + dy;
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || board[y][x] !== null) {
        occupied++;
        if ([dy === 1, dx === 1, dy === -1, dx === -1][piece.rotation]) front++;
      }
    }
  if (occupied < 3) return null;
  // TETR.IO's kick index 3 excludes the base test; ours includes it.
  return front === 2 || kickIndex === 4 ? "full" : "mini";
}
export function lock(
  board: Board,
  piece: Piece,
): { board: Board; cleared: number } {
  if (collides(board, piece)) throw new Error("Cannot lock a colliding piece");
  const placed = board.map((row) => [...row]);
  for (const [x, y] of cells(piece)) placed[y][x] = piece.type;
  const kept = placed.filter((row) => row.some((cell) => cell === null));
  const cleared = HEIGHT - kept.length;
  return {
    board: [
      ...kept,
      ...Array.from({ length: cleared }, () => Array<Cell>(WIDTH).fill(null)),
    ],
    cleared,
  };
}
export function serialize(board: Board): string {
  return [...board]
    .reverse()
    .map((row) => row.map((c) => c ?? ".").join(""))
    .join("\n");
}
export function deserialize(text: string): Board {
  const rows = text.trim().split("\n");
  if (
    rows.length !== HEIGHT ||
    rows.some((row) => row.length !== WIDTH || /[^.IJLOSTZX]/.test(row))
  )
    throw new Error("Invalid board");
  return rows
    .reverse()
    .map((row) => [...row].map((c) => (c === "." ? null : (c as Cell))));
}
export function spawn(type: Tetromino): Piece {
  return { type, x: 4, y: type === "I" ? 20 : 21, rotation: 0 };
}
