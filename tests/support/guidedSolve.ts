// Test-only: solve a lesson puzzle by playing its outline for the filler
// pieces (so the search stays small), then searching the T spins. The outline
// may be mirrored: cells flip left to right and the piece type swaps.
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
  for (const want of outline.slice(0, fillers)) {
    const active = session.game.state.active!;
    const type = mirrored ? SWAP[want.type] : want.type;
    const target = keyOf(cells(want).map(([x, y]) => [mirrored ? 9 - x : x, y] as const));
    if (active.type !== type) return false;
    const board = session.game.state.board;
    const hit = reachable(board, type).find(
      ({ piece }) => keyOf(cells(project(board, piece))) === target,
    );
    if (!hit) return false;
    play(session, hit.path);
  }
  const dfs = (): boolean => {
    const active = session.game.state.active;
    if (session.status === "solved") return true;
    if (session.status !== "playing" || !active) return false;
    const board = session.game.state.board;
    const seen = new Set<string>();
    for (const { piece, path } of reachable(board, active.type)) {
      const sig = `${keyOf(cells(project(board, piece)))}|${path.at(-1) ?? ""}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const before = session.progress.met;
      play(session, path);
      if ((session.status as string) === "solved") return true;
      if (session.progress.met > before && dfs()) return true;
      session.undo();
    }
    return false;
  };
  return dfs();
}
