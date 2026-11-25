import { emptyBoard, HEIGHT, TYPES, WIDTH } from "./board";
import type { Board, Cell, Tetromino } from "./board";

/** A fixed starting point for a puzzle. State fields mirror GameState. */
export type Position = {
  /** Top-down rows, 10 wide: piece letters, X garbage, "." empty. */
  rows: string[];
  /** Pieces dealt first; the game continues with random bags after them. */
  queue: Tetromino[];
  hold?: Tetromino | null;
  /** Starting B2B counter as Game stores it (-1 means none). */
  b2b?: number;
  combo?: number;
  /** Garbage packets (lines each) that land on the next non-clearing lock. */
  incoming?: number[];
};

/** Top-down text rows to board cells, with the last row at y = 0. */
export function rowsToCells(rows: readonly string[]) {
  return rows.flatMap((row, i) =>
    [...row].flatMap((char, x) =>
      char === "." ? [] : [{ x, y: rows.length - 1 - i, char }],
    ),
  );
}

/** Board from top-down rows. "G" (opener guides) fills as garbage. */
export function boardFromRows(rows: readonly string[]): Board {
  const board = emptyBoard();
  for (const { x, y, char } of rowsToCells(rows))
    board[y][x] = (char === "G" ? "X" : char) as Cell;
  return board;
}

const SWAP: Record<Tetromino, Tetromino> = {
  I: "I", O: "O", T: "T", J: "L", L: "J", S: "Z", Z: "S",
};

/** Left-right mirror: x becomes 9 - x, J and L swap, S and Z swap. */
export function mirrorPosition(p: Position): Position {
  const swapChar = (c: string) => SWAP[c as Tetromino] ?? c;
  return {
    ...p,
    rows: p.rows.map((row) => [...row].reverse().map(swapChar).join("")),
    queue: p.queue.map((t) => SWAP[t]),
    ...(p.hold !== undefined && { hold: p.hold && SWAP[p.hold] }),
  };
}

/** Problems with a position; empty when it is playable. */
export function validatePosition(p: Position): string[] {
  const errors: string[] = [];
  if (p.rows.length > HEIGHT) errors.push(`More than ${HEIGHT} rows`);
  p.rows.forEach((row, i) => {
    if (row.length !== WIDTH) errors.push(`Row ${i} is not ${WIDTH} wide`);
    else if (/[^.IJLOSTZX]/.test(row)) errors.push(`Row ${i} has a bad character`);
    else if (!row.includes(".")) errors.push(`Row ${i} is already full`);
  });
  if (p.queue.length === 0) errors.push("Empty queue");
  if (p.queue.some((t) => !TYPES.includes(t))) errors.push("Bad piece in queue");
  if (p.hold && !TYPES.includes(p.hold)) errors.push("Bad hold piece");
  if (p.incoming?.some((n) => !Number.isInteger(n) || n < 1))
    errors.push("Incoming garbage must be positive whole numbers");
  return errors;
}
