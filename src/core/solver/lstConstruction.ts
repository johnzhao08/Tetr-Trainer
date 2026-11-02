import {
  cells,
  HEIGHT,
  TYPES,
  type Board,
  type Piece,
  type Rotation,
  type Tetromino,
} from "../board";
import { heights } from "./evaluation";

// A construction describes occupied SUPPORT and protected empty space, not a
// prescription for which pieces build the right side. Each row covers x=0..4.
export type Construction = { rows: number[] };
const cycle = [27, 27, 17, 27, 17]; // ##.##, ##.##, #...#, ##.##, #...#
const key = (c: Construction) => c.rows.join(",");
export function constructionKey(states: Construction[]) {
  return states.map(key).sort().join(";");
}

function compatible(board: Board, c: Construction) {
  return board.every((row, y) =>
    row
      .slice(0, 5)
      .every((cell, x) => cell === null || Boolean(c.rows[y] & (1 << x))),
  );
}

// Reconstruct plausible *local phases and clear residues*, not complete-board
// snapshots. The unbounded repeating scaffold is clipped only at board height.
// A completed TSD removes a support row followed by its arm cavity. Enumerating
// residues only through the occupied band avoids exponential whole-board masks.
export function inferConstructions(board: Board): Construction[] {
  const top = Math.max(...heights(board).slice(0, 5));
  let filled = 0;
  while (filled < top && board[filled].every((v, x) => x === 2 || v !== null))
    filled++;
  const prefix = Math.floor(filled / 4) * 4;
  const candidates: Construction[] = [];
  const seen = new Set<string>();
  const visit = (c: Construction, removals: number) => {
    const id = key(c);
    if (seen.has(id)) return;
    seen.add(id);
    if (compatible(board, c)) candidates.push(c);
    if (removals === 0) return;
    // Only the lower residue needs reconstruction. Higher pending cavities
    // remain explicit, including consecutive setups while waiting for T.
    for (let y = prefix; y < Math.min(top + 1, 8 + prefix); y++) {
      if (c.rows[y] === 27 && c.rows[y + 1] === 17) {
        const rows = c.rows.filter((_, i) => i !== y && i !== y + 1);
        rows.push(27, 17);
        visit({ rows }, removals - 1);
      }
    }
  };
  for (let phase = 0; phase < 5; phase++) {
    visit(
      {
        rows: Array.from({ length: HEIGHT }, (_, y) =>
          y < prefix ? 27 : cycle[(y - prefix + phase) % 5],
        ),
      },
      2,
    );
  }
  return candidates;
}

// Preserve the SAME interpretations through a move. Do not choose a fresh
// vertical phase just because a placement raised the stack.
export function advanceConstructions(
  states: Construction[],
  board: Board,
  piece: Piece,
): Construction[] {
  const placed = board.map((r) => [...r]);
  for (const [x, y] of cells(piece)) placed[y][x] = piece.type;
  const removed = new Set(
    placed.flatMap((row, y) => (row.every((v) => v !== null) ? [y] : [])),
  );
  const seen = new Set<string>();
  return states.flatMap((c) => {
    // T/I may occupy the well only as part of the clear that consumes them.
    if (
      cells(piece).some(
        ([x, y]) => !removed.has(y) && x < 5 && !(c.rows[y] & (1 << x)),
      )
    )
      return [];
    const rows = c.rows.filter((_, y) => !removed.has(y));
    // Continue the existing top phase. This affects only newly exposed hidden rows.
    const tail = c.rows.slice(-5);
    while (rows.length < HEIGHT)
      rows.push(tail[(rows.length - (HEIGHT - removed.size)) % 5]);
    const next = { rows };
    const id = key(next);
    if (seen.has(id)) return [];
    seen.add(id);
    return [next];
  });
}

