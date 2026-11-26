import { emptyBoard } from "../../src/core/board";
import type { Board, Tetromino } from "../../src/core/board";
import type { OpenerDef } from "../../src/core/openers";
import { rowsToCells } from "../../src/core/position";
import { findPlacements } from "../../src/core/spins";
import type { Placement } from "../../src/core/spins";
import { chainSearch } from "../../src/core/structures";

/**
 * Verifier only: backtracks one placement per queue piece so every cell lands
 * on its own piece's cell of the sourced guide or on a free `G` cell, with no
 * line clears. A plan counts only if every guide piece cell is filled and the
 * opener's spins chain on the result. Returns null when no such build exists.
 */
export function planGuide(
  def: OpenerDef,
  queue: readonly Tetromino[],
  instantSoftDrop: boolean,
): Placement[] | null {
  const cells = new Map(rowsToCells(def.guide).map((c) => [`${c.x},${c.y}`, c.char]));
  const pieceCells = rowsToCells(def.guide).filter((c) => /[IJLOSTZ]/.test(c.char));
  const works = (board: Board) =>
    pieceCells.every((c) => board[c.y]?.[c.x]) &&
    chainSearch(board, def.goals.length).some(
      (c) =>
        c.spins.length === def.goals.length &&
        c.spins.every((s, i) => {
          const g = def.goals[i];
          return s.spin === "full" && g.kind === "tspin" && s.lines === g.lines;
        }),
    );
  const go = (board: Board, i: number): Placement[] | null => {
    if (i === queue.length) return works(board) ? [] : null;
    for (const p of findPlacements(board, queue[i], { instantSoftDrop })) {
      if (p.lines !== 0) continue;
      const ok = p.after.every((row, y) =>
        row.every((c, x) => {
          if (c === board[y][x]) return true;
          const want = cells.get(`${x},${y}`);
          return want === queue[i] || want === "G";
        }),
      );
      const rest = ok && go(p.after, i + 1);
      if (rest) return [p, ...rest];
    }
    return null;
  };
  return go(emptyBoard(), 0);
}
