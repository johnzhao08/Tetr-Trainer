// Per-placement dig checks for cheese drills (Hard Drop downstacking guide,
// 61bi cheese tips, winterNebs "place the fewest blocks"). See docs/ROADMAP.md.
import { cells, collides, HEIGHT, move, project, rotate, spawn } from "./board";
import type { Board, Piece, Tetromino } from "./board";
import type { CoachFlag, PlacementReview } from "./coach";
import type { Placement } from "./game";
import { hasGarbage } from "./garbage";

export type DigFlag =
  | { kind: "next-hole-blocked" }
  | { kind: "cost-lines"; count: number }
  | { kind: "wasted-i" }
  | { kind: "hold-fit"; piece: Tetromino }
  | { kind: "own-line" };

/** Any flag a drill placement can carry. */
export type DrillFlag = CoachFlag | DigFlag;
export type DrillReview = Omit<PlacementReview, "flags"> & { flags: DrillFlag[] };

export const DIG_CONFIG = {
  nextHoleBlockedWeight: 2,
  /** Per extra line to dig, capped. */
  costLinesWeight: 1,
  costLinesCap: 3,
  wastedIWeight: 2,
  holdFitWeight: 2,
  ownLineWeight: 1,
} as const;

export const isDigFlag = (flag: DrillFlag): flag is DigFlag =>
  flag.kind === "next-hole-blocked" ||
  flag.kind === "cost-lines" ||
  flag.kind === "wasted-i" ||
  flag.kind === "hold-fit" ||
  flag.kind === "own-line";

/** The rule behind each flag, as one short coaching line. */
export function digText(flag: DigFlag): string {
  switch (flag.kind) {
    case "next-hole-blocked":
      return "You covered the next hole. Keep its column open";
    case "cost-lines":
      return `Each block over a hole costs a line to dig (+${flag.count})`;
    case "wasted-i":
      return "Spend I pieces on garbage";
    case "hold-fit":
      return `Hold the piece the next hole needs (${flag.piece} fits)`;
    case "own-line":
      return "You are clearing your own stack, not garbage";
  }
}

const hasX = hasGarbage;

/** Highest row holding garbage, or -1. Row 0 is the floor. */
function topGarbage(board: Board): number {
  for (let y = HEIGHT - 1; y >= 0; y--) if (hasX(board[y])) return y;
  return -1;
}

// Rows of `board` that become full when `piece` locks.
function filledRows(board: Board, piece: Piece): Set<number> {
  const added = new Map<number, number>();
  for (const [x, y] of cells(piece)) {
    if (board[y][x] === null) added.set(y, (added.get(y) ?? 0) + 1);
  }
  const full = new Set<number>();
  for (const [y, n] of added) {
    let empty = 0;
    for (const c of board[y]) if (c === null) empty++;
    if (empty === n) full.add(y);
  }
  return full;
}

function garbageClearedBy(board: Board, piece: Piece): number {
  let n = 0;
  for (const y of filledRows(board, piece)) if (hasX(board[y])) n++;
  return n;
}

/** Every lock pose the piece can reach by moves, rotations and drops. */
function* lockPoses(board: Board, type: Tetromino): Generator<Piece> {
  const start = spawn(type);
  if (collides(board, start)) return;
  const key = (p: Piece) => `${p.x},${p.y},${p.rotation}`;
  const seen = new Set([key(start)]);
  const stack = [start];
  while (stack.length) {
    const piece = stack.pop()!;
    if (move(board, piece, 0, -1) === piece) yield piece;
    for (const next of [
      move(board, piece, -1, 0),
      move(board, piece, 1, 0),
      move(board, piece, 0, -1),
      rotate(board, piece, 1),
      rotate(board, piece, -1),
      rotate(board, piece, 2),
    ]) {
      const id = key(next);
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(next);
    }
  }
}

/** Whether `type` has a reachable placement that clears a garbage row. */
function clearsGarbage(board: Board, type: Tetromino): boolean {
  for (const pose of lockPoses(board, type))
    if (garbageClearedBy(board, project(board, pose)) > 0) return true;
  return false;
}

/**
 * The board after `piece` locks and full rows clear, plus where each row that
 * survived moved to. Rows that clear (and the blocks in them) are gone.
 */
