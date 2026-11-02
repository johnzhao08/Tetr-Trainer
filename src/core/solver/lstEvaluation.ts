import { type Board, HEIGHT } from "../board";
import { FLAT_TOP_ROWS } from "../lst";
import {
  constructionEvidence,
  inferConstructions,
  type Construction,
} from "./lstConstruction";
import { heights } from "./evaluation";

// The source's second-TSD left section. Right five columns remain freestyle.
const SECOND = ["##.##", "##.##", "#...#", "...##"];
// Occupancy of the canonical L/S + J/Z scaffold, before inserting the Ts.

export function evaluateLST(
  board: Board,
  tsds: number,
  constructions?: Construction[],
) {
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
  // Freestyle does not mean unconstrained: narrow depressions consume specific
  // pieces, and a high right wall can outrun the next LST band entirely.
  let notches = 0;
  for (let x = 5; tsds >= 2 && x < 10; x++) {
    const depth = Math.min(h[x - 1], x === 9 ? Infinity : h[x + 1]) - h[x];
    if (depth >= 3) notches += 80 + (depth - 3) * 40;
    else if (depth === 2) notches += 24;
  }
  const bandHeight = Math.max(h[0], h[1], h[3], h[4]);
  const excess = Math.max(0, Math.max(...right) - bandHeight - 2);
  const balance = tsds >= 2 ? excess * excess * 20 : 0;
  const base =
    height * 6 +
    h.reduce((a, b) => a + b, 0) * 2 +
    roughness * 3 +
    unevenness * 2 +
    balance +
    notches * 6 +
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
  let supportDebt = 0;
  let impossible = 0;
  let unresolved = 0;
  let recognized = true;
  if (tsds >= 2) {
    const states = constructions ?? inferConstructions(board);
    recognized = states.length > 0;
    if (recognized) {
      const candidates = states
        .map((state) => {
          const evidence = constructionEvidence(board, state);
          let holes = 0;
          for (let x = 0; x < 10; x++)
            for (let y = 0; y < h[x]; y++) {
              const planned =
                x === 2 || ((x === 1 || x === 3) && state.rows[y] === 17);
              if (board[y][x] === null && !planned) holes++;
            }
          const debt = Math.min(
            18,
            ...evidence.cavities.map((pivot) => {
              const cavity = (x: number, y: number) =>
                (x === 2 && y === pivot - 1) ||
                (y === pivot && x >= 1 && x <= 3);
              let missing = 0;
              for (let y = pivot - 1; y <= pivot; y++)
                for (let x = 0; x < 10; x++) {
                  if (cavity(x, y)) {
                    if (board[y][x] !== null) return 18;
                  } else missing += Number(board[y][x] === null);
                }
              if (board[pivot + 1][1] === null && board[pivot + 1][3] === null)
                missing++;
              return missing;
            }),
          );
          return { evidence, holes, debt };
        })
        .sort(
          (a, b) =>
            a.evidence.impossible - b.evidence.impossible ||
            a.holes - b.holes ||
            a.debt - b.debt ||
            a.evidence.missing - b.evidence.missing,
        );
      const chosen = candidates[0];
      // An empty board has no outstanding construction obligation; a corrective
      // Quad that achieves an all clear must not be punished for erasing its setup.
      supportDebt = height === 0 ? 0 : chosen.debt;
      impossible = chosen.evidence.impossible;
      unresolved = chosen.evidence.missing;
      best = {
        holes: chosen.holes,
        cost: base + chosen.holes * 2000 + wellBlocks * 650 + unresolved * 18,
      };
    }
  }

  return {
    holes: best.holes,
    wellBlocks,
    roughness,
    dependencies: notches,
    unevenness,
    height,
    cost: best.cost,
    supportDebt,
    recognized,
    impossible,
    unresolved,
    balance,
  };
}
