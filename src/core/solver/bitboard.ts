import {
  HEIGHT,
  I_KICKS,
  KICKS,
  SHAPES,
  TYPES,
  WIDTH,
  type Board,
  type Piece,
  type Rotation,
  type Tetromino,
} from "../board";

// Occupancy-only board: one 10-bit mask per row, bit x set when (x, y) is
// filled. The search uses it instead of Cell[][] because it expands tens of
// thousands of positions per analysis; colours are restored afterwards by
// replaying the chosen moves on the real board.
export type Rows = Int32Array;
export const FULL_ROW = (1 << WIDTH) - 1;

export function toRows(board: Board): Rows {
  const rows = new Int32Array(HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    let mask = 0;
    for (let x = 0; x < WIDTH; x++) if (board[y][x] !== null) mask |= 1 << x;
    rows[y] = mask;
  }
  return rows;
}

export function stackTop(rows: Rows): number {
  let top = HEIGHT;
  while (top > 0 && rows[top - 1] === 0) top--;
  return top;
}

const TYPE_INDEX = Object.fromEntries(TYPES.map((t, i) => [t, i])) as Record<
  Tetromino,
  number
>;
// [type][rotation] -> dx0, dy0, dx1, dy1, ...
const OFFSETS: number[][][] = TYPES.map((type) =>
  SHAPES[type].map((shape) => shape.flatMap(([x, y]) => [x, y])),
);
// Leftmost column offset of each [type][rotation].
const MIN_DX: number[][] = OFFSETS.map((rotations) =>
  rotations.map((shape) => Math.min(shape[0], shape[2], shape[4], shape[6])),
);
export const leftColumn = (type: Tetromino, x: number, rotation: number) =>
  x + MIN_DX[TYPE_INDEX[type]][rotation];
// [type][from][to] -> dx0, dy0, ... in the same order board.ts tests them.
const KICK_TABLE: number[][][][] = TYPES.map((type) =>
  [0, 1, 2, 3].map((from) =>
    [0, 1, 2, 3].map((to) =>
      from === to
        ? []
        : (type === "I" ? I_KICKS : KICKS)[`${from}${to}`].flatMap(([x, y]) => [
            x,
            y,
          ]),
    ),
  ),
);

function blocked(rows: Rows, shape: number[], px: number, py: number) {
  for (let i = 0; i < 8; i += 2) {
    const x = px + shape[i],
      y = py + shape[i + 1];
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || (rows[y] >> x) & 1)
      return true;
  }
  return false;
}

// Three occupied diagonal corners (walls and floor count); mirrors board.ts.
function spinClass(
  rows: Rows,
  px: number,
  py: number,
  rotation: number,
  kickIndex: number,
) {
  let occupied = 0,
    front = 0;
  for (let dx = -1; dx <= 1; dx += 2)
    for (let dy = -1; dy <= 1; dy += 2) {
      const x = px + dx,
        y = py + dy;
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || (rows[y] >> x) & 1) {
        occupied++;
        if (
          rotation === 0
            ? dy === 1
            : rotation === 1
              ? dx === 1
              : rotation === 2
                ? dy === -1
                : dx === -1
        )
          front++;
      }
    }
  if (occupied < 3) return 0;
  return front === 2 || kickIndex === 4 ? 2 : 1;
}

export type FastPlacement = {
  x: number;
  y: number;
  rotation: Rotation;
  // 0 none, 1 mini, 2 full: the best T-spin class any reachable final
  // rotation gives this resting pose.
  spin: number;
};

// Pose index: x in [-3, 12], y in [-3, HEIGHT + 2].
const OX = 3,
  OY = 3,
  STATES = (HEIGHT + 6) * 16 * 4;
const seenAt = new Int32Array(STATES);
const spinAt = new Int32Array(STATES);
const spinValue = new Uint8Array(STATES);
const queue = new Int32Array(STATES);
const sorted = new Int32Array(4);
let stamp = 0;
const pack = (x: number, y: number, r: number) =>
  ((((y + OY) << 4) | (x + OX)) << 2) | r;

