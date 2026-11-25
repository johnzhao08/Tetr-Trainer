// Test-only: replay a lesson puzzle's outline piece by piece with the real
// engine. Every ghost must be a reachable footprint; each ghost that belongs
// to a goal step must also score that step (a T ghost moved to the wrong
// square, or one that no longer spins, fails). The outline may be mirrored:
// cells flip left to right and the piece type swaps.
import { cells, project } from "../../src/core/board";
import type { Piece, Tetromino } from "../../src/core/board";
import type { PuzzleDef } from "../../src/core/puzzle";
import { PuzzleSession, flattenGoal } from "../../src/core/puzzle";
import { defaultSettings } from "../../src/core/settings";
import type { Action } from "../../src/core/settings";
import { reachable } from "./search";

const SWAP: Record<Tetromino, Tetromino> = { I: "I", O: "O", T: "T", J: "L", L: "J", S: "Z", Z: "S" };
const keyOf = (xy: readonly (readonly [number, number])[]) =>
  xy.map(([x, y]) => y * 10 + x).sort((a, b) => a - b).join();

const play = (session: PuzzleSession, keys: Action[]) => {
  for (const key of [...keys, "hardDrop" as const]) {
    session.keyDown(key);
    session.keyUp(key);
  }
};

export function solveGuided(
  def: PuzzleDef,
  outline: readonly Piece[],
  mirrored: boolean,
): boolean {
  const session = new PuzzleSession(def, 1, defaultSettings());
  const fillers = def.position.queue.length - flattenGoal(def.goal).length;
  if (outline.length !== def.position.queue.length) return false;
  for (const [i, want] of outline.entries()) {
    const active = session.game.state.active;
    const type = mirrored ? SWAP[want.type] : want.type;
    if (!active || active.type !== type) return false;
    const target = keyOf(cells(want).map(([x, y]) => [mirrored ? 9 - x : x, y] as const));
    const board = session.game.state.board;
    const met = session.progress.met;
    let ok = false;
    for (const { piece, path } of reachable(board, type)) {
      if (keyOf(cells(project(board, piece))) !== target) continue;
      play(session, path);
      if (session.progress.met - met === (i >= fillers ? 1 : 0)) {
        ok = true;
        break;
      }
      session.undo();
    }
    if (!ok) return false;
  }
  return session.status === "solved";
}
