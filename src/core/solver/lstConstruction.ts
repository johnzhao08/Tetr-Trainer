import {
  cells,
  collides,
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
  const top = Math.max(...h.slice(0, 5));
  const obligations: Obligation[] = [];
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
      if (!wanted || y >= Math.max(h[x < 2 ? 0 : 3], h[x < 2 ? 1 : 4]))
        continue;
      missing++;
      const pieces: Tetromino[] = [];
      for (const type of x < 2 ? (["L", "S"] as const) : TYPES) {
        if (type === "T") continue;
        let fits = false;
        for (let r = 0; r < 4 && !fits; r++) {
          const rotation = r as Rotation;
          for (const [dx, dy] of cells({ type, rotation, x: 0, y: 0 })) {
            const p = { type, rotation, x: x - dx, y: y - dy };
            if (
              !collides(board, p) &&
              cells(p).every(
                ([px, py]) => px >= 5 || Boolean(state.rows[py] & (1 << px)),
              )
            ) {
              fits = true;
              break;
            }
          }
        }
        if (fits) pieces.push(type);
      }
      if (!pieces.length) impossible++;
      obligations.push({ x, y, pieces });
    }
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