// Every resting pose reachable from spawn with left/right, the three
// rotations (SRS+ kicks) and soft drop: the same closure placements.ts
// explores, without building input paths. Poses that occupy the same cells
// are reported once.
export function fastPlacements(
  rows: Rows,
  type: Tetromino,
  instantSoftDrop: boolean,
  top = stackTop(rows),
): FastPlacement[] {
  const t = TYPE_INDEX[type];
  const shapes = OFFSETS[t];
  const isT = type === "T";
  const startY = type === "I" ? 20 : 21;
  if (blocked(rows, shapes[0], 4, startY)) return [];
  if (++stamp === 0x7fffffff) {
    seenAt.fill(0);
    spinAt.fill(0);
    stamp = 1;
  }
  let head = 0,
    tail = 0;
  const visit = (x: number, y: number, r: number) => {
    const id = pack(x, y, r);
    if (seenAt[id] === stamp) return;
    seenAt[id] = stamp;
    queue[tail++] = id;
  };
  visit(4, startY, 0);
  // Above this row nothing can collide, so a one-row descent may skip the
  // empty air without losing any tuck or spin.
  const air = top + 3;
  const result: FastPlacement[] = [];
  const cellKeys: number[] = [];
  while (head < tail) {
    const id = queue[head++];
    const r = id & 3,
      x = ((id >> 2) & 15) - OX,
      y = (id >> 6) - OY;
    const shape = shapes[r];
    let ground = y;
    while (!blocked(rows, shape, x, ground - 1)) ground--;
    if (ground === y) {
      const spin = isT && spinAt[id] === stamp ? spinValue[id] : 0;
      let key = 0;
      if (!isT) {
        // Rotation aliases of I/S/Z/O cover identical cells; key by the set.
        for (let i = 0; i < 4; i++)
          sorted[i] = (y + shape[i * 2 + 1]) * WIDTH + x + shape[i * 2];
        sorted.sort();
        key =
          ((sorted[0] * 400 + sorted[1]) * 400 + sorted[2]) * 400 + sorted[3];
      }
      if (isT || !cellKeys.includes(key)) {
        cellKeys.push(key);
        result.push({ x, y, rotation: r as Rotation, spin });
      }
    } else {
      visit(x, ground, r);
      if (!instantSoftDrop) visit(x, y - 1 > air ? air : y - 1, r);
    }
    if (!blocked(rows, shape, x - 1, y)) visit(x - 1, y, r);
    if (!blocked(rows, shape, x + 1, y)) visit(x + 1, y, r);
    // O never kicks and its rotations cover the same cells.
    if (type === "O") continue;
    for (let turn = 1; turn < 4; turn++) {
      const to = (r + turn) & 3;
      const kicks = KICK_TABLE[t][r][to];
      const target = shapes[to];
      for (let k = 0; k < kicks.length; k += 2) {
        const nx = x + kicks[k],
          ny = y + kicks[k + 1];
        if (blocked(rows, target, nx, ny)) continue;
        if (isT) {
          const spin = spinClass(rows, nx, ny, to, k >> 1);
          if (spin) {
            const next = pack(nx, ny, to);
            if (spinAt[next] !== stamp || spinValue[next] < spin) {
              spinAt[next] = stamp;
              spinValue[next] = spin;
            }
          }
        }
        visit(nx, ny, to);
        break;
      }
    }
  }
  if (isT)
    // A spin recorded after its pose was dequeued must still be reported.
    for (const p of result) {
      const id = pack(p.x, p.y, p.rotation);
      if (spinAt[id] === stamp) p.spin = spinValue[id];
    }
  return result;
}

// Lock a piece and remove completed rows. `rows` is not modified.
export function lockRows(
  rows: Rows,
  type: Tetromino,
  x: number,
  y: number,
  rotation: number,
): { rows: Rows; cleared: number } {
  const next = rows.slice();
  const shape = OFFSETS[TYPE_INDEX[type]][rotation];
  let low = HEIGHT,
    high = 0;
  for (let i = 0; i < 8; i += 2) {
    const cy = y + shape[i + 1];
    next[cy] |= 1 << (x + shape[i]);
    if (cy < low) low = cy;
    if (cy > high) high = cy;
  }
  let cleared = 0;
  for (let cy = low; cy <= high; cy++) if (next[cy] === FULL_ROW) cleared++;
  if (cleared) {
    let write = low;
    for (let read = low; read < HEIGHT; read++)
      if (next[read] !== FULL_ROW) next[write++] = next[read];
    while (write < HEIGHT) next[write++] = 0;
  }
  return { rows: next, cleared };
}

export function spawnBlocked(rows: Rows, type: Tetromino) {
  return blocked(rows, OFFSETS[TYPE_INDEX[type]][0], 4, type === "I" ? 20 : 21);
}

export function toPiece(type: Tetromino, p: FastPlacement): Piece {
  return { type, x: p.x, y: p.y, rotation: p.rotation };
}
