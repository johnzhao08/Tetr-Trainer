import {
  cells,
  collides,
  HEIGHT,
  TYPES,
  type Board,
  type Piece,
  type Rotation,
} from "../board";
import { heights } from "./evaluation";
import { LST_PATTERNS } from "./lstPatterns";

// Include residues after clearing either complete TSD band in each source shape.
const patterns: string[][] = [];
const seen = new Set<string>();
function add(rows: string[]) {
  const key = rows.join("/");
  if (seen.has(key)) return;
  seen.add(key);
  patterns.push(rows);
  for (let y = 0; y + 1 < rows.length; y++)
    if (
      rows[y][1] === "#" &&
      rows[y][3] === "#" &&
      rows[y + 1][1] === "." &&
      rows[y + 1][3] === "."
    )
      add(rows.filter((_, i) => i !== y && i !== y + 1));
}
for (const p of LST_PATTERNS) add(p.rows.map((row) => row.slice(0, 5)));
for (let phase = 0; phase < 5; phase++)
  add(
    Array.from(
      { length: 8 },
      (_, y) => ["##.##", "##.##", "#...#", "##.##", "#...#"][(y + phase) % 5],
    ),
  );

// Cover taller repetitions without recursively enumerating every possible
// subset of cleared bands. Short pure/mixed residues above remain supported.
for (let phase = 0; phase < 5; phase++)
  patterns.push(
    Array.from(
      { length: HEIGHT },
      (_, y) => ["##.##", "##.##", "#...#", "##.##", "#...#"][(y + phase) % 5],
    ),
  );

// Optimistic geometric completion: if even an unrestricted future non-T piece
// cannot fill a required cell, that boundary is dead. Actual moves still use SRS+.
export function preservesLST(board: Board): boolean {
  const h = heights(board),
    top = Math.max(...h.slice(0, 5));
  if (h[2] > 0) return false;
  // Only complete four-row I-well bands can be omitted from the bottom.
  // Raising the surface cannot hide unfinished overhang geometry. These bands
  // contain no cavities and the corrective I Quad removes exactly four rows.
  let filled = 0;
  while (
    filled < top &&
    board[filled].every((cell, x) => x === 2 || cell !== null)
  )
    filled++;
  const base = Math.floor(filled / 4) * 4;
  for (const rows of patterns) {
    if (base + rows.length < top) continue;
    const allowed = (x: number, y: number) =>
      x >= 5 ||
      (x !== 2 &&
        (y < base || (y < base + rows.length && rows[y - base][x] === "#")));
    let conflict = false;
    for (let y = base; y < top && !conflict; y++)
      for (let x = 0; x < 5; x++)
        if (board[y][x] !== null && !allowed(x, y)) {
          conflict = true;
          break;
        }
    if (conflict) continue;
    let possible = true;
    // Check both rails: a locally plausible right phase can strand the next left piece.
    for (let y = base; y < top && possible; y++)
      for (const x of [0, 1, 3, 4]) {
        if (y >= Math.max(h[x < 2 ? 0 : 3], h[x < 2 ? 1 : 4])) continue;
        if (board[y][x] !== null || !allowed(x, y)) continue;
        let fillable = false;
        outer: for (const type of TYPES) {
          if (type === "T") continue;
          for (let rotation = 0; rotation < 4; rotation++) {
            const shape = cells({
              type,
              x: 0,
              y: 0,
              rotation: rotation as Rotation,
            });
            for (const [dx, dy] of shape) {
              const p: Piece = {
                type,
                x: x - dx,
                y: y - dy,
                rotation: rotation as Rotation,
              };
              if (
                !collides(board, p) &&
                cells(p).every(([px, py]) => py < HEIGHT && allowed(px, py))
              ) {
                fillable = true;
                break outer;
              }
            }
          }
        }
        if (!fillable) {
          possible = false;
          break;
        }
      }
    if (possible) return true;
  }
  return false;
}
