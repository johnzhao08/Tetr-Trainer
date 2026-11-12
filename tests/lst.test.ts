import { analyze } from "../src/core/solver/search";
import { solverSnapshot } from "../src/core/solver/snapshot";
import { evaluateLst } from "../src/core/solver/lstEval";
import { toRows } from "../src/core/solver/bitboard";
import { expect, it } from "vitest";
import {
  LSTGame,
  LST_FIRST_BAG,
  FLAT_TOP_PLACEMENTS,
  SECOND_TSD_PLACEMENTS,
  THIRD_TSD_PLACEMENTS,
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

it("the LST search recommends real full doubles on all three source TSD slots", () => {
  const game = new LSTGame(1);
  game.state.queue = [
    ...LST_FIRST_BAG.slice(1),
    ...SECOND_TSD_PLACEMENTS.map((p) => p.type),
    ...THIRD_TSD_PLACEMENTS.map((p) => p.type),
    ...game.state.queue.slice(6),
  ];
  for (const targets of [
    FLAT_TOP_PLACEMENTS,
    SECOND_TSD_PLACEMENTS,
    THIRD_TSD_PLACEMENTS,
  ]) {
    for (const target of targets.slice(0, -1)) place(game, target);
    const before = game.state.fullTSpinDoubles;
    const result = analyze(solverSnapshot(game.state), "right", {
      mode: "lst",
      now: () => 0,
      maxDepth: 1,
    });
    const first = result.lines[0].moves[0];
    expect(first.spin).toBe("full");
    expect(first.cleared).toBe(2);
    expect(first.useHold).toBe(false);
    play(game, { ...first, effort: 0, spin: first.spin ?? null });
    expect(game.state.fullTSpinDoubles).toBe(before + 1);
  }
});
it("the opening planner builds the first full TSD from an empty board using only visible previews", () => {
  const game = new LSTGame(1);
  const chosen = [];
  for (let i = 0; i < 10 && game.state.fullTSpinDoubles === 0; i++) {
    const result = analyze(solverSnapshot(game.state), "right", {
      mode: "lst",
      now: () => 0,
    });
    const first = result.lines[0]?.moves[0];
    expect(first).toBeDefined();
    chosen.push(first.piece);
    if (first.useHold) {
      game.keyDown("hold");
      game.keyUp("hold");
    }
    play(game, { ...first, effort: 0, spin: first.spin ?? null });
  }
  expect(game.state.fullTSpinDoubles, JSON.stringify(chosen)).toBe(1);
});
it("does not treat an arbitrary buried hole as a planned spin cavity", () => {
  const game = new LSTGame(1);
  game.state.board[2][8] = "X";
  expect(evaluateLst(toRows(game.state.board)).holes).toBe(2);
});
it("plans the transition into LST on the researched three-bag example", () => {
  const game = new LSTGame(1);
  game.state.queue = [
    ...LST_FIRST_BAG.slice(1),
    ...SECOND_TSD_PLACEMENTS.map((p) => p.type),
    ...THIRD_TSD_PLACEMENTS.map((p) => p.type),
    ...game.state.queue.slice(6),
  ];
  const chosen = [];
  for (let i = 0; i < 24 && game.state.fullTSpinDoubles < 3; i++) {
    const result = analyze(solverSnapshot(game.state), "right", {
      mode: "lst",
      now: () => 0,
    });
    const first = result.lines[0]?.moves[0];
    expect(
      first,
      JSON.stringify({
        chosen,
        board: game.state.board.slice(0, 10),
        active: game.state.active,
        queue: game.state.queue.slice(0, 5),
      }),
    ).toBeDefined();
    chosen.push({
      piece: first.piece,
      spin: first.spin,
      cleared: first.cleared,
    });
    if (first.useHold) {
      game.keyDown("hold");
      game.keyUp("hold");
    }
    play(game, { ...first, effort: 0, spin: first.spin ?? null });
  }
  expect(game.state.fullTSpinDoubles, JSON.stringify(chosen)).toBe(3);
}, 20000);
