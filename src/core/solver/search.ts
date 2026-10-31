import {
  collides,
  lock,
  spawn,
  type Board,
  type Piece,
  type Tetromino,
} from "../board";
import { evaluateBoard, type WellSide } from "./evaluation";
import { placementKey, reachablePlacements, type Move } from "./placements";

export type SolverPosition = {
  board: Board;
  active: Piece | null;
  hold: Tetromino | null;
  canHold: boolean;
  visibleQueue: Tetromino[];
};
export type PlannedMove = {
  before: Board;
  piece: Piece;
  after: Board;
  cleared: number;
  useHold: boolean;
  path: Move[];
};
export type Continuation = {
  moves: PlannedMove[];
  cost: number;
  effort: number;
  metrics: ReturnType<typeof evaluateBoard>;
};
export type Analysis = {
  lines: Continuation[];
  elapsedMs: number;
  depth: number;
  timedOut: boolean;
  nodes: number;
};
type Node = {
  board: Board;
  active: Piece | null;
  hold: Tetromino | null;
  cursor: number;
  canHold: boolean;
  moves: PlannedMove[];
  effort: number;
  clearCost: number;
  surfaceCost: number;
  cost: number;
};

// Bounded beam search: retain alternative first placements, then explore each.
// Temporary cavities pay a small path cost, but unresolved terminal holes pay fully.
export function analyze(
  position: SolverPosition,
  side: WellSide,
  options: {
    budgetMs?: number;
    maxDepth?: number;
    instantSoftDrop?: boolean;
    now?: () => number;
  } = {},
): Analysis {
  const now = options.now ?? (() => performance.now()),
    started = now();
  const expired = () => now() - started >= (options.budgetMs ?? 500);
  const queue = position.visibleQueue.slice(0, 5); // Never use the hidden queue or seed.
  let nodes = 0;
  const expand = (node: Node): Node[] => {
    if (!node.active) return [];
    const choices = [
      {
        piece: node.active,
        hold: node.hold,
        cursor: node.cursor,
        useHold: false,
      },
    ];
    if (node.canHold && (node.hold || queue[node.cursor]))
      choices.push({
        piece: spawn(node.hold ?? queue[node.cursor]),
        hold: node.active.type,
        cursor: node.cursor + (node.hold ? 0 : 1),
        useHold: true,
      });
    const children: Node[] = [];
    for (const choice of choices) {
      const placements = reachablePlacements(
        node.board,
        choice.piece,
        options.instantSoftDrop ?? true,
        expired,
      );
      for (const p of placements) {
        if (expired()) break;
        const result = lock(node.board, p.piece);
        const nextType = queue[choice.cursor];
        const active = nextType ? spawn(nextType) : null;
        if (active && collides(result.board, active)) continue;
        const metrics = evaluateBoard(result.board, side);
        const effort = node.effort + p.effort + Number(choice.useHold);
        const clearCost =
          node.clearCost +
          (result.cleared === 4 ? -240 : result.cleared * 90) +
          metrics.holes * 12;
        // Charge each intermediate surface: later repairs do not erase the
        // dependence on receiving and placing those repair pieces in order.
        const surfaceCost =
          node.surfaceCost +
          metrics.roughness * 3 +
          metrics.dependencies * 0.5 +
          metrics.unevenness * 4;
        children.push({
          board: result.board,
          active,
          hold: choice.hold,
          cursor: choice.cursor + Number(Boolean(active)),
          canHold: true,
          moves: [
            ...node.moves,
            {
              before: node.board,
              piece: p.piece,
              after: result.board,
              cleared: result.cleared,
              useHold: choice.useHold,
              path: p.path,
            },
          ],
          effort,
          clearCost,
          surfaceCost,
          cost: metrics.cost + clearCost + surfaceCost + effort * 0.5,
        });
        nodes++;
      }
    }
    return children;
  };
  const initial: Node = {
    ...position,
    cursor: 0,
    moves: [],
    effort: 0,
    clearCost: 0,
    surfaceCost: 0,
    cost: 0,
  };
  const rootChildren = expand(initial).sort((a, b) => a.cost - b.cost);
  let groups = new Map<string, Node[]>();
  for (const child of rootChildren) {
    const key = placementKey(child.moves[0].piece);
    const group = groups.get(key);
    if (group && group.length < 2) group.push(child);
    else if (!group && groups.size < 16) groups.set(key, [child]);
  }
  const maxDepth = Math.min(6, options.maxDepth ?? 6);
  for (let depth = 1; depth < maxDepth && !expired(); depth++) {
    const next = new Map<string, Node[]>();
    let advanced = false;
    for (const [key, group] of groups) {
      const children = group.flatMap((n) => (n.active ? expand(n) : [n]));
      if (expired()) break;
      if (children.length) {
        children.sort((a, b) => a.cost - b.cost);
        // Merge equivalent positions, not merely similar surface profiles.
        const seen = new Set<string>();
        const unique = children
          .filter((n) => {
            const id = `${n.hold}:${n.cursor}:${n.board.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("")}`;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .slice(0, 2);
        next.set(key, unique);
        if (unique.some((n) => n.moves.length > depth)) advanced = true;
      }
    }
    // Keep the last completed round: no time-budget advantage for early roots.
    if (expired()) break;
    groups = next;
    if (!advanced) break;
  }
  const lines = [...groups.values()]
    .map((group) => group[0])
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 3)
    .map((n) => ({
      moves: n.moves,
      cost: n.cost,
      effort: n.effort,
      metrics: evaluateBoard(n.board, side),
    }));
  return {
    lines,
    elapsedMs: now() - started,
    depth: lines.length ? Math.min(...lines.map((l) => l.moves.length)) : 0,
    timedOut: expired(),
    nodes,
  };
}
