import { expect, it } from "vitest";
import { emptyBoard, spawn, lock, type Board } from "../src/core/board";
import { chooseWell, evaluateBoard } from "../src/core/solver/evaluation";
import { analyze, type SolverPosition } from "../src/core/solver/search";
import { placementKey, transition } from "../src/core/solver/placements";
const position = (): SolverPosition => ({
  board: emptyBoard(),
  active: spawn("T"),
  hold: null,
  canHold: true,
  visibleQueue: ["I", "O", "L", "S", "J"],
});
it("prefers jagged usable stacks over holes or covered wells, and mirrors evaluation", () => {
  const jagged = emptyBoard();
  for (let x = 0; x < 9; x++)
    for (let y = 0; y < (x % 3) + 1; y++) jagged[y][x] = "X";
  const hole = emptyBoard();
  hole[1][4] = "X";
  const covered = emptyBoard();
  covered[0][9] = "X";
  expect(evaluateBoard(jagged, "right").cost).toBeLessThan(
    evaluateBoard(hole, "right").cost,
  );
  expect(evaluateBoard(jagged, "right").cost).toBeLessThan(
    evaluateBoard(covered, "right").cost,
  );
  expect(evaluateBoard(jagged, "right")).toEqual(
    evaluateBoard(
      jagged.map((r) => [...r].reverse()),
      "left",
    ),
  );
});
it("defaults right, detects a left well and does not oscillate on ambiguous boards", () => {
  expect(chooseWell(emptyBoard())).toBe("right");
  const b = emptyBoard();
  for (let x = 1; x < 10; x++) for (let y = 0; y < 4; y++) b[y][x] = "X";
  expect(chooseWell(b)).toBe("left");
  expect(chooseWell(emptyBoard(), "left")).toBe("left");
});
it("returns three distinct first placements with replayable known-piece continuations", () => {
  const p = position(),
    saved = structuredClone(p);
  const result = analyze(p, "right", { now: () => 0, maxDepth: 3 });
  expect(result.lines).toHaveLength(3);
  expect(
    new Set(result.lines.map((l) => placementKey(l.moves[0].piece))).size,
  ).toBe(3);
  expect(result.depth).toBe(3);
  for (const line of result.lines) {
    let active = p.active!,
      hold = p.hold,
      index = 0,
      board = p.board;
    for (const m of line.moves) {
      expect(m.before).toEqual(board);
      if (m.useHold) {
        const old = active.type;
        active = spawn(hold ?? p.visibleQueue[index++]);
        hold = old;
      }
      for (const a of m.path) active = transition(board, active, a);
      expect(active).toEqual(m.piece);
      const placed = lock(board, active);
      expect(placed.board).toEqual(m.after);
      expect(placed.cleared).toBe(m.cleared);
      board = placed.board;
      active = spawn(p.visibleQueue[index++]);
    }
  }
  expect(p).toEqual(saved);
});
it("ignores hidden queue entries and never uses hold twice before a lock", () => {
  const p = { ...position(), canHold: false, visibleQueue: [] };
  const result = analyze(p, "left", { now: () => 0 });
  expect(result.lines[0].moves).toHaveLength(1);
  expect(result.lines.every((l) => !l.moves[0].useHold)).toBe(true);
  const a = position(),
    b = { ...a, visibleQueue: [...a.visibleQueue, "Z" as const] };
  expect(analyze(a, "right", { now: () => 0, maxDepth: 2 }).lines).toEqual(
    analyze(b, "right", { now: () => 0, maxDepth: 2 }).lines,
  );
});
it("prefers the available Quad and does not recommend a known blocked next spawn", () => {
  const b = emptyBoard();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 9; x++) b[y][x] = "X";
  const p = { ...position(), board: b, active: spawn("I"), canHold: false };
  const result = analyze(p, "right", { now: () => 0, maxDepth: 1 });
  expect(result.lines[0].moves[0].cleared).toBe(4);
  const blocked: Board = emptyBoard();
  blocked[21][4] = "X";
  expect(
    analyze({ ...p, board: blocked }, "right", { now: () => 0 }).lines,
  ).toEqual([]);
});
it("respects a deadline and reports the depth actually searched", () => {
  let t = 0;
  const result = analyze(position(), "right", { now: () => t++, budgetMs: 10 });
  expect(result.timedOut).toBe(true);
  expect(t).toBeLessThan(40);
  expect(result.lines.every((l) => l.moves.length <= 6)).toBe(true);
});

it("uses spin-accessible repairs without a spin bonus, but leaves sealed holes penalized", () => {
  const b = emptyBoard();
  ["###..#####", "####..####"].forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "#") b[y][x] = "X";
    }),
  );
  const result = analyze(
    {
      ...position(),
      board: b,
      active: spawn("S"),
      canHold: false,
      visibleQueue: [],
    },
    "right",
    { now: () => 0 },
  );
  expect(result.lines[0].moves[0].cleared).toBe(2);
  expect(result.lines[0].metrics.holes).toBe(0);
  expect(
    result.lines[0].moves[0].path.some(
      (a) => a === "cw" || a === "ccw" || a === "flip",
    ),
  ).toBe(true);
  expect(result.lines[0].effort).toBeGreaterThan(1);
  const sealed = emptyBoard();
  sealed[1][3] = "X";
  expect(evaluateBoard(sealed, "right").holes).toBe(1);
  expect(evaluateBoard(sealed, "right").cost).toBeGreaterThan(2000);
});

function surface(profile: number[]): Board {
  const board = emptyBoard();
  profile.forEach((height, x) => {
    for (let y = 0; y < height; y++) board[y][x] = "X";
  });
  return board;
}
it("prefers flattening the screenshot's right shoulder with T before later queue placements", () => {
  const board = surface([6, 7, 6, 6, 6, 6, 6, 5, 4, 0]);
  const result = analyze(
    {
      board,
      active: spawn("T"),
      hold: "I",
      canHold: true,
      visibleQueue: ["J", "S", "I", "J", "L"],
    },
    "right",
    { now: () => 0 },
  );
  const first = result.lines[0].moves.find((m) => m.piece.type === "T")!;
  expect(first.piece.type).toBe("T");
  expect(first.piece.x).toBe(8);
  const immediate = analyze(
    { board, active: spawn("T"), hold: null, canHold: false, visibleQueue: [] },
    "right",
    { now: () => 0 },
  );
  expect(immediate.lines[0].moves[0].piece.x).toBe(8);
});
it("penalizes narrow dependencies, mirrors edge notches, and exempts the intended well", () => {
  const flat = surface([4, 4, 4, 4, 4, 4, 4, 4, 4, 0]);
  const jNotch = surface([2, 4, 4, 4, 4, 4, 4, 4, 4, 0]);
  const iNotch = surface([1, 4, 4, 4, 4, 4, 4, 4, 4, 0]);
  expect(evaluateBoard(flat, "right").dependencies).toBe(0);
  expect(evaluateBoard(jNotch, "right").dependencies).toBeGreaterThan(0);
  expect(evaluateBoard(iNotch, "right").dependencies).toBeGreaterThan(
    evaluateBoard(jNotch, "right").dependencies,
  );
  expect(evaluateBoard(jNotch, "right")).toEqual(
    evaluateBoard(
      jNotch.map((row) => [...row].reverse()),
      "left",
    ),
  );
});
