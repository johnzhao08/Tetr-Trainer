import { lock, spawn, type Board, type Piece, type Tetromino } from "../board";
import { FLAT_TOP_PLACEMENTS } from "../lst";
import {
  covered,
  fastPlacements,
  inputEstimate,
  leftColumn,
  lockRows,
  spawnBlocked,
  stackTop,
  toRows,
  type Rows,
} from "./bitboard";
import { attackFor } from "../stats";
import { evaluateLst, type LstEval } from "./lstEval";
import { placementKey, reachablePlacements } from "./placements";
import type {
  Analysis,
  AnalyzeOptions,
  Continuation,
  LstObjective,
  PlannedMove,
  SolverPosition,
} from "./search";

// Path costs, in the same units as the static evaluation (lower is better).
export const REWARDS = {
  tsd: -900,
  quad: -650,
  // Any other clear spends structure; it is for survival, not for points.
  otherClear: 160,
  // A T placed anywhere but a double slot costs this bag its T-spin.
  wastedT: 450,
  // LST builds the left rail from L and S only; anything else there is a
  // last resort, not a plan.
  offRail: 500,
  // Tucks and slides are legal but harder to execute than a plain drop.
  tuck: 30,
  // Prefer taking a ready double sooner rather than later in the line.
  delay: 5,
  beam: 140,
};
// Added on top of REWARDS for the competitive objective. Tuned on seeded
// self-play for attack and keys per piece (SOLVER.md, "Competitive
// objective"). An explicit reward per line of attack was tried and dropped:
// the double and Quad rewards already carry it, and keeping the chain alive
// is what raises attack.
export const COMPETITIVE = {
  // Per estimated key press, hard drop and hold included.
  key: 15,
  // A clear that ends a running back-to-back chain.
  chainBreak: 500,
};
const PROGRESS_AFTER_MS = 150;
// Alternatives shown to the player must survive pruning by a strong favourite.
const ROOTS_KEPT = 6;
const PER_ROOT = 5;

type Step = {
  type: Tetromino;
  x: number;
  y: number;
  rotation: number;
  spin: number;
  cleared: number;
  useHold: boolean;
};
type Node = {
  rows: Rows;
  // null: nothing left to place from the visible queue.
  active: Tetromino | null;
  // "?" is an unseen piece parked in hold by the final lookahead step.
  hold: Tetromino | "?" | null;
  cursor: number;
  canHold: boolean;
  parent: Node | null;
  step: Step | null;
  root: number;
  depth: number;
  // Hold presses in the line; only used to order otherwise equal lines.
  holds: number;
  // Back-to-back chain after this placement, as GameState stores it.
  b2b: number;
  opener: boolean;
  path: number;
  cost: number;
  evaluation: LstEval;
};

const openerKeys = new Map(
  FLAT_TOP_PLACEMENTS.map((p) => [p.type, placementKey(p)]),
);
// The preset first bag is only enforced while the board is still a prefix of
// the flat-top diagram; after a misdrop the general search takes over.
function onOpenerTrack(position: SolverPosition) {
  if ((position.tsds ?? 0) !== 0) return false;
  const expected = new Set<number>();
  const present = new Set<number>();
  position.board.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell !== null) present.add(y * 10 + x);
    }),
  );
  for (const target of FLAT_TOP_PLACEMENTS.slice(0, -1)) {
    const key = placementKey(target).split(":")[1].split(",").map(Number);
    if (key.every((c) => present.has(c))) key.forEach((c) => expected.add(c));
    else if (key.some((c) => present.has(c))) return false;
  }
  return present.size === expected.size;
}

// A full T-spin double in the LST well can be played right now. Strict LST
// breaks down when a T waits in hold without one (see LST_RESEARCH.md), so
// the panel warns about that state and flags lines that end in it. It is not
// a search cost: every held-T penalty tried in self-play lowered the double
// rate, because holding the T is usually how the engine waits for its slot.
export function tsdReady(rows: Rows, instant = true, top = stackTop(rows)) {
  return fastPlacements(rows, "T", instant, top).some(
    (p) =>
      p.spin === 2 &&
      p.x === 2 &&
      p.rotation === 2 &&
      lockRows(rows, "T", p.x, p.y, p.rotation).cleared === 2,
  );
}

