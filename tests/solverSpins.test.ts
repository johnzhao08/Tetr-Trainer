import { expect, it } from "vitest";
import { emptyBoard, spawn } from "../src/core/board";
import { Game } from "../src/core/game";
import { defaultSettings, type Action } from "../src/core/settings";
import { reachablePlacements } from "../src/core/solver/placements";

it("search spin verdicts match actual game input and lock, including minis", () => {
  const board = emptyBoard();
  board[0] = Array.from({ length: 10 }, (_, x) => (x === 4 ? null : "X"));
  board[2][5] = "X";
  const placements = reachablePlacements(
    board,
    spawn("T"),
    true,
    () => false,
    true,
  );
  expect(placements.some((p) => p.spin === "full")).toBe(true);
  expect(placements.some((p) => p.spin === "mini")).toBe(true);
  for (const placement of placements) {
    const game = new Game(1, { ...defaultSettings(), das: 0, arr: 0 });
    game.state.board = structuredClone(board);
    game.state.active = spawn("T");
    placement.path.forEach((move, i) => {
      const action: Action =
        i === placement.path.length - 1
          ? "hardDrop"
          : move === "drop"
            ? "softDrop"
            : move === "wallLeft"
              ? "left"
              : move === "wallRight"
                ? "right"
                : (move as Action);
      // A tap must remain one cell; wall moves use zero-DAS repeat.
      game.settings.das = move.startsWith("wall") ? 0 : 110;
      game.keyDown(action);
      game.keyUp(action);
    });
    expect(game.state.lastEvent?.spin ?? null).toBe(placement.spin);
  }
});
