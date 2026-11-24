// Test-only search over reachable placements. It verifies that drill content
// (opener spins, perfect clears) is actually possible with the real engine;
// it is not shipped and is not a solver for players.
import {
  cells,
  lock,
  move,
  project,
  rotate,
  spawn,
  type Board,
  type Piece,
  type Tetromino,
} from "../../src/core/board";
import { Game } from "../../src/core/game";
import type { Action } from "../../src/core/settings";

const STEPS: Action[] = ["left", "right", "softDrop", "cw", "ccw", "flip"];

function step(board: Board, piece: Piece, action: Action): Piece {
  if (action === "left") return move(board, piece, -1, 0);
  if (action === "right") return move(board, piece, 1, 0);
  if (action === "softDrop") return project(board, piece);
  return rotate(board, piece, action === "cw" ? 1 : action === "ccw" ? -1 : 2);
}

/** Every pose reachable from spawn, with an input path to it. */
export function reachable(board: Board, type: Tetromino) {
  const start = spawn(type);
  const key = (p: Piece, rotated: boolean) =>
    `${p.x},${p.y},${p.rotation},${rotated}`;
  const seen = new Set([key(start, false)]);
  const out: { piece: Piece; path: Action[] }[] = [];
  let frontier = [{ piece: start, path: [] as Action[], rotated: false }];
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      out.push(node);
      for (const action of STEPS) {
        const moved = step(board, node.piece, action);
        if (moved === node.piece) continue;
        const rotated = action === "cw" || action === "ccw" || action === "flip";
        if (seen.has(key(moved, rotated))) continue;
        seen.add(key(moved, rotated));
        next.push({ piece: moved, path: [...node.path, action], rotated });
      }
    }
    frontier = next;
  }
  return out;
}

/** Distinct boards after locking one piece anywhere it can reach. */
export function lockings(board: Board, type: Tetromino) {
  const seen = new Map<string, { board: Board; piece: Piece; cleared: number }>();
  for (const { piece } of reachable(board, type)) {
    const landing = project(board, piece);
    const id = cells(landing).map(String).sort().join(" ");
    if (seen.has(id)) continue;
    seen.set(id, { ...lock(board, landing), piece: landing });
  }
  return [...seen.values()];
}

/**
 * Replays paths through a real Game until a T lock satisfies `accept`.
 * Returns the inputs that did it, so tests prove the spin via key handling.
 */
export function findTSpin(
  board: Board,
  accept: (game: Game) => boolean,
): Action[] | null {
  for (const { path } of reachable(board, "T")) {
    const game = new Game(1);
    game.state.board = board.map((row) => [...row]);
    game.state.active = spawn("T");
    for (const action of [...path, "hardDrop" as const]) {
      game.keyDown(action);
      game.keyUp(action);
    }
    if (accept(game)) return path;
  }
  return null;
}

const isEmpty = (board: Board) => board.every((row) => row.every((c) => !c));

/** Can the queue (with optional hold) reach a perfect clear within `depth` pieces? */
export function perfectClear(
  board: Board,
  queue: readonly Tetromino[],
  hold: Tetromino | null,
  depth: number,
): Tetromino[] | null {
  if (isEmpty(board)) return [];
  if (depth === 0 || !queue.length) return null;
  const [current, ...rest] = queue;
  const options: [Tetromino, Tetromino[], Tetromino | null][] = [
    [current, rest, hold],
  ];
  if (hold && hold !== current) options.push([hold, rest, current]);
  if (!hold && rest.length) options.push([rest[0], rest.slice(1), current]);
  for (const [piece, remaining, held] of options)
    for (const next of lockings(board, piece)) {
      // Prune boards with filled cells above the 4-line PC area.
      if (next.board.slice(4).some((row) => row.some(Boolean))) continue;
      const found = perfectClear(next.board, remaining, held, depth - 1);
      if (found) return [piece, ...found];
    }
  return null;
}
