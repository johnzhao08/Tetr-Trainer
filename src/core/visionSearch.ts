import { cells, collides, HEIGHT, immobile, serialize, TYPES, WIDTH } from "./board";
import type { Board, Piece, Rotation, Tetromino } from "./board";
import { analyzeBoard } from "./coach";
import { nextRandom } from "./rng";
import { findPlacements, findSpins } from "./spins";
import type { Placement, SpinMove } from "./spins";
import { stepActions, VisionGame } from "./visionGame";
import { defaultSettings } from "./settings";

/**
 * Cheap necessary test for a full T-spin double: some resting pose of the T
 * is immobile, has three occupied corners, and fills two rows. Skips the
 * reachability search on the many boards that cannot have a slot.
 */
function slotShaped(board: Board): boolean {
  let top = 0;
  for (let y = 0; y < HEIGHT; y++)
    if (board[y].some((c) => c !== null)) top = y;
  for (let rotation = 0; rotation < 4; rotation++)
    for (let y = 0; y <= top + 1; y++)
      for (let x = 0; x < WIDTH; x++) {
        const piece: Piece = { type: "T", x, y, rotation: rotation as Rotation };
        if (collides(board, piece) || !immobile(board, piece)) continue;
        let corners = 0;
        for (const dx of [-1, 1])
          for (const dy of [-1, 1]) {
            const cx = x + dx;
            const cy = y + dy;
            if (cx < 0 || cx >= WIDTH || cy < 0 || board[cy][cx] !== null)
              corners++;
          }
        if (corners < 3) continue;
        const rows = new Set<number>();
        for (const [, cy] of cells(piece)) rows.add(cy);
        let full = 0;
        for (const cy of rows) {
          let filled = 0;
          for (const [cx, py] of cells(piece)) if (py === cy && cx >= 0) filled++;
          const have = board[cy].filter((c) => c !== null).length;
          if (have + filled === WIDTH) full++;
        }
        if (full >= 2) return true;
      }
  return false;
}

/**
 * The best full T-spin double or better the T can reach from spawn now, or
 * null. This is what the trainer calls a "T-slot".
 */
export function bestSlot(board: Board): SpinMove | null {
  if (!slotShaped(board)) return null;
  let best: SpinMove | null = null;
  for (const s of findSpins(board, "T"))
    if (s.spin === "full" && s.lines >= 2 && (!best || s.lines > best.lines))
      best = s;
  return best;
}
export const slotReady = (board: Board) => bestSlot(board) !== null;

/** Some placement of `type` leaves a slot ready. */
export function creates(board: Board, type: Tetromino): Placement | null {
  let best: { move: Placement; lines: number } | null = null;
  for (const move of findPlacements(board, type)) {
    const slot = bestSlot(move.after);
    if (slot && (!best || slot.lines > best.lines))
      best = { move, lines: slot.lines };
  }
  return best?.move ?? null;
}

export type PlanStep = { type: Tetromino; held: boolean; move: Placement | null };
export type Plan = { steps: PlanStep[]; board: Board; slot: SpinMove };
type Node = {
  board: Board;
  idx: number;
  hold: Tetromino | null;
  canHold: boolean;
  steps: PlanStep[];
};

// Every level keeps only its 12 smoothest boards before expanding them.
const BEAM = 12;

const roughness = (board: Board) => {
  const s = analyzeBoard(board);
  return s.holes * 0.5 + s.bumpiness * 0.4 + s.maxHeight * 0.3;
};

/**
 * Looks for a way to play `queue[0..count)` (hold allowed once per piece) so
 * a T-slot is ready when the next piece, the T, arrives. Bounded beam search:
 * each level expands at most the 12 smoothest boards (every placement of the
 * next piece, or of the held piece), and the last level is checked for a
 * slot. A plan is a proof (`runPlan` replays it in the real engine); `null`
 * only means none was found within those bounds.
 */
export function planSlot(
  board: Board,
  queue: readonly Tetromino[],
  hold: Tetromino | null,
  count: number,
): Plan | null {
  let level: Node[] = [{ board, idx: 0, hold, canHold: true, steps: [] }];
  for (let idx = 0; idx <= count; idx++) {
    if (idx === count) {
      for (const n of level) {
        const slot = bestSlot(n.board);
        if (slot) return { steps: n.steps, board: n.board, slot };
      }
      return null;
    }
    const next = new Map<string, Node>();
    const add = (n: Node) => {
      const key = serialize(n.board) + (n.hold ?? "-") + n.canHold;
      if (!next.has(key)) next.set(key, n);
    };
    const pool =
      level.length > BEAM
        ? level
            .map((n) => ({ n, r: roughness(n.board) }))
            .sort((a, b) => a.r - b.r)
            .slice(0, BEAM)
            .map((e) => e.n)
        : level;
    for (const n of pool) {
      const current = queue[n.idx];
      const play = (type: Tetromino, held: boolean, hold: Tetromino | null) => {
        for (const move of findPlacements(n.board, type))
          add({
            board: move.after,
            idx: n.idx + 1,
            hold,
            canHold: true,
            steps: [...n.steps, { type, held, move }],
          });
      };
      play(current, false, n.hold);
      if (!n.canHold) continue;
      if (n.hold !== null && n.hold !== current) play(n.hold, true, current);
      else if (n.hold === null)
        add({
          ...n,
          idx: n.idx + 1,
          hold: current,
          canHold: false,
          steps: [...n.steps, { type: current, held: true, move: null }],
        });
    }
    level = [...next.values()];
  }
  return null;
}

/** Drive `steps` through the real engine; the game ends on the final board. */
export function runPlan(
  board: Board,
  queue: readonly Tetromino[],
  hold: Tetromino | null,
  steps: readonly PlanStep[],
): VisionGame {
  const game = new VisionGame(
    1,
    { ...defaultSettings(), instantSoftDrop: false },
    board,
    queue,
    99,
    hold,
  );
  for (const step of steps) {
    if (step.held) {
      game.keyDown("hold");
      game.keyUp("hold");
    }
    if (!step.move) continue;
    for (const action of [...stepActions(step.move.path), "hardDrop" as const]) {
      game.keyDown(action);
      game.keyUp(action);
    }
  }
  return game;
}

/**
 * Remove one tetromino-shaped set of cells whose columns are open above, so
 * putting that piece back is a legal drop. Candidates come in seeded order.
 */
export function removals(
  board: Board,
  seed: number,
): { type: Tetromino; board: Board }[] {
  const rng = { rng: seed >>> 0 };
  const out: { type: Tetromino; board: Board; k: number }[] = [];
  for (const type of TYPES)
    for (let rotation = 0; rotation < 4; rotation++)
      for (let y = 0; y < HEIGHT - 2; y++)
        for (let x = -1; x < WIDTH; x++) {
          const set = cells({ type, x, y, rotation: rotation as 0 | 1 | 2 | 3 });
          if (set.some(([cx, cy]) => cx < 0 || cx >= WIDTH || board[cy]?.[cx] == null))
            continue;
          const key = new Set(set.map(([cx, cy]) => cy * WIDTH + cx));
          const open = set.every(([cx, cy]) => {
            for (let yy = cy + 1; yy < HEIGHT; yy++)
              if (board[yy][cx] !== null && !key.has(yy * WIDTH + cx))
                return false;
            return true;
          });
          if (!open) continue;
          const next = board.map((row) => [...row]);
          for (const [cx, cy] of set) next[cy][cx] = null;
          out.push({ type, board: next, k: nextRandom(rng) });
        }
  return out.sort((a, b) => a.k - b.k).map(({ type, board }) => ({ type, board }));
}