function hashRows(rows: Rows, top: number, salt: number) {
  let a = 0x811c9dc5 ^ salt,
    b = 0x9e3779b9 + salt;
  for (let y = 0; y < top; y++) {
    a = Math.imul(a ^ rows[y], 16777619);
    b = Math.imul(b + rows[y], 0x85ebca6b) ^ (b >>> 13);
  }
  return (a >>> 0) * 2097152 + (b >>> 11);
}

export function analyzeLst(
  position: SolverPosition,
  options: AnalyzeOptions = {},
): Analysis {
  const now = options.now ?? (() => performance.now());
  const started = now();
  const expired = () => now() - started >= (options.budgetMs ?? 500);
  const instant = options.instantSoftDrop ?? true;
  const objective: LstObjective = options.objective ?? "competitive";
  const competitive = objective === "competitive";
  const queue = position.visibleQueue.slice(0, 5); // never the hidden queue
  // Active + previews + hold: every piece the player can actually see.
  const maxDepth = Math.min(7, options.maxDepth ?? 7);
  let nodes = 0;

  const run = (useOpener: boolean) => {
    const rootRows = toRows(position.board);
    const root: Node = {
      rows: rootRows,
      active: position.active?.type ?? null,
      hold: position.hold,
      cursor: 0,
      canHold: position.canHold,
      parent: null,
      step: null,
      root: -1,
      depth: 0,
      holds: 0,
      b2b: position.b2b ?? -1,
      opener: useOpener,
      path: 0,
      cost: 0,
      evaluation: evaluateLst(rootRows),
    };
    const rootKeys: string[] = [];
    const rootIndex = (type: Tetromino, p: Piece) => {
      const key = placementKey({ ...p, type });
      const found = rootKeys.indexOf(key);
      return found >= 0 ? found : rootKeys.push(key) - 1;
    };

    const expand = (node: Node, out: Node[]) => {
      const choices: {
        type: Tetromino;
        hold: Node["hold"];
        cursor: number;
        useHold: boolean;
      }[] = [];
      if (node.active)
        choices.push({
          type: node.active,
          hold: node.hold,
          cursor: node.cursor,
          useHold: false,
        });
      if (node.canHold && node.hold !== "?") {
        if (node.active && node.hold)
          choices.push({
            type: node.hold,
            hold: node.active,
            cursor: node.cursor,
            useHold: true,
          });
        else if (node.active && queue[node.cursor])
          choices.push({
            type: queue[node.cursor],
            hold: node.active,
            cursor: node.cursor + 1,
            useHold: true,
          });
        else if (!node.active && node.hold)
          // The next piece is unseen, but swapping it for the held piece is
          // still a move the player can make.
          choices.push({
            type: node.hold,
            hold: "?",
            cursor: node.cursor,
            useHold: true,
          });
      }
      const top = stackTop(node.rows);
      for (const choice of choices) {
        const opener = node.opener ? openerKeys.get(choice.type) : undefined;
        for (const p of fastPlacements(node.rows, choice.type, instant, top)) {
          const piece = { type: choice.type, ...p };
          if (node.opener) {
            if (placementKey(piece) !== opener) continue;
            if (choice.type === "T" && p.spin !== 2) continue;
          }
          const locked = lockRows(node.rows, choice.type, p.x, p.y, p.rotation);
          const tsd =
            choice.type === "T" && p.spin === 2 && locked.cleared === 2;
          const nextType =
            choice.hold === "?" ? undefined : queue[choice.cursor];
          if (nextType && spawnBlocked(locked.rows, nextType)) continue;
          const evaluation = evaluateLst(locked.rows);
          const tucked = covered(
            node.rows,
            choice.type,
            p.x,
            p.y,
            p.rotation,
            top,
          );
          const b2b = !locked.cleared
            ? node.b2b
            : locked.cleared === 4 || (choice.type === "T" && p.spin)
              ? node.b2b + 1
              : -1;
          const score = competitive
            ? COMPETITIVE.key *
                (inputEstimate(choice.type, p.x, p.rotation, tucked) +
                  Number(choice.useHold)) +
              (node.b2b >= 0 && b2b < 0 ? COMPETITIVE.chainBreak : 0)
            : 0;
          const path =
            node.path +
            score +
            (tsd
              ? REWARDS.tsd + node.depth * REWARDS.delay
              : locked.cleared === 4
                ? REWARDS.quad
                : (locked.cleared ? REWARDS.otherClear : 0) +
                  (choice.type === "T" ? REWARDS.wastedT : 0)) +
            (!tsd && tucked ? REWARDS.tuck : 0) +
            (!tsd &&
            choice.type !== "L" &&
            choice.type !== "S" &&
            leftColumn(choice.type, p.x, p.rotation) < 2
              ? REWARDS.offRail
              : 0);
          out.push({
            rows: locked.rows,
            active: nextType ?? null,
            hold: choice.hold,
            cursor: choice.cursor + Number(Boolean(nextType)),
            canHold: true,
            parent: node,
            step: {
              type: choice.type,
              ...p,
              cleared: locked.cleared,
              useHold: choice.useHold,
            },
            root: node.depth === 0 ? rootIndex(choice.type, piece) : node.root,
            depth: node.depth + 1,
            holds: node.holds + Number(choice.useHold),
            b2b,
            opener: node.opener && !tsd,
            path,
            cost: path + evaluation.cost,
            evaluation,
          });
          nodes++;
        }
      }
    };

    const select = (candidates: Node[]) => {
      // Stable: equal costs keep the order of their parents, so ties go to
      // the line whose earlier positions were better.
      candidates.sort((a, b) => a.cost - b.cost);
      // Merge transpositions: same stack, hold and queue position.
      const seen = new Set<number>();
      const unique: Node[] = [];
      for (const n of candidates) {
        const salt =
          n.cursor * 64 +
          (n.active ? 8 : 0) +
          (n.hold === null ? 0 : n.hold === "?" ? 1 : n.hold.charCodeAt(0)) *
            1024 +
          n.root * 65536;
        const id = hashRows(n.rows, stackTop(n.rows), salt);
        if (seen.has(id)) continue;
        seen.add(id);
        unique.push(n);
      }
      const kept = unique.slice(0, REWARDS.beam);
      const perRoot = new Map<number, number>();
      for (const n of kept) perRoot.set(n.root, (perRoot.get(n.root) ?? 0) + 1);
      const favoured: number[] = [];
      for (const n of unique) {
        if (!favoured.includes(n.root)) favoured.push(n.root);
        if (favoured.length === ROOTS_KEPT) break;
      }
      for (const n of unique.slice(REWARDS.beam)) {
        const count = perRoot.get(n.root) ?? 0;
        if (!favoured.includes(n.root) || count >= PER_ROOT) continue;
        perRoot.set(n.root, count + 1);
        kept.push(n);
      }
      return kept;
    };

    let beam: Node[] = [root];
    let completed: Node[] = [];
    let completedDepth = 0;
    let interrupted = false;
    const publish = () => {
      if (!options.onProgress || !completed.length) return;
      // Building lines replays exact input paths; only worth it when the
      // search is slow enough that the player would otherwise be waiting.
      if (now() - started < PROGRESS_AFTER_MS) return;
      options.onProgress({
        lines: buildLines(position, completed, instant),
        elapsedMs: now() - started,
        depth: completedDepth,
        timedOut: false,
        complete: false,
        nodes,
      });
    };
    for (let depth = 0; depth < maxDepth; depth++) {
      if (expired()) {
        interrupted = true;
        break;
      }
      const next: Node[] = [];
      let advanced = false;
      for (const node of beam) {
        const before = next.length;
        expand(node, next);
        if (next.length > before) advanced = true;
        // A line may always stop here: the remaining pieces are unknown.
        if (!node.active && node.depth > 0) next.push(node);
        if (expired()) {
          interrupted = true;
          break;
        }
      }
      // Incomplete rounds are never published as recommendations.
      if (interrupted || !advanced) break;
      beam = select(next);
      completed = beam;
      completedDepth = depth + 1;
      if (depth + 1 < maxDepth) publish();
    }
    return { completed, completedDepth, interrupted };
  };

  let result = run(onOpenerTrack(position));
  if (!result.completed.length && !result.interrupted) result = run(false);
  const lines = buildLines(position, result.completed, instant);
  return {
    lines,
    elapsedMs: now() - started,
    depth: result.interrupted
      ? result.completedDepth
      : lines.length
        ? Math.min(...lines.map((l) => l.moves.length))
        : 0,
    timedOut: result.interrupted,
    complete: !result.interrupted,
    stopReason: result.interrupted
      ? "time"
      : lines.length
        ? "horizon"
        : "no-continuation",
    nodes,
  };
}

