import {
  classifyTSpin,
  HEIGHT,
  lock,
  move,
  project,
  rotate,
  spawn,
  WIDTH,
} from "./board";
import type { Board, Piece, Rotation, Tetromino } from "./board";
import { TABLES } from "./reach";
import type { Action, Settings } from "./settings";

/**
 * Every landing and every spin a piece can make on a board.
 *
 * The search is the engine's own movement model on integer poses: slides,
 * single soft-drop steps and cw/ccw/180 rotations with the same kick tables
 * `rotate` uses, from spawn. A spin is a rest pose entered by a rotation,
 * scored exactly as `Game.lockPiece` does: a T uses `classifyTSpin` with the
 * real kick index (the fifth test upgrades a mini to full), any other piece
 * (T included, when it fails the corner test) that cannot move after the
 * rotation is a mini, and O never spins.
 *
 * Paths are solver instructions, not player input. "down1" is a one-row drop
 * and exists only in the solver's own model; with the default instant soft
 * drop one `softDrop` press falls to the floor instead. `pathToInputs` turns a
 * path into real key presses for a given setting and says when it cannot.
 *
 * Measured on Node (see tests/spins.test.ts): `findSpins` for T on a messy
 * 10-row board takes about 0.2 ms, `findPlacements` about 0.3 ms.
 */
export type SpinMove = {
  piece: Piece;
  spin: "full" | "mini";
  lines: number;
  after: Board;
  /** Same text the engine puts in `lastEvent.label`. */
  label: string;
  /** Solver steps from spawn to the spin; see `pathToInputs`. */
  path: PathStep[];
};
export type Placement = {
  piece: Piece;
  lines: number;
  after: Board;
  path: PathStep[];
  /** True when some path ends in a slide or drop, not a rotation: a plain lock. */
  plain: boolean;
};

/**
 * A move in the solver's model; "down1" drops exactly one row, "drop" falls
 * to the floor like one `softDrop` press with instant soft drop.
 */
export type PathStep = "left" | "right" | "down1" | "cw" | "ccw" | "flip" | "drop";

/** `instantSoftDrop` limits the search to what that handling can play. */
export type ReachOptions = { instantSoftDrop?: boolean };

const PAD = 2;
const SPAN = WIDTH + 2 * PAD;
const POSES = (HEIGHT + 2 * PAD) * SPAN * 4;
const FULL = (1 << WIDTH) - 1;
const encode = (x: number, y: number, r: number) =>
  ((y + PAD) * SPAN + (x + PAD)) * 4 + r;
// left, right, one-row drop, then the three rotations (see TURNS).
const ACTIONS: PathStep[] = ["left", "right", "down1", "cw", "ccw", "flip", "drop"];
const TURNS = [1, 3, 2] as const;

type Pose = { x: number; y: number; r: number };
const decode = (k: number): Pose => {
  const cell = k >> 2;
  return {
    x: (cell % SPAN) - PAD,
    y: ((cell / SPAN) | 0) - PAD,
    r: k & 3,
  };
};

type Rest = { from: number; action: number; to: number; kick: number };
type Explored = {
  rows: Int32Array;
  parent: Int32Array;
  via: Int8Array;
  resting: number[];
  rests: Rest[];
  /** Poses a slide or one-row drop (or the spawn) enters, so no rotation need come last. */
  plain: Uint8Array;
  hits: (x: number, y: number, r: number) => boolean;
};

