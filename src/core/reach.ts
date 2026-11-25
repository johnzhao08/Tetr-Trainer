import {
  classifyTSpin,
  collides,
  HEIGHT,
  I_KICKS,
  KICKS,
  SHAPES,
  spawn,
  TYPES,
  WIDTH,
} from "./board";
import type { Board, Piece, Rotation, Tetromino } from "./board";

/**
 * Which cells pieces can still get to on a board, computed in one pass.
 *
 * `open[y * WIDTH + x]` is 1 when some piece, moving from spawn with slides,
 * soft drop and rotations (kicks included), can occupy that cell. A covered
 * empty cell that no piece can reach is a real hole; one that pieces can reach
 * can still be filled, with a tuck, a spin or by stacking up beneath a roof.
 *
 * `spin` marks the cells of T poses entered by a rotation that rest on the
 * stack, have three occupied corners and cannot be reached by a plain drop:
 * a T-slot, finished or still being built.
 *
 * Guarantee: both masks are exact for every cell at or below the stack top,
 * which includes every covered cell. When the stack is low the search starts
 * just above it, so open air higher up is left unmarked; do not read `open`
 * there.
 *
 * Poses are integers and the board is one bitmask per row, so a full search of
 * all seven pieces stays well under a millisecond.
 */
export type Reach = { open: Uint8Array; spin: Uint8Array };

// Pivots of I and O poses can sit just outside the board, so pad the index.
const PAD = 2;
const SPAN = WIDTH + 2 * PAD;
const POSES = (HEIGHT + 2 * PAD) * SPAN * 4;
const encode = (x: number, y: number, r: number) =>
  ((y + PAD) * SPAN + (x + PAD)) * 4 + r;

// Per piece: cell offsets as flat [dx, dy] x 4 per rotation, and kick tests
// as flat [dx, dy, ...] per rotation pair, resolved once from the engine's
// tables so the search never allocates.
export type Tables = { cells: Int8Array[]; kicks: Int8Array[][] };
export const TABLES = Object.fromEntries(
  TYPES.map((type) => {
    const cells = SHAPES[type].map((s) => Int8Array.from(s.flat()));
    const kicks = [0, 1, 2, 3].map((from) =>
      [0, 1, 2, 3].map((to) =>
        Int8Array.from(
          from === to || type === "O"
            ? [0, 0]
            : (type === "I" ? I_KICKS : KICKS)[`${from}${to}`].flat(),
        ),
      ),
    );
    return [type, { cells, kicks }];
  }),
) as Record<Tetromino, Tables>;
// Clockwise, counterclockwise and 180, as rotation steps.
const TURNS = [1, 3, 2] as const;

export function reach(board: Board): Reach {
  const rows = new Int32Array(HEIGHT);
  let stackTop = 0;
  for (let y = 0; y < HEIGHT; y++) {
    let mask = 0;
    for (let x = 0; x < WIDTH; x++) if (board[y][x] !== null) mask |= 1 << x;
    rows[y] = mask;
    if (mask) stackTop = y + 1;
  }
  const open = new Uint8Array(HEIGHT * WIDTH);
  const spin = new Uint8Array(HEIGHT * WIDTH);
  const seen = new Uint8Array(POSES);
  const queue = new Int32Array(POSES);
  const tTop = spawn("T").y;
  const band = stackTop + 4 < spawn("I").y;

  for (const type of TYPES) {
    const { cells, kicks } = TABLES[type];
    const hits = (x: number, y: number, r: number) => {
      const o = cells[r];
      for (let i = 0; i < 8; i += 2) {
        const cx = x + o[i];
        const cy = y + o[i + 1];
        if (cx < 0 || cx >= WIDTH || cy < 0 || cy >= HEIGHT) return true;
        if (rows[cy] & (1 << cx)) return true;
      }
      return false;
    };
    const mark = (x: number, y: number, r: number, into: Uint8Array) => {
      const o = cells[r];
      for (let i = 0; i < 8; i += 2)
        into[(y + o[i + 1]) * WIDTH + x + o[i]] = 1;
    };
    seen.fill(0);
    let head = 0;
    let tail = 0;
    const push = (x: number, y: number, r: number) => {
      const k = encode(x, y, r);
      if (seen[k]) return false;
      seen[k] = 1;
      queue[tail++] = k;
      mark(x, y, r, open);
      return true;
    };
    const start = spawn(type);
    if (hits(start.x, start.y, start.rotation)) continue;
    if (band) {
      // Every pose lying entirely above the stack is reachable through open
      // air, so seed the poses resting just above it and search only the band
      // the stack occupies.
      for (let r = 0; r < 4; r++) {
        let low = Infinity;
        for (let i = 1; i < 8; i += 2) low = Math.min(low, cells[r][i]);
        for (let x = -PAD; x < WIDTH + PAD; x++)
          if (!hits(x, stackTop - low, r)) push(x, stackTop - low, r);
      }
    } else push(start.x, start.y, start.rotation);

    while (head < tail) {
      const k = queue[head++];
      const r = k & 3;
      const cell = k >> 2;
      const x = (cell % SPAN) - PAD;
      const y = ((cell / SPAN) | 0) - PAD;
      if (!hits(x - 1, y, r)) push(x - 1, y, r);
      if (!hits(x + 1, y, r)) push(x + 1, y, r);
      if (!hits(x, y - 1, r)) push(x, y - 1, r);
      for (const turn of TURNS) {
        const to = (r + turn) & 3;
        const test = kicks[r][to];
        for (let i = 0; i < test.length; i += 2) {
          const nx = x + test[i];
          const ny = y + test[i + 1];
          if (hits(nx, ny, to)) continue;
          push(nx, ny, to);
          if (
            type === "T" &&
            hits(nx, ny - 1, to) &&
            isSpinSlot(board, nx, ny, to as Rotation, tTop)
          )
            mark(nx, ny, to, spin);
          break;
        }
      }
    }
  }
  return { open, spin };
}

// A resting T entered by rotation that has three occupied corners and cannot
// be reached by dropping straight down from spawn height.
function isSpinSlot(
  board: Board,
  x: number,
  y: number,
  rotation: Rotation,
  top: number,
): boolean {
  const piece: Piece = { type: "T", x, y, rotation };
  if (classifyTSpin(board, piece, 0) === null) return false;
  if (y > top) return true;
  for (let yy = y + 1; yy <= top; yy++)
    if (collides(board, { ...piece, y: yy })) return true;
  return !(y < top || rotation === 0);
}