// Translation-invariant candidate shapes covering (0,0), deduplicated once.
// O/I/S/Z rotational aliases must not multiply every completion check.
const completionShapes = TYPES.filter((t) => t !== "T").flatMap((type) => {
  const seen = new Set<string>();
  const result: { type: Tetromino; offsets: number[][] }[] = [];
  for (let r = 0; r < 4; r++) {
    const shape = cells({ type, rotation: r as Rotation, x: 0, y: 0 });
    for (const [ax, ay] of shape) {
      const offsets = shape.map(([x, y]) => [x - ax, y - ay]);
      const key = offsets
        .map(([x, y]) => `${x},${y}`)
        .sort()
        .join(";");
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ type, offsets });
      }
    }
  }
  return result;
});

export type Obligation = { x: number; y: number; pieces: Tetromino[] };
export type ConstructionEvidence = {
  conflicts: number;
  missing: number;
  impossible: number;
  obligations: Obligation[];
  cavities: number[];
};
export function constructionEvidence(
  board: Board,
  state: Construction,
): ConstructionEvidence {
  const h = heights(board);
  const top = Math.max(...h.slice(0, 6));
  const obligations: Obligation[] = [];
  const completions: number[][][] = [];
  let missing = 0,
    impossible = 0,
    conflicts = 0;
  const cavities: number[] = [];
  for (let y = 0; y < Math.min(HEIGHT - 1, top + 2); y++) {
    if (y > 0 && state.rows[y] === 17 && state.rows[y - 1] === 27)
      cavities.push(y);
    for (const x of [0, 1, 3, 4]) {
      const wanted = Boolean(state.rows[y] & (1 << x));
      if (board[y][x] !== null) {
        if (!wanted) conflicts++;
        continue;
      }
      // The right boundary belongs to the whole right stack: column 6 can
      // wall off an unfinished cell in column 5 even if columns 4/5 are low.
      const rightTop = Math.max(h[3], h[4], h[5]);
      const frontier =
        x < 2 ? Math.max(h[0], h[1]) : rightTop + Number(rightTop > 0);
      if (!wanted || y >= frontier) continue;
      missing++;
      const pieces: Tetromino[] = [];
      const candidates: number[][] = [];
      for (const { type, offsets } of completionShapes) {
        if (x < 2 && ((type !== "L" && type !== "S") || pieces.includes(type)))
          continue;
        if (
          !offsets.every(([dx, dy]) => {
            const px = x + dx,
              py = y + dy;
            return (
              px >= 0 &&
              px < 10 &&
              py >= 0 &&
              py < HEIGHT &&
              board[py][px] === null &&
              (px >= 5 || Boolean(state.rows[py] & (1 << px)))
            );
          })
        )
          continue;
        if (!pieces.includes(type)) pieces.push(type);
        if (x >= 3)
          candidates.push(
            offsets
              .map(([dx, dy]) => (y + dy) * 10 + x + dx)
              .sort((a, b) => a - b),
          );
      }
      if (!pieces.length) impossible++;
      obligations.push({ x, y, pieces });
      if (x >= 3 && candidates.length) completions.push(candidates);
    }
  }
  // Optimistic simultaneous completion: two obligations cannot both claim
  // overlapping, different tetrominoes. One piece may satisfy both obligations.
  // This is still a local warning; an actually searched clear can resolve it.
  for (let i = 0; i < completions.length; i++)
    for (let j = i + 1; j < completions.length; j++) {
      const compatible = completions[i].some((a) =>
        completions[j].some(
          (b) =>
            a.every((v, k) => v === b[k]) || a.every((v) => !b.includes(v)),
        ),
      );
      if (!compatible) impossible++;
    }
  return { conflicts, missing, impossible, obligations, cavities };
}

// Optimistic evidence only. Actual queue consumption, reachability and jointly
// satisfying these obligations are handled by the main search, never fabricated.
export function viableConstructions(
  board: Board,
  states = inferConstructions(board),
) {
  return states.filter((s) => constructionEvidence(board, s).impossible === 0);
}

export function constructionBoardKey(board: Board) {
  return board.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("");
}