function explore(board: Board, type: Tetromino, instant = false): Explored | null {
  const rows = new Int32Array(HEIGHT);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) if (board[y][x] !== null) rows[y] |= 1 << x;
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
  const start = spawn(type);
  if (hits(start.x, start.y, start.rotation)) return null;
  const parent = new Int32Array(POSES).fill(-2);
  const via = new Int8Array(POSES);
  const plain = new Uint8Array(POSES);
  const queue = new Int32Array(POSES);
  const resting: number[] = [];
  const rests: Rest[] = [];
  let head = 0;
  let tail = 0;
  const first = encode(start.x, start.y, 0);
  parent[first] = -1;
  plain[first] = 1;
  queue[tail++] = first;
  const push = (k: number, from: number, action: number) => {
    if (parent[k] !== -2) return;
    parent[k] = from;
    via[k] = action;
    queue[tail++] = k;
  };
  while (head < tail) {
    const k = queue[head++];
    const { x, y, r } = decode(k);
    if (hits(x, y - 1, r)) resting.push(k);
    if (!hits(x - 1, y, r)) {
      push(encode(x - 1, y, r), k, 0);
      plain[encode(x - 1, y, r)] = 1;
    }
    if (!hits(x + 1, y, r)) {
      push(encode(x + 1, y, r), k, 1);
      plain[encode(x + 1, y, r)] = 1;
    }
    if (!hits(x, y - 1, r)) {
      let floor = y - 1;
      if (instant) while (!hits(x, floor - 1, r)) floor--;
      push(encode(x, floor, r), k, instant ? 6 : 2);
      plain[encode(x, floor, r)] = 1;
    }
    for (let t = 0; t < 3; t++) {
      const to = (r + TURNS[t]) & 3;
      const test = kicks[r][to];
      for (let i = 0; i < test.length; i += 2) {
        const nx = x + test[i];
        const ny = y + test[i + 1];
        if (hits(nx, ny, to)) continue;
        const nk = encode(nx, ny, to);
        push(nk, k, 3 + t);
        if (hits(nx, ny - 1, to))
          rests.push({ from: k, action: 3 + t, to: nk, kick: i >> 1 });
        break;
      }
    }
  }
  return { rows, parent, via, resting, rests, plain, hits };
}

function pathTo(ex: Explored, key: number): PathStep[] {
  const out: PathStep[] = [];
  for (let k = key; ex.parent[k] >= 0; k = ex.parent[k])
    out.push(ACTIONS[ex.via[k]]);
  return out.reverse();
}

function pieceAt(type: Tetromino, key: number): Piece {
  const { x, y, r } = decode(key);
  return { type, x, y, rotation: r as Rotation };
}

// Lines the piece would clear, from row bitmasks.
function clearedBy(ex: Explored, type: Tetromino, p: Pose): number {
  const o = TABLES[type].cells[p.r];
  const add = new Map<number, number>();
  for (let i = 0; i < 8; i += 2)
    add.set(
      p.y + o[i + 1],
      (add.get(p.y + o[i + 1]) ?? 0) | (1 << (p.x + o[i])),
    );
  // Like `lock`, count rows that were already full as well.
  let n = ex.rows.reduce((c, m) => c + (m === FULL ? 1 : 0), 0);
  for (const [y, m] of add) if ((ex.rows[y] | m) === FULL) n++;
  return n;
}

function footprint(type: Tetromino, p: Pose): string {
  const o = TABLES[type].cells[p.r];
  const ids: number[] = [];
  for (let i = 0; i < 8; i += 2)
    ids.push((p.y + o[i + 1]) * WIDTH + p.x + o[i]);
  return ids.sort((a, b) => a - b).join(",");
}

const CLEAR_NAMES = ["", "Single", "Double", "Triple", "Quad"];

export function spinLabel(
  type: Tetromino,
  spin: "full" | "mini",
  lines: number,
): string {
  return [spin === "mini" ? `${type}-spin Mini` : "T-spin", CLEAR_NAMES[lines]]
    .filter(Boolean)
    .join(" ");
}

/**
 * Every spin `type` can make from spawn. Spins that clear no line are listed
 * only with `includeZero`. Results are unique by footprint, spin and lines.
 */
