import { expect, it } from "vitest";
import {
  LSTGame,
  LST_FIRST_BAG,
  FLAT_TOP_PLACEMENTS,
  SECOND_TSD_PLACEMENTS,
} from "../src/core/lst";
import { Game } from "../src/core/game";
import { TYPES, type Piece } from "../src/core/board";
import {
  reachablePlacements,
  placementKey,
  type Placement,
} from "../src/core/solver/placements";
import type { Action } from "../src/core/settings";
function play(game: Game, p: Placement) {
  p.path.forEach((move, i) => {
    game.settings.das = move.startsWith("wall") ? 0 : 110;
    const action: Action =
      i === p.path.length - 1
        ? "hardDrop"
        : move === "drop"
          ? "softDrop"
          : move === "wallLeft"
            ? "left"
            : move === "wallRight"
              ? "right"
              : (move as Action);
    game.keyDown(action);
    game.keyUp(action);
  });
}
function place(game: Game, target: Piece) {
  expect(game.state.active!.type).toBe(target.type);
  const paths = reachablePlacements(
    game.state.board,
    game.state.active!,
    true,
    () => false,
    true,
  );
  const p = paths.find(
    (p) =>
      placementKey(p.piece) === placementKey(target) &&
      (target.type !== "T" || p.spin === "full"),
  );
  expect(p, JSON.stringify(target)).toBeDefined();
  play(game, p!);
}
it("replays FOUR's flat-top first two TSDs through actual game controls", () => {
  const game = new LSTGame(1);
  game.state.queue = [
    ...LST_FIRST_BAG.slice(1),
    ...SECOND_TSD_PLACEMENTS.map((p) => p.type),
    ...game.state.queue.slice(6),
  ];
  for (const target of FLAT_TOP_PLACEMENTS) place(game, target);
  expect(game.state.fullTSpinDoubles).toBe(1);
  expect(game.state.lines).toBe(2);
  for (const target of SECOND_TSD_PLACEMENTS) place(game, target);
  expect(game.state.fullTSpinDoubles).toBe(2);
  expect(game.state.lines).toBe(4);
  game.undo();
  expect(game.state.fullTSpinDoubles).toBe(1);
});
it("fixes only the first bag and preserves complete random bags and restart isolation", () => {
  const game = new LSTGame(1),
    other = new LSTGame(2),
    free = new Game(1);
  const initial = structuredClone(free.state);
  expect([game.state.active!.type, ...game.state.queue.slice(0, 6)]).toEqual(
    LST_FIRST_BAG,
  );
  expect([...game.state.queue.slice(6, 13)].sort()).toEqual([...TYPES].sort());
  expect(game.state.queue.slice(6, 13)).not.toEqual(
    other.state.queue.slice(6, 13),
  );
  game.restart(3);
  expect([game.state.active!.type, ...game.state.queue.slice(0, 6)]).toEqual(
    LST_FIRST_BAG,
  );
  expect(free.state).toEqual(initial);
});
export { play, place };
