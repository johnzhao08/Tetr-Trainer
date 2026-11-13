import { expect, it } from "vitest";
import positions from "./fixtures/lst-positions.json";
import {
  emptyBoard,
  spawn,
  type Board,
  type Tetromino,
} from "../src/core/board";
import { LSTGame } from "../src/core/lst";
import { toRows } from "../src/core/solver/bitboard";
import { evaluateLst } from "../src/core/solver/lstEval";
import { tsdReady } from "../src/core/solver/lstSearch";
import { analyze, type SolverPosition } from "../src/core/solver/search";
import { solverSnapshot } from "../src/core/solver/snapshot";
import type { Action } from "../src/core/settings";

// Rows are listed bottom-up; any non-dot character is a filled cell.
function field(rows: readonly string[]): Board {
  const board = emptyBoard();
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ".") board[y][x] = c === "#" ? "X" : (c as Tetromino);
    }),
  );
  return board;
}
const read = (rows: readonly string[]) => evaluateLst(toRows(field(rows)));
function position(
  rows: readonly string[],
  active: Tetromino,
  hold: Tetromino | null,
  queue: string,
  tsds = 4,
): SolverPosition {
  return {
    board: field(rows),
    active: spawn(active),
    hold,
    canHold: true,
    visibleQueue: [...queue] as Tetromino[],
    tsds,
  };
}
const lst = (p: SolverPosition) =>
  analyze(p, "right", { mode: "lst", now: () => 0 });

it("reads a rail-roofed slot and its planned cavity without counting holes", () => {
  // S then L on the rail: the L foot roofs the slot on the S's top row.
  const e = read([
    "##.#######",
    "##.#######",
    "#...######",
    "##........",
    "#.........",
    "#.........",
  ]);
  expect(e.holes).toBe(0);
  expect(e.wellBlocks).toBe(0);
  expect(e.slots[e.slots.length - 1]).toMatchObject({
    pivot: 2,
    roofed: true,
    debt: 0,
  });
  expect(e.damaged).toBe(false);
});

it("reads an open slot roofed from the boundary, entered from the left", () => {
  const e = read(["##.#######", "#...######", "#..##....."]);
  expect(e.slots).toEqual([
    { pivot: 1, roofed: false, rightRoof: true, debt: 0 },
  ]);
  expect(e.holes).toBe(0);
});

it("counts everything still missing on the right below an open slot", () => {
  const ready = read(["##.#######", "#...######"]);
  // Only the roof is missing.
  expect(ready.slots[0]).toMatchObject({ pivot: 1, debt: 1 });
  const short = read(["##.####.##", "#...###..#"]);
  expect(short.slots[0].debt).toBe(4);
});

it("treats a slot whose boundary cell is filled as an ordinary hole", () => {
  const e = read([
    "##.#######",
    "##.#######",
    "#..#######",
    "##........",
    "#.........",
  ]);
  expect(e.slots.some((s) => s.pivot === 2)).toBe(false);
  expect(e.holes).toBe(1);
  expect(e.damaged).toBe(true);
});

it("treats a rail-roofed slot with column 3 built above it as blocked", () => {
  const e = read([
    "##.#######",
    "##.#######",
    "#...######",
    "##.#......",
    "##........",
  ]);
  expect(e.slots.some((s) => s.pivot === 2)).toBe(false);
  expect(e.holes).toBeGreaterThan(0);
});

it("keeps a lower slot usable when the slot stacked on it clears its roof row", () => {
  // Row 3 is both the lower slot's roof and the upper slot's base.
  const e = read([
    "##.#######",
    "##.#######",
    "#...######",
    "##.#######",
    "#...######",
  ]);
  expect(e.slots.map((s) => s.pivot)).toEqual([4, 2]);
  expect(e.holes).toBe(0);
});

it("flags a blocked well, buried holes and a rail whose inner column leads", () => {
  expect(read(["##.#######", "###......."]).wellBlocks).toBe(1);
  expect(read(["##.####.##", "##.#######"]).holes).toBe(1);
  expect(read(["##.#######", ".#.#######"]).railDefect).toBe(1);
});

it("flags a boundary base cell that column 4 has already walled off", () => {
  // Slot at row 2 needs (3, 1), but column 4 stands above it.
  const e = read(["##.#######", "##..######", "#...######"]);
  expect(e.trench).toBe(true);
  expect(e.damaged).toBe(true);
});

it("counts completed well-only rows as progress toward a corrective Quad", () => {
  const rows = Array.from({ length: 4 }, () => "##.#######");
  expect(read(rows).residueRows).toBe(4);
  expect(read(rows).cost).toBeLessThan(read(rows.slice(0, 3)).cost);
});