export function findSpins(
  board: Board,
  type: Tetromino,
  opts: { includeZero?: boolean } & ReachOptions = {},
): SpinMove[] {
  if (type === "O") return [];
  const ex = explore(board, type, opts.instantSoftDrop);
  if (!ex) return [];
  const seen = new Set<string>();
  const out: SpinMove[] = [];
  for (const { from, action, to, kick } of ex.rests) {
    const pose = decode(to);
    const lines = clearedBy(ex, type, pose);
    if (lines === 0 && !opts.includeZero) continue;
    const piece = pieceAt(type, to);
    let spin: "full" | "mini" | null =
      type === "T" ? classifyTSpin(board, piece, kick) : null;
    if (
      !spin &&
      ex.hits(pose.x - 1, pose.y, pose.r) &&
      ex.hits(pose.x + 1, pose.y, pose.r) &&
      ex.hits(pose.x, pose.y + 1, pose.r)
    )
      spin = "mini";
    if (!spin) continue;
    const key = `${footprint(type, pose)}|${spin}|${lines}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      piece,
      spin,
      lines,
      after: lock(board, piece).board,
      label: spinLabel(type, spin, lines),
      path: [...pathTo(ex, from), ACTIONS[action]],
    });
  }
  return out;
}

/** Every distinct resting landing reachable from spawn, shortest path first. */
export function findPlacements(
  board: Board,
  type: Tetromino,
  opts: ReachOptions = {},
): Placement[] {
  const ex = explore(board, type, opts.instantSoftDrop);
  if (!ex) return [];
  const seen = new Map<string, Placement>();
  for (const key of ex.resting) {
    const pose = decode(key);
    const id = footprint(type, pose);
    const prior = seen.get(id);
    if (prior) {
      // Another pose with the same footprint may be the one a plain lock reaches.
      if (ex.plain[key]) prior.plain = true;
      continue;
    }
    const piece = pieceAt(type, key);
    const result = lock(board, piece);
    seen.set(id, {
      piece,
      lines: result.cleared,
      after: result.board,
      path: pathTo(ex, key),
      plain: ex.plain[key] === 1,
    });
  }
  return [...seen.values()];
}

/**
 * Key presses that follow a solver path, to finish with a hard drop.
 *
 * With stepwise soft drop (`instantSoftDrop` off) every "down1" is one
 * `softDrop` tap and the result is always exact. With instant soft drop a run
 * of "down1" steps is reproducible only when it ends at rest, where one press
 * lands in the same place. A run that stops in mid-air (to slide under an
 * overhang or rotate) cannot be done; `exact` is false and `inputs` keeps one
 * tap per row, which is correct only with stepwise soft drop.
 */
export function pathToInputs(
  board: Board,
  type: Tetromino,
  path: readonly PathStep[],
  settings: Pick<Settings, "instantSoftDrop">,
): { inputs: Action[]; exact: boolean } {
  const inputs: Action[] = [];
  let exact = true;
  let piece = spawn(type);
  for (let i = 0; i < path.length; i++) {
    const step = path[i];
    if (step === "drop") {
      inputs.push("softDrop");
      piece = project(board, piece);
    } else if (step === "down1") {
      let run = 0;
      while (path[i + run] === "down1") run++;
      i += run - 1;
      let landed = piece;
      for (let n = 0; n < run; n++) landed = move(board, landed, 0, -1);
      if (!settings.instantSoftDrop) {
        for (let n = 0; n < run; n++) inputs.push("softDrop");
      } else if (project(board, piece).y === landed.y) {
        inputs.push("softDrop");
      } else {
        exact = false;
        for (let n = 0; n < run; n++) inputs.push("softDrop");
      }
      piece = landed;
    } else {
      inputs.push(step);
      piece =
        step === "left"
          ? move(board, piece, -1, 0)
          : step === "right"
            ? move(board, piece, 1, 0)
            : rotate(board, piece, step === "cw" ? 1 : step === "ccw" ? -1 : 2);
    }
  }
  return { inputs, exact };
}
