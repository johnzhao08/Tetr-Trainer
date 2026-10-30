import {
  cells,
  collides,
  move,
  project,
  rotate,
  type Board,
  type Piece,
} from "../board";

export type Move =
  | "left"
  | "right"
  | "wallLeft"
  | "wallRight"
  | "down"
  | `down:${number}`
  | "drop"
  | "cw"
  | "ccw"
  | "flip";
export type Placement = { piece: Piece; path: Move[]; effort: number };
const poseKey = (p: Piece) => `${p.x},${p.y},${p.rotation}`;
export const placementKey = (p: Piece) =>
  `${p.type}:${cells(p)
    .map(([x, y]) => y * 10 + x)
    .sort((a, b) => a - b)
    .join(",")}`;

export function transition(board: Board, piece: Piece, action: Move): Piece {
  if (action.startsWith("down:")) {
    let next = piece;
    for (let n = Number(action.slice(5)); n > 0; n--)
      next = move(board, next, 0, -1);
    return next;
  }
  switch (action) {
    case "wallLeft":
    case "wallRight": {
      let next = piece;
      for (;;) {
        const shifted = move(board, next, action === "wallLeft" ? -1 : 1, 0);
        if (shifted === next) return next;
        next = shifted;
      }
    }
    case "left":
      return move(board, piece, -1, 0);
    case "right":
      return move(board, piece, 1, 0);
    case "down":
      return move(board, piece, 0, -1);
    case "drop":
      return project(board, piece);
    case "cw":
      return rotate(board, piece, 1);
    case "ccw":
      return rotate(board, piece, -1);
    case "flip":
      return rotate(board, piece, 2);
  }
  return piece;
}

// Search actual reachable poses, including grounded slides and SRS+ kicks.
// Unit-cost BFS finds minimum tap/DAS finesse, including rotation order.
// Timing, charged DAS across actions, and input carryover across locks are excluded.
export function reachablePlacements(
  board: Board,
  start: Piece,
  instantSoftDrop = true,
  expired: () => boolean = () => false,
): Placement[] {
  if (collides(board, start)) return [];
  const nodes: {
    piece: Piece;
    parent: number;
    action?: Move;
    depth: number;
  }[] = [{ piece: start, parent: -1, depth: 0 }];
  const seen = new Set([poseKey(start)]);
  const results = new Map<string, Placement>();
  const actions: Move[] = [
    "left",
    "right",
    "wallLeft",
    "wallRight",
    "cw",
    "ccw",
    "flip",
    "drop",
  ];
  if (!instantSoftDrop) actions.push("down");
  for (let i = 0; i < nodes.length; i++) {
    if (i % 64 === 0 && expired()) break;
    const p = nodes[i].piece;
    // Hard drop is a terminal one-input action from ANY reachable pose.
    const landed = project(board, p);
    const key = placementKey(landed);
    if (!results.has(key)) {
      const path: Move[] = [];
      for (let n = i; nodes[n].parent !== -1; n = nodes[n].parent)
        path.push(nodes[n].action!);
      path.reverse();
      path.push("drop"); // Final projection is the hard drop; earlier drops are soft.
      results.set(key, { piece: landed, path, effort: nodes[i].depth + 1 });
    }
    const nextActions = [...actions];
    if (!instantSoftDrop) {
      const distance = p.y - landed.y;
      for (let rows = 2; rows < distance; rows++)
        nextActions.push(`down:${rows}`);
    }
    for (const action of nextActions) {
      const next = transition(board, p, action);
      const key = poseKey(next);
      if (next === p || seen.has(key)) continue;
      seen.add(key);
      nodes.push({ piece: next, parent: i, action, depth: nodes[i].depth + 1 });
    }
  }
  return [...results.values()];
}
