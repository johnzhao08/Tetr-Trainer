import {
  cells,
  emptyBoard,
  move,
  project,
  rotate,
  spawn,
  type Piece,
  type Tetromino,
} from "./board";

// One key press. DAS to a wall counts as a single (held) press.
export type FinesseInput =
  | "left"
  | "right"
  | "dasLeft"
  | "dasRight"
  | "cw"
  | "ccw"
  | "flip";

export type Placement = { landing: Piece; path: FinesseInput[] };

const EMPTY = emptyBoard();

/** Occupied cells of a piece once dropped, as a stable key. */
export function landingKey(piece: Piece): string {
  return cells(project(EMPTY, piece))
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(" ");
}

function apply(piece: Piece, input: FinesseInput): Piece {
  switch (input) {
    case "left":
    case "right":
      return move(EMPTY, piece, input === "left" ? -1 : 1, 0);
    case "dasLeft":
    case "dasRight": {
      const dx = input === "dasLeft" ? -1 : 1;
      let current = piece;
      for (let next = move(EMPTY, current, dx, 0); next !== current; ) {
        current = next;
        next = move(EMPTY, current, dx, 0);
      }
      return current;
    }
    default:
      return rotate(EMPTY, piece, input === "cw" ? 1 : input === "ccw" ? -1 : 2);
  }
}

const cache = new Map<string, Placement[]>();

/**
 * Every distinct empty-board placement of a piece with its fewest-press input
 * path from spawn, found by breadth-first search over single presses. Shapes
 * that look the same (S, Z, I and O rotations) count as one placement.
 */
export function placements(type: Tetromino, use180 = true): Placement[] {
  const cacheKey = `${type}${use180}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const inputs: FinesseInput[] = [
    "left",
    "right",
    "dasLeft",
    "dasRight",
    "cw",
    "ccw",
    ...(use180 ? (["flip"] as const) : []),
  ];
  const start = spawn(type);
  const seen = new Set([poseKey(start)]);
  const found = new Map<string, Placement>();
  let frontier: { piece: Piece; path: FinesseInput[] }[] = [
    { piece: start, path: [] },
  ];
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const { piece, path } of frontier) {
      const key = landingKey(piece);
      if (!found.has(key))
        found.set(key, { landing: project(EMPTY, piece), path });
      for (const input of inputs) {
        const moved = apply(piece, input);
        if (seen.has(poseKey(moved))) continue;
        seen.add(poseKey(moved));
        next.push({ piece: moved, path: [...path, input] });
      }
    }
    frontier = next;
  }
  const result = [...found.values()];
  cache.set(cacheKey, result);
  return result;
}

function poseKey(piece: Piece) {
  return `${piece.x},${piece.y},${piece.rotation}`;
}

/** Fewest presses needed to reach the landing of `target`. */
export function optimalPath(target: Piece, use180 = true): FinesseInput[] {
  const key = landingKey(target);
  const placement = placements(target.type, use180).find(
    (p) => landingKey(p.landing) === key,
  );
  if (!placement) throw new Error("Placement is not reachable");
  return placement.path;
}
