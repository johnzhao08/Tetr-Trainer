import { HEIGHT, WIDTH } from "../board";
import { stackTop, type Rows } from "./bitboard";

// LST geometry, zero-based columns:
//   0-1  L/S rail      2  open well (T stem, corrective I)
//   3-4  boundary      5-9  free stacking
// A T-spin double slot at pivot row p is the reverse T at (1..3, p) + (2, p-1).
// Row p-1 must be full except the well; row p full except columns 1-3; and one
// of (1, p+1) / (3, p+1) is the roof. The rail alone decides where slots are:
// a slot row is a row whose column 1 is deliberately left empty.
//
// The reading below is recomputed from the board on every call. Nothing is
// carried between positions, so a board the player reached by any route (or
// damaged) is always evaluated on its own merits instead of being rejected.

const bit = (rows: Rows, x: number, y: number) =>
  y >= 0 && y < HEIGHT ? (rows[y] >> x) & 1 : 0;

const RESIDUE = ((1 << WIDTH) - 1) ^ 4; // every column but the well

export const WEIGHTS = {
  hole: 1300,
  wellBlock: 900,
  railDefect: 450,
  rephase: 110,
  // Rows of filler the rail needs before its next slot clears the boundary.
  deficit: 130,
  trench: 420,
  debt: 14,
  slot: 110,
  secondSlot: 45,
  bump: 9,
  cliff: 26,
  well: 45,
  heightSum: 3.5,
  heightMax: 5,
  imbalance: 22,
  residueRow: 28,
  quadReady: 90,
  dangerFrom: 11,
  danger: 70,
};

export type LstSlot = {
  pivot: number;
  // Roofed by the rail at (1, pivot + 1); otherwise still open on top.
  roofed: boolean;
  // Open slot whose roof is the boundary cell (3, pivot + 1).
  rightRoof: boolean;
  // Cells still missing from the two clear rows (plus one for a missing roof).
  debt: number;
};

export type LstEval = {
  cost: number;
  holes: number;
  wellBlocks: number;
  roughness: number;
  height: number;
  // Usable T-spin double slots, top first (the order they must be taken in).
  slots: LstSlot[];
  // Cells missing before the next double can be taken.
  debt: number;
  railDefect: number;
  deficit: number;
  trench: boolean;
  residueRows: number;
  // Holes, a blocked well, a broken rail or a boundary that outran the rail.
  damaged: boolean;
};

const heights = new Int32Array(WIDTH);
const gone = new Uint8Array(HEIGHT);
const planned1 = new Uint8Array(HEIGHT);
const planned3 = new Uint8Array(HEIGHT);
// Empty right-side cells (columns 3-9) in rows 0..y.
const owed = new Int32Array(HEIGHT + 1);

