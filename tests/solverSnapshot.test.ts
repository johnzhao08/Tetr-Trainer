import { expect, it } from "vitest";
import { Game } from "../src/core/game";
import { solverSnapshot } from "../src/core/solver/snapshot";
import type { Action } from "../src/core/settings";
const tap = (g: Game, a: Action) => {
  g.keyDown(a);
  g.keyUp(a);
};
it("refreshes only on position transactions, never movement or elapsed time", () => {
  const g = new Game(1),
    first = solverSnapshot(g.state);
  expect(first.visibleQueue).toHaveLength(5);
  expect("seed" in first).toBe(false);
  tap(g, "left");
  tap(g, "cw");
  tap(g, "softDrop");
  g.tick(1000);
  g.pause();
  expect(solverSnapshot(g.state, first)).toBe(first);
  g.resume();
  tap(g, "hold");
  const held = solverSnapshot(g.state, first);
  expect(held).not.toBe(first);
  expect(held.canHold).toBe(false);
  tap(g, "hardDrop");
  const locked = solverSnapshot(g.state, held);
  expect(locked).not.toBe(held);
  g.undo();
  const undone = solverSnapshot(g.state, locked);
  expect(undone).not.toBe(locked);
  g.restart(1);
  expect(solverSnapshot(g.state, undone)).not.toBe(undone);
  expect(first.active?.x).toBe(4);
  expect(first.visibleQueue).toHaveLength(5);
});
