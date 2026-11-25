import { cells, emptyBoard, TYPES, WIDTH } from "./board";
import type { Board, Tetromino } from "./board";
import { analyzeBoard, reviewPlacement } from "./coach";
import { nextRandom } from "./rng";
import { findPlacements } from "./spins";
import type { Placement } from "./spins";

export type StackOpts = {
  /** Pieces to place, 8 to 30 (default 18). */
  pieces?: number;
  /** Random penalty added to each candidate, in coach penalty points (default 2). */
  noise?: number;
  /** Board to keep stacking on instead of an empty one. */
  base?: Board;
  /** Placements whose result fails this are skipped (keeps a slot alive). */
  keep?: (board: Board) => boolean;
  /** Column kept open as the well; chosen from the seed by default. */
  well?: number;
};
type Scored = { move: Placement; rough: number };
export type Stack = { board: Board; well: number; pieces: number };

export const MIN_PIECES = 8;
export const MAX_PIECES = 30;
// Above this many rows the stacker stops protecting the well.
const FILL_WELL_AT = 14;
// Placements graded exactly per piece.
const FINALISTS = 3;

/**
 * A realistic midgame stack: a greedy stacker plays a seeded 7-bag with the
 * engine's own placements, picks the lowest coach penalty plus noise, avoids
 * the well column, and never holds. Deterministic per `(seed, opts)`.
 */
export function generateStack(seed: number, opts: StackOpts = {}): Stack {
  const total = Math.min(
    MAX_PIECES,
    // Extra pieces on a base may be as few as none.
    Math.max(opts.base ? 0 : MIN_PIECES, Math.round(opts.pieces ?? 18)),
  );
  const noise = opts.noise ?? 2;
  const rng = { rng: seed >>> 0 };
  const well = opts.well ?? Math.floor(nextRandom(rng) * WIDTH);
  let board: Board = (opts.base ?? emptyBoard()).map((row) => [...row]);
  let bag: Tetromino[] = [];
  let placed = 0;
  while (placed < total) {
    if (bag.length === 0) {
      bag = [...TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(nextRandom(rng) * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    const type = bag.pop()!;
    placed++;
    const high = analyzeBoard(board).maxHeight >= FILL_WELL_AT;
    // reviewPlacement is exact but slow, so a cheap shape score picks the
    // few finalists it grades.
    const scored = findPlacements(board, type).map((move) => {
      const shape = analyzeBoard(move.after);
      let rough =
        shape.holes * 4 + shape.coveredCells + shape.bumpiness * 0.4 +
        shape.maxHeight * 0.2;
      if (!high) {
        for (const [x] of cells(move.piece)) if (x === well) rough += 3;
        rough += move.lines;
      }
      return { move, rough };
    });
    scored.sort((a, b) => a.rough - b.rough);
    let best: { move: Placement; cost: number } | null = null;
    const finalists: Scored[] = [];
    for (const c of scored) {
      if (finalists.length === FINALISTS) break;
      if (!opts.keep || opts.keep(c.move.after)) finalists.push(c);
    }
    for (const { move, rough } of finalists) {
      const cost =
        reviewPlacement(board, move.after, {
          cleared: move.lines,
          mainWell: well,
        }).penalty +
        rough * 0.1 +
        nextRandom(rng) * noise;
      if (best === null || cost < best.cost) best = { move, cost };
    }
    if (!best) break;
    board = best.move.after;
  }
  return { board, well, pieces: placed };
}