function survivingBoard(board: Board, piece: Piece) {
  const placed = board.map((row) => [...row]);
  for (const [x, y] of cells(piece)) placed[y][x] = piece.type;
  const rowOf = new Map<number, number>();
  const kept: Board = [];
  placed.forEach((row, y) => {
    if (!row.every((c) => c !== null)) {
      rowOf.set(y, kept.length);
      kept.push(row);
    }
  });
  while (kept.length < HEIGHT) kept.push(Array(board[0].length).fill(null));
  return { board: kept, rowOf };
}

/** Whether column `x` has a filled cell above row `y`. */
function filledAbove(board: Board, x: number, y: number): boolean {
  for (let r = y + 1; r < HEIGHT; r++) if (board[r][x] !== null) return true;
  return false;
}

/**
 * Filled cells stacked above garbage holes: per column, the cells above the
 * topmost empty cell of a garbage row. Each one is a block to dig through.
 */
function blocksOverHoles(board: Board): number {
  let total = 0;
  for (let x = 0; x < board[0].length; x++) {
    let hole = -1;
    for (let y = HEIGHT - 1; y >= 0; y--)
      if (board[y][x] === null && hasX(board[y])) {
        hole = y;
        break;
      }
    if (hole < 0) continue;
    for (let y = hole + 1; y < HEIGHT; y++) if (board[y][x] !== null) total++;
  }
  return total;
}

/** Cells of `piece` that fill holes in garbage rows of `board`. */
function garbageRowsFilled(board: Board, piece: Piece): number {
  const rows = new Set<number>();
  for (const [x, y] of cells(piece))
    if (board[y][x] === null && hasX(board[y])) rows.add(y);
  return rows.size;
}

/**
 * Grade one placement as a dig. `before` and `after` bracket the lock (after
 * the line clear); `ctx` is the hold piece and queue once it has locked.
 * Blockage and cost are judged on the board that survives the clear.
 */
export function reviewDig(
  before: Board,
  after: Board,
  placement: Placement,
  ctx: { hold: Tetromino | null; next: Tetromino[] },
): DigFlag[] {
  const top = topGarbage(before);
  if (top < 0) return [];
  const flags: DigFlag[] = [];
  const piece = placement.landing;
  const garbageLeft = after.some(hasX);
  const survived = survivingBoard(before, piece);

  // The next hole is a hole of the top garbage row that nothing covered
  // before and something covers now.
  let blocked = false;
  const topRow = survived.rowOf.get(top);
  if (topRow !== undefined)
    for (let x = 0; x < before[0].length; x++)
      if (
        survived.board[topRow][x] === null &&
        !filledAbove(before, x, top) &&
        filledAbove(survived.board, x, topRow)
      )
        blocked = true;
  const cost = blocksOverHoles(survived.board) - blocksOverHoles(before);
  if (blocked) flags.push({ kind: "next-hole-blocked" });
  if (cost > 0) flags.push({ kind: "cost-lines", count: cost });

  // An I that fills holes in three or more garbage rows is setting up a
  // second I, not wasting this one.
  if (
    placement.type === "I" &&
    placement.garbageCleared === 0 &&
    garbageRowsFilled(before, piece) < 3
  )
    flags.push({ kind: "wasted-i" });

  // Only a piece the player could have swapped in counts: the held piece, or
  // the next one when hold is empty, and only if hold is still unused. A
  // swap is only advised when this piece blocked the next hole; plain cost
  // keeps its own penalty.
  if (blocked && placement.garbageCleared === 0 && !placement.held) {
    const alt = ctx.hold ?? ctx.next[0];
    if (alt && alt !== placement.type && clearsGarbage(before, alt))
      flags.push({ kind: "hold-fit", piece: alt });
  }

  if (placement.cleared > 0 && placement.garbageCleared === 0 && garbageLeft)
    flags.push({ kind: "own-line" });
  return flags;
}

export function digPenalty(flags: readonly DigFlag[]): number {
  const c = DIG_CONFIG;
  let total = 0;
  for (const f of flags)
    switch (f.kind) {
      case "next-hole-blocked":
        total += c.nextHoleBlockedWeight;
        break;
      case "cost-lines":
        total += Math.min(c.costLinesCap, f.count * c.costLinesWeight);
        break;
      case "wasted-i":
        total += c.wastedIWeight;
        break;
      case "hold-fit":
        total += c.holdFitWeight;
        break;
      case "own-line":
        total += c.ownLineWeight;
        break;
    }
  return total;
}
