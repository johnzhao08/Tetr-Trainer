import { HEIGHT, WIDTH, type Board } from "../board";
export type WellSide = "left" | "right";
export type WellMode = "auto" | WellSide;
export function heights(board: Board): number[] {
  return Array.from({ length: WIDTH }, (_, x) => {
    for (let y = HEIGHT - 1; y >= 0; y--)
      if (board[y][x] !== null) return y + 1;
    return 0;
  });
}
export function chooseWell(
  board: Board,
  previous: WellSide = "right",
): WellSide {
  const h = heights(board),
    current = previous === "right" ? 9 : 0,
    other = 9 - current;
  const gap = (x: number) => h[x === 0 ? 1 : 8] - h[x];
  // Keep an established well; only switch on clear evidence, never on a tie.
  if (gap(current) >= 2) return previous;
  return gap(other) >= 3 && h[current] - h[other] >= 3
    ? previous === "right"
      ? "left"
      : "right"
    : previous;
}
export function evaluateBoard(board: Board, side: WellSide) {
  const h = heights(board),
    well = side === "right" ? 9 : 0;
  let holes = 0,
    wellBlocks = 0,
    roughness = 0;
  for (let x = 0; x < WIDTH; x++)
    for (let y = 0; y < h[x]; y++) {
      if (board[y][x] === null) holes++;
      else if (x === well) wellBlocks++;
    }
  const stack = h.filter((_, x) => x !== well);
  for (let i = 1; i < stack.length; i++)
    roughness += Math.abs(stack[i] - stack[i - 1]);
  // Surface notches constrain future pieces; the deliberate edge well is exempt.
  // Two-deep notches favor J/L access; deeper single-column slots need an I.
  let dependencies = 0;
  for (let x = 0; x < WIDTH; x++) {
    if (x === well) continue;
    const left = x === 0 ? Infinity : h[x - 1];
    const right = x === WIDTH - 1 ? Infinity : h[x + 1];
    const depth = Math.min(left, right) - h[x];
    if (depth >= 3) dependencies += 80 + (depth - 3) * 40;
    else if (depth === 2) dependencies += 24;
  }
  // Adjacent roughness alone treats a broad ramp as smooth. Penalize height
  // imbalance across the entire nine-column stack, excluding its intended well.
  const totalHeight = stack.reduce((a, b) => a + b, 0);
  const unevenness =
    (stack.length * stack.reduce((sum, h) => sum + h * h, 0) -
      totalHeight * totalHeight) /
    stack.length;
  const height = Math.max(...h);
  const danger = Math.max(0, height - 14) ** 2 * 250;
  return {
    holes,
    wellBlocks,
    roughness,
    dependencies,
    unevenness,
    height,
    cost:
      holes * 2000 +
      wellBlocks * 650 +
      danger +
      totalHeight * 2 +
      height * 4 +
      roughness * 3 +
      dependencies +
      unevenness * 2,
  };
}