// The preset opener's lines all end on the same board; show the one with the
// fewest hold presses first. Elsewhere ties keep the beam's own order.
const fewerHolds = (a: Node, b: Node) => a.cost - b.cost || a.holds - b.holds;
const byCost = (a: Node, b: Node) => a.cost - b.cost;

// Replay the best line of each first placement on the real board. The path
// search supplies the exact inputs, so a line it cannot reproduce is dropped
// rather than shown.
function buildLines(
  position: SolverPosition,
  beam: Node[],
  instant: boolean,
): Continuation[] {
  const order = beam.some((node) => node.opener) ? fewerHolds : byCost;
  const best = new Map<number, Node>();
  for (const node of beam) {
    const current = best.get(node.root);
    if (!current || order(node, current) < 0) best.set(node.root, node);
  }
  const lines: Continuation[] = [];
  for (const leaf of [...best.values()].sort(order)) {
    const steps: Step[] = [];
    for (let n: Node | null = leaf; n?.step; n = n.parent)
      steps.unshift(n.step);
    let board: Board = position.board;
    const moves: PlannedMove[] = [];
    let effort = 0,
      attack = 0,
      b2b = position.b2b ?? -1,
      combo = position.combo ?? -1;
    for (const step of steps) {
      const piece: Piece = {
        type: step.type,
        x: step.x,
        y: step.y,
        rotation: step.rotation as Piece["rotation"],
      };
      const key = placementKey(piece);
      const wanted = step.spin === 2 ? "full" : step.spin === 1 ? "mini" : null;
      const placement = reachablePlacements(
        board,
        spawn(step.type),
        instant,
        () => false,
        true,
      ).find(
        (p) =>
          placementKey(p.piece) === key &&
          (step.type !== "T" || p.spin === wanted),
      );
      if (!placement) break;
      const after = lock(board, placement.piece);
      moves.push({
        before: board,
        piece: placement.piece,
        after: after.board,
        cleared: after.cleared,
        useHold: step.useHold,
        path: placement.path,
        spin: placement.spin,
      });
      effort += placement.effort + Number(step.useHold);
      if (after.cleared) {
        combo++;
        b2b = after.cleared === 4 || placement.spin ? b2b + 1 : -1;
        attack += attackFor({
          lines: after.cleared,
          spin: placement.spin,
          b2b,
          combo,
          allClear: after.board[0].every((cell) => cell === null),
        });
      } else combo = -1;
      board = after.board;
    }
    if (moves.length !== steps.length) continue;
    const e = leaf.evaluation;
    lines.push({
      moves,
      cost: leaf.cost,
      effort,
      metrics: {
        holes: e.holes,
        wellBlocks: e.wellBlocks,
        roughness: e.roughness,
        dependencies: 0,
        unevenness: 0,
        height: e.height,
        cost: e.cost,
      },
      evidence: e.damaged ? "unresolved" : "construction",
      heldTStuck: leaf.hold === "T" && !tsdReady(leaf.rows, instant),
      attack,
    });
    if (lines.length === 3) break;
  }
  return lines;
}
