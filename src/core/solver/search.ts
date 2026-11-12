import {
  collides,
  lock,
  spawn,
  type Board,
  type Piece,
  type Tetromino,
} from "../board";
import { analyzeLst } from "./lstSearch";
import { evaluateBoard, type WellSide } from "./evaluation";
import {
  placementKey,
  reachablePlacements,
  type Move,
  type Spin,
} from "./placements";

export type SolverMode = "nine-zero" | "lst";
export type SolverPosition = {
  tsds?: number;
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
  spin?: Spin;
};
export type Continuation = {
  moves: PlannedMove[];
  cost: number;
  effort: number;
  metrics: ReturnType<typeof evaluateBoard>;
  // LST only: whether the line ends with the structure intact or damaged.
  evidence?: "construction" | "unresolved";
};
export type Analysis = {
  lines: Continuation[];
  elapsedMs: number;
  depth: number;
  timedOut: boolean;
  complete: boolean;
  nodes: number;
  stopReason?: "horizon" | "time" | "no-continuation";
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

export type AnalyzeOptions = {
  budgetMs?: number;
  maxDepth?: number;
  instantSoftDrop?: boolean;
  now?: () => number;
  mode?: SolverMode;
  // LST only: called with each completed search round on long analyses.
  onProgress?: (analysis: Analysis) => void;
};

export function analyze(
  position: SolverPosition,
  side: WellSide,
  options: AnalyzeOptions = {},
): Analysis {
  // LST has its own structure-aware search; see lstSearch.ts.
  if (options.mode === "lst") return analyzeLst(position, options);
  return search(position, side, options);
}

// Bounded beam search: retain alternative first placements, then explore each.
// Temporary cavities pay a small path cost, but unresolved terminal holes pay fully.
function search(
  position: SolverPosition,
  side: WellSide,
  options: AnalyzeOptions,
): Analysis {
  const now = options.now ?? (() => performance.now()),
    started = now();
  const expired = () => now() - started >= (options.budgetMs ?? 500);
  const maxDepth = Math.min(6, options.maxDepth ?? 6);
  const compare = (a: Node, b: Node) => a.cost - b.cost;
  const placementCache = new Map<
    string,
    ReturnType<typeof reachablePlacements>
  >();
  const occupancy = (board: Board) =>
    board.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("");
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
      const cacheKey = `${occupancy(node.board)}:${choice.piece.type}:${choice.piece.x}:${choice.piece.y}:${choice.piece.rotation}`;
      const placements =
        placementCache.get(cacheKey) ??
        reachablePlacements(
          node.board,
          choice.piece,
          options.instantSoftDrop ?? true,
          expired,
        );
      if (!expired()) placementCache.set(cacheKey, placements);
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
              spin: p.spin,
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
    board: position.board,
    active: position.active,
    hold: position.hold,
    canHold: position.canHold,
    cursor: 0,
    moves: [],
    effort: 0,
    clearCost: 0,
    surfaceCost: 0,
    cost: 0,
  };
  const rootChildren = expand(initial).sort(compare);
  let interrupted = expired();
  let completedDepth = interrupted ? 0 : 1;
  let groups = new Map<string, Node[]>();
  for (const child of rootChildren) {
    const key = placementKey(child.moves[0].piece);
    const group = groups.get(key);
    if (group && group.length < 2) group.push(child);
    else if (!group && groups.size < 16) groups.set(key, [child]);
  }
  for (let depth = 1; depth < maxDepth && !interrupted; depth++) {
    if (expired()) {
      interrupted = true;
      break;
    }
    const next = new Map<string, Node[]>();
    let advanced = false;
    for (const [key, group] of groups) {
      const children = group.flatMap((n) => (n.active ? expand(n) : [n]));
      if (expired()) {
        interrupted = true;
        break;
      }
      if (children.length) {
        children.sort(compare);
        // Merge equivalent positions, not merely similar surface profiles.
        const seen = new Set<string>();
        const unique = children
          .filter((n) => {
            const id = `${n.hold}:${n.cursor}:${occupancy(n.board)}`;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .slice(0, 2);
        next.set(key, unique);
        if (unique.some((n) => n.moves.length > depth)) advanced = true;
      }
    }
    // Incomplete rounds are never published as recommendations.
    if (interrupted) break;
    groups = next;
    completedDepth = depth + 1;
    if (!advanced) break;
  }
  const lines = interrupted
    ? []
    : [...groups.values()]
        .map((group) => group.sort(compare)[0])
        .filter((n): n is Node => n !== undefined)
        .sort(compare)
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
    depth: interrupted
      ? completedDepth
      : lines.length
        ? Math.min(...lines.map((l) => l.moves.length))
        : 0,
    timedOut: interrupted,
    complete: !interrupted,
    stopReason: interrupted
      ? "time"
      : !lines.length
        ? "no-continuation"
        : "horizon",
    nodes,
  };
}
