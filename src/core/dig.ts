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
 * Per column the open garbage holes (nothing above them) that `piece` newly
 * covers, as rows. Holes in rows this lock clears, or that it fills, do not count.
 */
function coveredHoles(board: Board, piece: Piece, full: Set<number>) {
  const placed = cells(piece);
  const out = new Map<number, number[]>();
  for (const x of new Set(placed.map(([px]) => px))) {
    let top = HEIGHT - 1;
    while (top >= 0 && board[top][x] === null) top--;
    const ys = placed.filter(([px]) => px === x).map(([, y]) => y);
    const highest = Math.max(...ys);
    const holes: number[] = [];
    for (let y = top + 1; y < highest; y++)
      if (hasX(board[y]) && !full.has(y) && !ys.includes(y)) holes.push(y);
    if (holes.length) out.set(x, holes);
  }
  return out;
}

/**
 * Grade one placement as a dig. `before` and `after` bracket the lock (after
 * the line clear); `ctx` is the hold piece and queue once it has locked.
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
  const full = filledRows(before, piece);
  const garbageLeft = after.some(hasX);

  // The next hole is a hole of the top garbage row; every further covered
  // hole in a column is one more line to dig.
  let blocked = false;
  let cost = 0;
  for (const [, holes] of coveredHoles(before, piece, full)) {
    if (holes.includes(top)) blocked = true;
    cost += holes.length - (holes.includes(top) ? 1 : 0);
  }
  if (blocked) flags.push({ kind: "next-hole-blocked" });
  if (cost > 0) flags.push({ kind: "cost-lines", count: cost });

  if (placement.type === "I" && placement.garbageCleared === 0)
    flags.push({ kind: "wasted-i" });

  if ((blocked || cost > 0) && placement.garbageCleared === 0) {
    const options = [ctx.hold, ctx.next[0]].filter(
      (t, i, all): t is Tetromino => t != null && all.indexOf(t) === i,
    );
    const fit = options.find((t) => clearsGarbage(before, t));
    if (fit) flags.push({ kind: "hold-fit", piece: fit });
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
