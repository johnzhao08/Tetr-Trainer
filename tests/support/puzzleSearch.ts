// Test-only search for a key sequence that solves a puzzle through the real
// session. T poses are tried in full; other pieces are deduplicated by where
// they land. A branch only continues after a T completes a goal step (or
// after a filler), which keeps two- and three-piece chains cheap.
import { cells, project } from "../../src/core/board";
import type { PuzzleDef } from "../../src/core/puzzle";
import { PuzzleSession } from "../../src/core/puzzle";
import { defaultSettings } from "../../src/core/settings";
import type { Action } from "../../src/core/settings";
import { reachable } from "./search";

const play = (session: PuzzleSession, keys: Action[]) => {
  for (const key of [...keys, "hardDrop" as const]) {
    session.keyDown(key);
    session.keyUp(key);
  }
};

/** Path per piece that solves `def`, or null. */
export function solvePuzzle(def: PuzzleDef): Action[][] | null {
  const session = new PuzzleSession(def, 1, defaultSettings());
  const dfs = (path: Action[][]): Action[][] | null => {
    const active = session.game.state.active;
    if (session.status !== "playing" || !active) return null;
    const board = session.game.state.board;
    const seen = new Set<string>();
    for (const { piece, path: keys } of reachable(board, active.type)) {
      const id = cells(project(board, piece)).map(String).sort().join(" ");
      const last = keys.at(-1) ?? "";
      const sig = active.type === "T" ? `${id}|${last}` : id;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const before = session.progress.met;
      play(session, keys);
      const next = [...path, keys];
      if ((session.status as string) === "solved") return next;
      const advanced = session.progress.met > before;
      const found = active.type !== "T" || advanced ? dfs(next) : null;
      if (found) return found;
      session.undo();
    }
    return null;
  };
  return dfs([]);
}
