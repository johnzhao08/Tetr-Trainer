import {
  collides,
  lock,
  spawn,
  type Board,
  type Piece,
  type Tetromino,
} from "../board";
import { FLAT_TOP_PLACEMENTS } from "../lst";
import {
  advanceConstructions,
  inferConstructions,
  constructionKey,
  constructionBoardKey,
  type Construction,
} from "./lstConstruction";
import { evaluateLST } from "./lstEvaluation";
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
  evidence?: "construction" | "unresolved" | "unrecognized";
  constructionTrace?: { boardKey: string; states: Construction[] }[];
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
  tsds: number;
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
  constructions?: Construction[];
  rank: number[];
};

type AnalyzeOptions = {
  budgetMs?: number;
  maxDepth?: number;
  instantSoftDrop?: boolean;
  now?: () => number;
  mode?: SolverMode;
  initialConstructions?: Construction[];
  seedPlans?: PlannedMove[][];
  onProgress?: (analysis: Analysis) => void;
};

export function analyze(
  position: SolverPosition,
  side: WellSide,
  options: AnalyzeOptions = {},
): Analysis {
  const now = options.now ?? (() => performance.now());
  const started = now();
  const primary = search(position, side, { ...options, seedPlans: undefined });
  const remaining = (options.budgetMs ?? 500) - (now() - started);
  // A saved repair is a fallback for a lost continuation. Mixing its prefixes
  // into a healthy fresh beam can change good decisions with newly seen pieces.
  if (
    options.mode !== "lst" ||
    !options.seedPlans?.length ||
    remaining <= 0 ||
    primary.lines[0]?.evidence === "construction"
  )
    return primary;
  const repair = search(position, side, {
    ...options,
    budgetMs: remaining,
    onProgress: options.onProgress
      ? (a) =>
          options.onProgress!({
            ...a,
            elapsedMs: now() - started,
            nodes: primary.nodes + a.nodes,
          })
      : undefined,
  });
  const selected =
    repair.lines[0]?.evidence === "construction" ? repair : primary;
  const timedOut = primary.timedOut || repair.timedOut;
  return {
    ...selected,
    elapsedMs: now() - started,
    nodes: primary.nodes + repair.nodes,
    complete: !timedOut && selected.complete,
    timedOut,
    stopReason: timedOut ? "time" : selected.stopReason,
  };
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
  const isLST = options.mode === "lst";
  const maxDepth = Math.min(6, options.maxDepth ?? 6);
  const evaluate = (board: Board, tsds: number) =>
    isLST ? evaluateLST(board, tsds) : evaluateBoard(board, side);
  const compare = (a: Node, b: Node) => {
    for (let i = 0; i < a.rank.length; i++) {
      const d = a.rank[i] - b.rank[i];
      if (d) return d;
    }
    return a.cost - b.cost;
  };
  const evaluationCache = new Map<string, ReturnType<typeof evaluateLST>>();
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
          isLST,
        );
      if (!expired()) placementCache.set(cacheKey, placements);
      for (const p of placements) {
        if (expired()) break;
        if (
          isLST &&
          node.tsds === 0 &&
          placementKey(p.piece) !==
            placementKey(
              FLAT_TOP_PLACEMENTS.find(
                (target) => target.type === p.piece.type,
              )!,
            )
        )
          continue;
        const result = lock(node.board, p.piece);
        if (
          isLST &&
          p.piece.type === "T" &&
          !(p.spin === "full" && result.cleared === 2)
        )
          continue;
        if (
          isLST &&
          result.cleared > 0 &&
          result.cleared !== 4 &&
          !(p.spin === "full" && result.cleared === 2)
        )
          continue;
        const nextType = queue[choice.cursor];
        const active = nextType ? spawn(nextType) : null;
        if (active && collides(result.board, active)) continue;
        const tsds =
          node.tsds + Number(p.spin === "full" && result.cleared === 2);
        const constructions =
          isLST && tsds >= 2
            ? node.constructions?.length
              ? advanceConstructions(node.constructions, node.board, p.piece)
              : inferConstructions(result.board)
            : undefined;
        if (node.constructions?.length && constructions?.length === 0) continue;
        const evaluationKey = `${tsds}:${occupancy(result.board)}:${constructions ? constructionKey(constructions) : ""}`;
        let cached = isLST ? evaluationCache.get(evaluationKey) : undefined;
        if (isLST && !cached) {
          cached = evaluateLST(result.board, tsds, constructions);
          evaluationCache.set(evaluationKey, cached);
        }
        const metrics = cached ?? evaluate(result.board, tsds);
        const lst = isLST
          ? (metrics as ReturnType<typeof evaluateLST>)
          : undefined;
        // Unknown structure is not proof of impossibility. Keep it behind
        // recognized, viable constructions, with explicit evidence in the UI.
        // Each completed TSD advances the milestone; otherwise a ready cavity
        // would rank ahead of actually clearing it. At most 16 supports plus
        // one roof are missing, so 18 separates consecutive milestones.
        const rank = lst
          ? [
              Number(!lst.recognized),
              lst.impossible,
              lst.holes,
              lst.wellBlocks,
              lst.supportDebt - 18 * (tsds - (position.tsds ?? 0)),
              -lst.freedom,
            ]
          : [];

        const effort = node.effort + p.effort + Number(choice.useHold);
        const clearCost =
          node.clearCost +
          (isLST
            ? p.spin === "full" && result.cleared === 2
              ? -500
              : result.cleared === 4
                ? -200
                : result.cleared * 90 + (p.piece.type === "T" ? 120 : 0)
            : result.cleared === 4
              ? -240
              : result.cleared * 90) +
          metrics.holes * 12;
        // Charge each intermediate surface: later repairs do not erase the
        // dependence on receiving and placing those repair pieces in order.
        const surfaceCost =
          node.surfaceCost +
          metrics.roughness * 3 +
          metrics.dependencies * 0.5 +
          metrics.unevenness * (isLST ? 0.5 : 4) +
          (isLST && "balance" in metrics ? Number(metrics.balance) * 0.5 : 0);
        children.push({
          tsds,
          constructions,
          rank,
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
    ...position,
    tsds: position.tsds ?? 0,
    constructions:
      isLST && (position.tsds ?? 0) >= 2
        ? (options.initialConstructions ?? inferConstructions(position.board))
        : undefined,
    rank: [],
    cursor: 0,
    moves: [],
    effort: 0,
    clearCost: 0,
    surfaceCost: 0,
    cost: 0,
  };
  // Replay previously searched tails against the CURRENT queue/hold and real
  // reachable moves. Retain their prefixes so a necessary temporary repair is
  // not lost merely because a fresh beam prefers its intermediate surface.
  const seeds = new Map<number, Node[]>();
  for (const plan of (isLST ? options.seedPlans?.slice(0, 3) : undefined) ??
    []) {
    let node: Node | undefined = initial;
    for (const move of plan.slice(0, maxDepth)) {
      if (expired() || !node) break;
      // A hold-triggered refresh may already have consumed the first hold.
      const useHold: boolean =
        node.moves.length === 0 &&
        !node.canHold &&
        move.useHold &&
        node.active?.type === move.piece.type
          ? false
          : move.useHold;
      node = expand(node).find((n) => {
        const actual = n.moves[n.moves.length - 1];
        return (
          actual.useHold === useHold &&
          placementKey(actual.piece) === placementKey(move.piece) &&
          actual.spin === move.spin &&
          actual.cleared === move.cleared
        );
      });
      if (node)
        seeds.set(node.moves.length, [
          ...(seeds.get(node.moves.length) ?? []),
          node,
        ]);
    }
  }
  const keepSeeds = (nodes: Node[], depth: number, root: string) => {
    const selected = nodes.slice(0, isLST ? 8 : 2);
    for (const seed of seeds.get(depth) ?? []) {
      if (placementKey(seed.moves[0].piece) !== root) continue;
      if (
        selected.some(
          (n) =>
            n.tsds === seed.tsds &&
            n.hold === seed.hold &&
            n.cursor === seed.cursor &&
            occupancy(n.board) === occupancy(seed.board) &&
            constructionKey(n.constructions ?? []) ===
              constructionKey(seed.constructions ?? []),
        )
      )
        continue;
      // Retained repairs supplement the beam; displacing fresh alternatives
      // can discard a better continuation when more of the queue is revealed.
      selected.push(seed);
    }
    return selected;
  };
  const rootChildren = expand(initial).sort(compare);
  let interrupted = expired();
  let completedDepth = interrupted ? 0 : 1;
  let groups = new Map<string, Node[]>();
  for (const child of rootChildren) {
    const key = placementKey(child.moves[0].piece);
    const group = groups.get(key);
    if (group && group.length < (isLST ? 8 : 2)) group.push(child);
    else if (!group && groups.size < (isLST ? 24 : 16))
      groups.set(key, [child]);
  }
  const trace = (n: Node) => {
    let states = initial.constructions;
    let tsds = initial.tsds;
    return n.moves.flatMap((move) => {
      tsds += Number(move.spin === "full" && move.cleared === 2);
      if (tsds < 2) return [];
      states = states?.length
        ? advanceConstructions(states, move.before, move.piece)
        : inferConstructions(move.after);
      return states.length
        ? [{ boardKey: constructionBoardKey(move.after), states }]
        : [];
    });
  };
  for (const seed of seeds.get(1) ?? []) {
    const root = placementKey(seed.moves[0].piece);
    groups.set(root, keepSeeds(groups.get(root) ?? [], 1, root));
  }
  const getLines = () =>
    [...groups.values()]
      .map((group) => group.sort(compare)[0])
      .filter((n): n is Node => n !== undefined)
      .sort(compare)
      .slice(0, 3)
      .map((n) => ({
        moves: n.moves,
        cost: n.cost,
        effort: n.effort,
        metrics: isLST
          ? evaluateLST(n.board, n.tsds, n.constructions)
          : evaluate(n.board, n.tsds),
        ...(isLST
          ? {
              constructionTrace: trace(n),
              evidence: (!n.rank[0]
                ? !n.rank[1] && !n.rank[2] && !n.rank[3]
                  ? "construction"
                  : "unresolved"
                : "unrecognized") as NonNullable<Continuation["evidence"]>,
            }
          : {}),
      }));
  const report = () => {
    if (!isLST || interrupted || !groups.size) return;
    options.onProgress?.({
      lines: getLines(),
      elapsedMs: now() - started,
      depth: completedDepth,
      timedOut: false,
      complete: false,
      nodes,
    });
  };
  report();
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
            const id = `${n.constructions ? constructionKey(n.constructions) : ""}:${n.tsds}:${n.hold}:${n.cursor}:${n.board.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("")}`;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .slice(0, isLST ? 8 : 2);
        next.set(key, keepSeeds(unique, depth + 1, key));
        if (unique.some((n) => n.moves.length > depth)) advanced = true;
      }
    }
    // Incomplete rounds are never published as recommendations.
    if (interrupted) break;
    groups = next;
    completedDepth = depth + 1;
    report();
    if (!advanced) break;
  }
  const lines =
    interrupted && (!isLST || completedDepth === 0) ? [] : getLines();
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