export function evaluateLst(rows: Rows, top = stackTop(rows)): LstEval {
  for (let x = 0; x < WIDTH; x++) {
    let y = top;
    while (y > 0 && !((rows[y - 1] >> x) & 1)) y--;
    heights[x] = y;
  }
  const h0 = heights[0],
    h1 = heights[1],
    h4 = heights[4];
  let wellBlocks = 0;
  for (let y = 0; y < top; y++) {
    wellBlocks += (rows[y] >> 2) & 1;
    gone[y] = planned1[y] = planned3[y] = 0;
  }
  const wellOpen = (y: number) => !bit(rows, 2, y) && !bit(rows, 2, y - 1);
  // Boundary cells above row s that would stop a T descending column 3,
  // ignoring rows that an earlier (higher) double will already have cleared.
  const above3 = (s: number) => {
    let count = 0;
    for (let y = s + 1; y < top; y++) if (!gone[y]) count += (rows[y] >> 3) & 1;
    return count;
  };
  for (let y = 0, sum = 0; y < HEIGHT; y++) {
    let filled = 0;
    if (y < top) for (let v = rows[y] >> 3; v; v &= v - 1) filled++;
    owed[y] = sum += 7 - filled;
  }
  const slots: LstSlot[] = [];
  const d = h0 - h1;
  let rephase = 0;
  // The open slot on top of the rail: after S (d = 1) or L (d = 2).
  if (d === 1 || d === 2) {
    const u = h1;
    const valid =
      u >= 1 &&
      bit(rows, 0, u - 1) === 1 &&
      bit(rows, 0, u) === 1 &&
      wellOpen(u) &&
      !bit(rows, 3, u);
    const overhead = valid ? above3(u) : 0;
    const rightRoof = overhead > 0 && bit(rows, 3, u + 1) === 1;
    if (valid && (overhead === 0 || rightRoof)) {
      gone[u] = gone[u - 1] = 1;
      planned3[u] = 1;
      slots.push({
        pivot: u,
        roofed: false,
        rightRoof,
        debt: rightRoof ? 0 : 1,
      });
    } else rephase = 1;
  }
  // Slots already roofed by the next rail piece, highest first.
  for (let y = h1 - 2; y >= 1; y--) {
    if (bit(rows, 1, y)) continue;
    const usable =
      bit(rows, 1, y - 1) === 1 &&
      bit(rows, 1, y + 1) === 1 &&
      bit(rows, 0, y) === 1 &&
      bit(rows, 0, y - 1) === 1 &&
      wellOpen(y) &&
      !bit(rows, 3, y) &&
      above3(y) === 0;
    if (!usable) continue; // stays an ordinary hole
    gone[y] = gone[y - 1] = 1;
    planned1[y] = planned3[y] = 1;
    slots.push({ pivot: y, roofed: true, rightRoof: false, debt: 0 });
  }

  let holes = 0;
  for (let x = 0; x < WIDTH; x++) {
    if (x === 2) continue;
    for (let y = heights[x] - 2; y >= 0; y--) {
      if ((rows[y] >> x) & 1) continue;
      if ((x === 1 && planned1[y]) || (x === 3 && planned3[y])) continue;
      holes++;
    }
  }

  let railDefect = 0;
  if (d < 0) railDefect = -d;
  else if (d > 2) railDefect = d - 2;

  // Everything on the right at or below a slot row has to be filled before
  // that double fires; the slot cells in column 3 are the only exceptions.
  for (let i = 0; i < slots.length; i++)
    slots[i].debt += owed[slots[i].pivot] - (slots.length - i);

  // Heights once every usable slot has been cleared: what the rail's next
  // piece will have to line up with.
  let v = 0,
    v0 = 0,
    v1 = 0,
    v3 = 0,
    v4 = 0;
  for (let y = 0; y < top; y++) {
    if (gone[y]) continue;
    v++;
    const row = rows[y];
    if (row & 1) v0 = v;
    if (row & 2) v1 = v;
    if (row & 8) v3 = v;
    if (row & 16) v4 = v;
  }
  // Lowest row the next slot can use: column 3 must be empty there, and when
  // column 4 already stands above column 3 the gap can only be closed by a
  // piece that also fills column 3 one row higher.
  const floor = v4 > v3 ? v4 + 1 : v3;
  // d = 0: L opens a slot one row up. d = 1: L roofs the open row, or S fills
  // it flush and opens one two rows up. Anything else is filled flush first.
  const dv = v0 - v1;
  const railTop = Math.max(v0, v1);
  let next = railTop + 1;
  if (dv === 1 && v1 >= 1 && floor <= v1) next = v1;
  const deficit = Math.max(0, floor - next);

  // The next double: the topmost usable slot unless a lower roofed one is
  // reachable right now with less left to fill.
  let pivot: number;
  let debt: number;
  if (slots.length) {
    pivot = slots[0].pivot;
    debt = slots[0].debt;
    for (let i = 1; i < slots.length; i++) {
      let open = true;
      for (let y = slots[i].pivot + 1; y < top && open; y++)
        if ((rows[y] >> 3) & 1) open = false;
      if (open && slots[i].debt < debt) {
        debt = slots[i].debt;
        pivot = slots[i].pivot;
      }
    }
  } else {
    pivot = Math.max(next, floor);
    debt = owed[pivot] - 1 + 4 * (dv === 0 || next === v1 ? 1 : 2) + 1;
  }
  // Column 3 still owes the base cell (3, pivot - 1) but column 4 already
  // stands above it: only a vertical I could reach, and only for a 4-deep gap.
  const trench =
    !bit(rows, 3, pivot - 1) && h4 > pivot - 1 && pivot - heights[3] !== 4;

  let roughness = 0,
    cliffs = 0,
    wells = 0,
    rightSum = 0;
  for (let x = 4; x < WIDTH; x++) {
    rightSum += heights[x];
    if (x < WIDTH - 1) {
      const step = Math.abs(heights[x + 1] - heights[x]);
      roughness += step;
      if (step > 2) cliffs += step - 2;
    }
    const left = x === 4 ? Math.max(heights[3], heights[4]) : heights[x - 1];
    const right = x === WIDTH - 1 ? HEIGHT : heights[x + 1];
    const depth = Math.min(left, right) - heights[x];
    if (depth >= 3) wells += depth - 2;
  }
  const excess = rightSum / 6 - Math.max(h0, h1) - 1.5;
  let heightSum = rightSum + heights[3] + h0 + h1;
  let residueRows = 0;
  while (residueRows < top && rows[residueRows] === RESIDUE) residueRows++;
  // Rows a corrective I will remove are not a height liability.
  const quadReady = residueRows >= 4;
  if (quadReady) heightSum -= 9 * 4;

  const w = WEIGHTS;
  const danger = Math.max(0, top - (quadReady ? 4 : 0) - w.dangerFrom);
  const cost =
    holes * w.hole +
    wellBlocks * w.wellBlock +
    railDefect * w.railDefect +
    rephase * w.rephase +
    deficit * w.deficit +
    (trench ? w.trench : 0) +
    debt * w.debt -
    (slots.length > 0 ? w.slot : 0) -
    (slots.length > 1 ? w.secondSlot : 0) +
    roughness * w.bump +
    cliffs * w.cliff +
    wells * w.well +
    heightSum * w.heightSum +
    top * w.heightMax +
    (excess > 0 ? excess * excess * w.imbalance : 0) -
    Math.min(residueRows, 4) * w.residueRow -
    (quadReady ? w.quadReady : 0) +
    danger * danger * w.danger;
  return {
    cost,
    holes,
    wellBlocks,
    roughness,
    height: top,
    slots,
    debt,
    railDefect,
    deficit,
    trench,
    residueRows,
    damaged: holes > 0 || wellBlocks > 0 || railDefect > 0 || trench,
  };
}
