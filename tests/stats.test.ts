import { describe, expect, it } from "vitest";
import { emptyBoard, move, project, spawn } from "../src/core/board";
import type { Board, Piece, Tetromino } from "../src/core/board";
import { Game } from "../src/core/game";
import { defaultSettings } from "../src/core/settings";
import type { Action } from "../src/core/settings";
import {
  attackFor,
  competitiveMetrics,
  emptyStats,
  finesseOptimal,
} from "../src/core/stats";

const clear = (
  lines: number,
  spin: "full" | "mini" | null = null,
  b2b = -1,
  combo = 0,
  allClear = false,
) => attackFor({ lines, spin, b2b, combo, allClear });

function field(rows: string[]): Board {
  const board = emptyBoard();
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      board[y][x] = cell === "#" ? "X" : null;
    }),
  );
  return board;
}
const landing = (board: Board, piece: Omit<Piece, "y">) =>
  project(board, { ...piece, y: 21 });

describe("attack table", () => {
  it("matches the base values for plain clears and T-spins", () => {
    expect([1, 2, 3, 4].map((n) => clear(n))).toEqual([0, 1, 2, 4]);
    expect([1, 2, 3].map((n) => clear(n, "full"))).toEqual([2, 4, 6]);
    expect([1, 2].map((n) => clear(n, "mini"))).toEqual([0, 1]);
    expect(clear(0, "full")).toBe(0);
  });

  it("adds the B2B chaining bonus from the second qualifying clear", () => {
    expect(clear(2, "full", 0)).toBe(4);
    expect(clear(2, "full", 1)).toBe(5);
    expect(clear(2, "full", 2)).toBe(5);
    expect(clear(2, "full", 3)).toBe(6);
    expect(clear(4, null, 1)).toBe(5);
  });

  it("multiplies by combo and floors small clears at the log curve", () => {
    expect(clear(2, null, -1, 1)).toBe(1);
    expect(clear(2, null, -1, 4)).toBe(2);
    expect(clear(4, null, -1, 4)).toBe(8);
    expect(clear(1, null, -1, 1)).toBe(0);
    expect(clear(1, null, -1, 2)).toBe(1);
    expect(clear(1, null, -1, 8)).toBe(2);
  });

  it("adds the all-clear bonus", () => {
    expect(clear(4, null, -1, 0, true)).toBe(14);
  });
});

describe("finesse", () => {
  const optimal = (type: Tetromino, piece: Omit<Piece, "y" | "type">) =>
    finesseOptimal(
      emptyBoard(),
      type,
      landing(emptyBoard(), { type, ...piece }),
    );

  it("counts the fewest presses on an empty board", () => {
    expect(optimal("T", { x: 4, rotation: 0 })).toBe(0);
    expect(optimal("T", { x: 3, rotation: 0 })).toBe(1);
    expect(optimal("T", { x: 1, rotation: 0 })).toBe(1);
    expect(optimal("T", { x: 2, rotation: 0 })).toBe(2);
    expect(optimal("T", { x: 4, rotation: 2 })).toBe(1);
    expect(optimal("O", { x: 8, rotation: 0 })).toBe(1);
    expect(optimal("I", { x: 0, rotation: 1 })).toBe(2);
  });

  it("treats equivalent rotations of symmetric pieces as the same landing", () => {
    // S rotated 180 covers the same cells as spawn shifted down a row.
    expect(optimal("S", { x: 4, rotation: 2 })).toBe(0);
  });

  it("measures a tuck by its own shortest route", () => {
    const board = field(["..........", "..........", "######...."]);
    // Under the overhang at the left wall: held right, soft drop, held left.
    let target = move(board, spawn("O"), 4, 0);
    target = project(board, target);
    while (move(board, target, -1, 0) !== target)
      target = move(board, target, -1, 0);
    expect(target.x).toBeLessThan(2);
    expect(finesseOptimal(board, "O", target)).toBe(3);
  });
});

describe("game tracking", () => {
  function tap(g: Game, action: Action) {
    g.keyDown(action);
    g.keyUp(action);
  }
  const game = () => new Game(12345, defaultSettings());

  it("counts keys and scores a clean placement", () => {
    const g = game();
    g.state.active = spawn("T");
    tap(g, "hardDrop");
    expect(g.state.stats).toMatchObject({
      keys: 1,
      pieceKeys: 0,
      finesseFaults: 0,
      cleanPieces: 1,
    });
  });

  it("charges every press beyond the optimum as a fault", () => {
    const g = game();
    g.state.active = spawn("T");
    tap(g, "left");
    tap(g, "right");
    tap(g, "right");
    tap(g, "hardDrop");
    expect(g.state.stats).toMatchObject({
      keys: 4,
      finesseFaults: 2,
      cleanPieces: 0,
    });
  });

  it("ignores rejected input and restarts the count after hold", () => {
    const g = game();
    tap(g, "left");
    tap(g, "hold");
    tap(g, "hold");
    expect(g.state.stats.keys).toBe(2);
    expect(g.state.stats.pieceKeys).toBe(0);
  });

  it("adds attack for a T-spin double and rolls it back on undo", () => {
    const g = game();
    g.state.board = field([
      "##.#######",
      "#...######",
      "#.........",
    ]);
    g.state.board[2][0] = null;
    g.state.board[2][1] = "X";
    g.state.active = { type: "T", x: 2, y: 3, rotation: 1 };
    tap(g, "softDrop");
    tap(g, "cw");
    tap(g, "hardDrop");
    expect(g.state.lastEvent?.label).toBe("T-spin Double");
    expect(g.state.stats.attack).toBe(4);
    g.undo();
    expect(g.state.stats.attack).toBe(0);
    expect(g.state.stats.pieceKeys).toBe(0);
  });
});

describe("metrics", () => {
  it("derives per-time and per-piece rates", () => {
    const stats = { ...emptyStats(), attack: 30, keys: 120, cleanPieces: 36 };
    const m = competitiveMetrics(stats, 40, 20_000);
    expect(m.apm).toBeCloseTo(90);
    expect(m.pps).toBeCloseTo(2);
    expect(m.vs).toBeCloseTo(150);
    expect(m.app).toBeCloseTo(0.75);
    expect(m.kpp).toBeCloseTo(3);
    expect(m.finesse).toBeCloseTo(90);
  });

  it("reports zeros before any time or pieces", () => {
    const m = competitiveMetrics(emptyStats(), 0, 0);
    expect([m.apm, m.pps, m.vs, m.app, m.kpp]).toEqual([0, 0, 0, 0, 0]);
    expect(m.finesse).toBe(100);
  });
});
