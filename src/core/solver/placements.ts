import {
  cells,
  collides,
  move,
  project,
  rotate,
  type Board,
  type Piece,
} from "../board";

export type Move = "left" | "right" | "down" | "drop" | "cw" | "ccw" | "flip";
export type Placement = { piece: Piece; path: Move[]; effort: number };
const poseKey = (p: Piece) => `${p.x},${p.y},${p.rotation}`;
export const placementKey = (p: Piece) =>
  `${p.type}:${cells(p)
    .map(([x, y]) => y * 10 + x)
    .sort((a, b) => a - b)
    .join(",")}`;

export function transition(board: Board, piece: Piece, action: Move): Piece {
  switch (action) {
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
}

// Search actual reachable poses, including grounded slides and SRS+ kicks.
// Effort estimates control actions, not timed DAS/ARR or physical key presses.
export function reachablePlacements(
  board: Board,
  start: Piece,
  instantSoftDrop = true,
  expired: () => boolean = () => false,
): Placement[] {
  if (collides(board, start)) return [];
  const nodes: { piece: Piece; parent: number; action?: Move }[] = [
    { piece: start, parent: -1 },
  ];
  const seen = new Set([poseKey(start)]);
  const results = new Map<string, Placement>();
  const actions: Move[] = ["left", "right", "cw", "ccw", "flip", "drop"];
  if (!instantSoftDrop) actions.push("down");
  for (let i = 0; i < nodes.length; i++) {
    if (i % 64 === 0 && expired()) break;
    const p = nodes[i].piece;
    if (move(board, p, 0, -1) === p) {
      const key = placementKey(p);
      if (!results.has(key)) {
        const path: Move[] = [];
        for (let n = i; nodes[n].parent !== -1; n = nodes[n].parent)
          path.push(nodes[n].action!);
        path.reverse();
        // Consecutive downward steps can be executed by holding soft drop.
        const effort =
          path.filter((a, j) => a !== "down" || path[j - 1] !== "down").length +
          1;
        results.set(key, { piece: p, path, effort });
      }
    }
    for (const action of actions) {
      const next = transition(board, p, action);
      const key = poseKey(next);
      if (next === p || seen.has(key)) continue;
      seen.add(key);
      nodes.push({ piece: next, parent: i, action });
    }
  }
  return [...results.values()];
}