it("takes a ready double with the held T before anything else", () => {
  const ready = positions.find((p) => p.name === "ready-double")!;
  const result = lst(
    position(
      ready.rows,
      ready.active as Tetromino,
      ready.hold as Tetromino,
      ready.visibleQueue,
      ready.tsds,
    ),
  );
  const first = result.lines[0].moves[0];
  expect(first).toMatchObject({ useHold: true, spin: "full", cleared: 2 });
  expect(first.piece.type).toBe("T");
});

it.each(positions)(
  "offers a line on captured position $name",
  ({ rows, active, hold, canHold, visibleQueue, tsds }) => {
    const result = lst({
      ...position(
        rows,
        active as Tetromino,
        hold as Tetromino | null,
        visibleQueue,
        tsds,
      ),
      canHold,
    });
    expect(result.complete).toBe(true);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines[0].moves.length).toBeGreaterThanOrEqual(6);
  },
);

it("still recommends a move when a T has no slot to spin into", () => {
  const rows = ["##.#######", "##.#######"];
  const result = lst(position(rows, "T", "T", "", 6));
  expect(result.lines.length).toBeGreaterThan(0);
  expect(result.lines[0].moves[0].piece.type).toBe("T");
});

it("keeps recommending after a misdrop during the preset opener", () => {
  const game = new LSTGame(3);
  // I dropped one column off the flat-top diagram.
  game.keyDown("right");
  game.keyUp("right");
  game.keyDown("hardDrop");
  game.keyUp("hardDrop");
  const result = lst(solverSnapshot(game.state));
  expect(result.lines.length).toBeGreaterThan(0);
});

it("builds the left rail from L and S when a clean alternative exists", () => {
  // Flat rail and flat right side: only L opens the next slot.
  const rows = ["##.#######", "##.#######"];
  const result = lst(position(rows, "O", null, "LJZIS", 6));
  for (const move of result.lines[0].moves) {
    const onRail = move.piece.type !== "T" && cellsOnRail(move);
    if (onRail) expect(["L", "S"]).toContain(move.piece.type);
  }
});
function cellsOnRail(move: { before: Board; after: Board; cleared: number }) {
  if (move.cleared) return false;
  return move.after.some(
    (row, y) =>
      (row[0] !== null && move.before[y][0] === null) ||
      (row[1] !== null && move.before[y][1] === null),
  );
}

function follow(seed: number, pieces: number) {
  const game = new LSTGame(seed);
  let unanswered = 0;
  for (let placed = 0; placed < pieces && game.state.active; placed++) {
    const line = lst(solverSnapshot(game.state)).lines[0];
    if (!line) {
      unanswered++;
      break;
    }
    const move = line.moves[0];
    if (move.useHold) {
      game.keyDown("hold");
      game.keyUp("hold");
    }
    move.path.forEach((input, i) => {
      game.settings.das = input.startsWith("wall") ? 0 : 110;
      const action: Action =
        i === move.path.length - 1
          ? "hardDrop"
          : input === "drop"
            ? "softDrop"
            : input === "wallLeft"
              ? "left"
              : input === "wallRight"
                ? "right"
                : (input as Action);
      game.keyDown(action);
      game.keyUp(action);
    });
    // The exact input path must reproduce the planned board.
    expect(game.state.board).toEqual(move.after);
  }
  return { game, unanswered };
}

// Seeds on which the previous solver ran out of recommendations within 21
// placements. Following the first suggestion through real game inputs must
// keep producing full doubles.
it.each([4, 6])(
  "sustains LST through 70 placements on seed %i",
  (seed) => {
    const { game, unanswered } = follow(seed, 70);
    expect(unanswered).toBe(0);
    expect(game.state.status).toBe("playing");
    expect(game.state.pieces).toBe(70);
    expect(game.state.fullTSpinDoubles).toBeGreaterThanOrEqual(8);
    const height = game.state.board.findIndex((row) =>
      row.every((cell) => cell === null),
    );
    expect(height).toBeLessThan(16);
  },
  60000,
);

it("knows when a T-spin double is ready in the well", () => {
  const rows = (r: readonly string[]) => toRows(field(r));
  // Roofed from the boundary: a full double is available right now.
  expect(tsdReady(rows(["##.#######", "#...######", "#..##....."]))).toBe(
    true,
  );
  // Same slot without a roof: the T would clear two lines, but not as a spin.
  expect(tsdReady(rows(["##.#######", "#...######"]))).toBe(false);
  expect(tsdReady(rows(["##........", "#........."]))).toBe(false);
});

it("flags lines that end with a held T and no double ready", () => {
  // Lines that never play the held T end with it still in hold; they are
  // flagged exactly when no double is ready for it at the end.
  const p = position(["##........", "#........."], "O", "T", "IJLSZ");
  const lines = lst(p).lines;
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    const kept = !line.moves.some((m) => m.piece.type === "T");
    const end = toRows(line.moves.at(-1)!.after);
    expect(line.heldTStuck).toBe(kept && !tsdReady(end));
  }
});
