import { type Board, HEIGHT } from "../board";
import { FLAT_TOP_ROWS } from "../lst";
import { heights } from "./evaluation";

// The source's second-TSD left section. Right five columns remain freestyle.
const SECOND = ["##.##", "##.##", "#...#", "...##"];
// Occupancy of the canonical L/S + J/Z scaffold, before inserting the Ts.
const CYCLE = ["##.##", "##.##", "#...#", "##.##", "#...#"];
export function evaluateLST(board: Board, tsds: number) {
  const h = heights(board);
  const height = Math.max(...h);
  const right = h.slice(5);
  const roughness = right
    .slice(1)
    .reduce((sum, v, i) => sum + Math.abs(v - right[i]), 0);
  const total = right.reduce((a, b) => a + b, 0);
  const unevenness =
    (5 * right.reduce((sum, v) => sum + v * v, 0) - total * total) / 5;
  const wellBlocks = board.reduce(
    (sum, row) => sum + Number(row[2] !== null),
    0,
  );
  const base =
    height * 6 +
    h.reduce((a, b) => a + b, 0) * 2 +
    roughness * 3 +
    unevenness * 2 +
    Math.max(0, height - 14) ** 2 * 250;
  let best = { holes: 0, cost: Infinity };
  // Fixed first/second-TSD guide, then actual slot construction at any height.
  const pivots =
    tsds < 2
      ? [tsds === 0 ? 1 : 2]
      : Array.from(
          { length: Math.min(HEIGHT - 2, Math.max(...h.slice(0, 5)) + 2) },
          (_, i) => i + 1,
        );
  for (const pivot of pivots) {
    let holes = 0,
      missing = 0,
      conflict = 0;
    const cavity = (x: number, y: number) =>
      (x === 2 && y === pivot - 1) || (y === pivot && x >= 1 && x <= 3);
    for (let x = 0; x < 10; x++)
      for (let y = 0; y < h[x]; y++) {
        if (
          board[y][x] === null &&
          !(wellBlocks === 0 && (x === 2 || cavity(x, y)))
        )
          holes++;
      }
    if (tsds < 2) {
      const rows = tsds === 0 ? FLAT_TOP_ROWS : SECOND;
      const width = tsds === 0 ? 10 : 5;
      for (let y = 0; y < Math.max(height, rows.length); y++)
        for (let x = 0; x < width; x++) {
          const wanted = rows[y]?.[x] !== undefined && rows[y][x] !== ".";
          if (wanted && board[y][x] === null) missing++;
          if (
            board[y][x] !== null &&
            (!wanted || (tsds === 0 && board[y][x] !== rows[y][x]))
          )
            conflict++;
        }
    } else {
      for (let y = pivot - 1; y <= pivot; y++)
        for (let x = 0; x < 10; x++) {
          if (cavity(x, y)) conflict += Number(board[y][x] !== null);
          else missing += Number(board[y][x] === null);
        }
      if (board[pivot + 1][1] === null && board[pivot + 1][3] === null)
        missing += 2;
    }
    // Treat intended cavity cells as planned access, never arbitrary buried holes.
    const cost =
      base + holes * 2000 + wellBlocks * 650 + missing * 18 + conflict * 400;
    if (cost < best.cost) best = { holes, cost };
  }
  let structure = 0;
  if (tsds >= 2) {
    structure = Math.min(
      ...CYCLE.map((_, offset) => {
        let mismatches = 0;
        for (let y = 0; y < Math.max(...h.slice(0, 5)); y++)
          for (let x = 0; x < 5; x++)
            if (board[y][x] !== null && CYCLE[(y + offset) % 5][x] === ".")
              mismatches++;
        return mismatches;
      }),
    );
  }
  return {
    holes: best.holes,
    wellBlocks,
    roughness,
    dependencies: structure,
    unevenness,
    height,
    cost: best.cost + structure * 35,
  };
}
