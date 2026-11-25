import { describe, expect, it } from "vitest";
import { emptyBoard, spawn, TYPES } from "../src/core/board";
import type { Board, Tetromino } from "../src/core/board";
import { Game } from "../src/core/game";
import { nextRandom } from "../src/core/rng";
import { defaultSettings } from "../src/core/settings";
import { findPlacements, findSpins, pathToInputs } from "../src/core/spins";
import type { PathStep } from "../src/core/spins";

// Engine-verified fixtures from docs/ROADMAP.md (top-down rows).
const FIXTURES = [
  ["...X......", "XXX...XXXX", "XXXX.XXXXX"],
  ["....X.....", "..........", "XXXX.XXXXX", "XXXX..XXXX", "XXXX.XXXXX"],
  [
    "X.........",
    "...XXXXXXX",
    "X...XXXXXX",
    "XX.XXXXXXX",
    "X.XXXXXXXX",
    "X..XXXXXXX",
    "X.XXXXXXXX",
  ],
  ["XX..X.....", "XX...XXXXX", "XXX.XXXXXX", "X...XXXXXX", "XX.XXXXXXX"],
  ["XXX.......", "XX...XXXXX", "XXX.XXXXXX", "XX...XXXXX", "XXX.XXXXXX"],
  [
    "..X.......",
    "....XXXXXX",
    "XX...XXXXX",
    "XXX.XXXXXX",
    "XX.XXXXXXX",
    "XX..XXXXXX",
    "XX.XXXXXXX",
  ],
].map((fixture) => ({ fixture }));
const STRUCTURES = FIXTURES;
function boardFromRows(rows: string[]): Board {
  const b = emptyBoard();
  rows.forEach((r, i) =>
    [...r].forEach((c, x) => {
      if (c !== ".") b[rows.length - 1 - i][x] = "X";
    }),
  );
  return b;
}
const boardOf = (s: { fixture: string[] }) => boardFromRows(s.fixture);

/** A seeded 10-row board of columns with random heights and a few holes. */
function messy(seed: number, rows = 10): Board {
  const rng = { rng: seed };
  const board = emptyBoard();
  for (let x = 0; x < 10; x++) {
    const h = 3 + Math.floor(nextRandom(rng) * (rows - 3));
    for (let y = 0; y < h; y++) if (nextRandom(rng) > 0.25) board[y][x] = "X";
  }
  return board;
}

function play(
  board: Board,
  type: Tetromino,
  path: PathStep[],
  instantSoftDrop = false,
): Game {
  const settings = { ...defaultSettings(), instantSoftDrop };
  const g = new Game(1, settings);
  g.state.board = board.map((row) => [...row]);
  g.state.active = spawn(type);
  const { inputs } = pathToInputs(board, type, path, settings);
  for (const action of [...inputs, "hardDrop" as const]) {
    g.keyDown(action);
    g.keyUp(action);
  }
  return g;
}

const BOARDS: Board[] = [
  ...STRUCTURES.map(boardOf),
  ...Array.from({ length: 12 }, (_, i) => messy(100 + i)),
];

describe("findSpins", () => {
  it("agrees with the real Game for every spin it finds", () => {
    let checked = 0;
    for (const board of BOARDS)
      for (const type of TYPES)
        for (const s of findSpins(board, type, { includeZero: true })) {
          const g = play(board, type, s.path);
          expect(g.state.lastEvent?.label).toBe(s.label);
          expect(g.state.lastEvent?.spin).toBe(s.spin);
          expect(g.state.lastClear).toBe(s.lines);
          expect(g.state.board).toEqual(s.after);
          checked++;
        }
    expect(checked).toBeGreaterThan(100);
  });

  it("leaves out zero-line spins unless asked", () => {
    for (const board of BOARDS)
      for (const type of TYPES) {
        const all = findSpins(board, type, { includeZero: true });
        const some = findSpins(board, type);
        expect(some.every((s) => s.lines > 0)).toBe(true);
        expect(some).toEqual(all.filter((s) => s.lines > 0));
      }
  });

  it("never lists a spin the Game would not score (and O never spins)", () => {
    expect(
      findSpins(boardOf(STRUCTURES[0]), "O", { includeZero: true }),
    ).toEqual([]);
    // Pieces that rest after a plain drop are not spins.
    for (const type of TYPES) expect(findSpins(emptyBoard(), type)).toEqual([]);
  });

  it("finds the TSD and labels it like the engine", () => {
    const spins = findSpins(boardOf(STRUCTURES[0]), "T");
    expect(spins.map((s) => s.label)).toContain("T-spin Double");
  });

  it("upgrades a kick-index-4 mini to a full spin like the Game", () => {
    // The TST fixture is reached by the fifth kick test.
    const tst = findSpins(boardFromRows(STRUCTURES[1].fixture), "T");
    expect(tst.some((s) => s.spin === "full" && s.lines === 3)).toBe(true);
  });

  it("returns no duplicates", () => {
    for (const board of BOARDS) {
      const spins = findSpins(board, "T", { includeZero: true });
      const keys = spins.map(
        (s) =>
          `${JSON.stringify(s.after)}|${s.spin}|${s.lines}|${s.piece.x},${s.piece.y},${s.piece.rotation}`,
      );
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("returns nothing on a topped-out board", () => {
    const board = emptyBoard();
    for (let y = 0; y < 40; y++) board[y][4] = "X";
    expect(findSpins(board, "T", { includeZero: true })).toEqual([]);
    expect(findPlacements(board, "T")).toEqual([]);
  });

  it("is fast enough for a T on a messy 10-row board", () => {
    const boards = Array.from({ length: 20 }, (_, i) => messy(500 + i));
    for (const b of boards) findSpins(b, "T"); // warm up
    const runs = 10;
    const t0 = performance.now();
    for (let r = 0; r < runs; r++)
      for (const b of boards) findSpins(b, "T", { includeZero: true });
    const spinMs = (performance.now() - t0) / (runs * boards.length);
    const t1 = performance.now();
    for (let r = 0; r < runs; r++)
      for (const b of boards) findPlacements(b, "T");
    const placeMs = (performance.now() - t1) / (runs * boards.length);
    console.log(
      `findSpins T ${spinMs.toFixed(3)} ms, findPlacements T ${placeMs.toFixed(3)} ms`,
    );
    expect(spinMs).toBeLessThan(3);
  });
});

describe("path contract", () => {
  const moves = () =>
    BOARDS.slice(0, 10).flatMap((board) =>
      TYPES.flatMap((type) => [
        ...findSpins(board, type, { includeZero: true }).map((m) => ({
          board,
          type,
          m,
        })),
        ...findPlacements(board, type).map((m) => ({ board, type, m })),
      ]),
    );

  it("uses down1 for single-row drops and never a softDrop step", () => {
    const all = moves().flatMap(({ m }) => m.path as string[]);
    expect(all).toContain("down1");
    expect(all).not.toContain("softDrop");
  });

  it("replays exactly with stepwise soft drop", () => {
    for (const { board, type, m } of moves()) {
      const settings = { instantSoftDrop: false };
      expect(pathToInputs(board, type, m.path, settings).exact).toBe(true);
      expect(play(board, type, m.path, false).state.board).toEqual(m.after);
    }
  });

  it("replays with the default instant soft drop whenever it says exact", () => {
    let exact = 0;
    let inexact = 0;
    for (const { board, type, m } of moves()) {
      const r = pathToInputs(board, type, m.path, defaultSettings());
      if (!r.exact) {
        inexact++;
        continue;
      }
      exact++;
      expect(play(board, type, m.path, true).state.board).toEqual(m.after);
    }
    expect(defaultSettings().instantSoftDrop).toBe(true);
    expect(exact).toBeGreaterThan(100);
    // Mid-air drops under instant soft drop are flagged, not silently wrong.
    expect(inexact).toBeGreaterThan(0);
  });

  it("collapses a drop to rest into one press under instant soft drop", () => {
    const tsd = findSpins(boardOf(STRUCTURES[0]), "T").find(
      (s) => s.lines === 2,
    )!;
    const r = pathToInputs(
      boardOf(STRUCTURES[0]),
      "T",
      tsd.path,
      defaultSettings(),
    );
    expect(r.exact).toBe(true);
    const downs = tsd.path.filter((a) => a === "down1").length;
    const presses = r.inputs.filter((a) => a === "softDrop").length;
    expect(downs).toBeGreaterThan(1);
    expect(presses).toBeLessThan(downs);
    expect(
      play(boardOf(STRUCTURES[0]), "T", tsd.path, true).state.lastClear,
    ).toBe(2);
  });
});

describe("findPlacements", () => {
  it("counts the landings on an empty board", () => {
    const count = (type: Tetromino) =>
      findPlacements(emptyBoard(), type).length;
    expect(count("T")).toBe(34);
    expect(count("L")).toBe(34);
    expect(count("J")).toBe(34);
    expect(count("S")).toBe(17);
    expect(count("Z")).toBe(17);
    expect(count("O")).toBe(9);
    expect(count("I")).toBe(17);
  });

  it("reaches each landing with its key path in the real Game", () => {
    for (const board of BOARDS.slice(0, 10))
      for (const type of TYPES)
        for (const p of findPlacements(board, type)) {
          const g = play(board, type, p.path);
          expect(g.state.board).toEqual(p.after);
          expect(g.state.lastClear).toBe(p.lines);
        }
  });

  it("includes every spin landing", () => {
    for (const board of BOARDS) {
      const cells = (p: { piece: { x: number } } & { after: Board }) =>
        JSON.stringify(p.after);
      const placed = new Set(findPlacements(board, "T").map(cells));
      for (const s of findSpins(board, "T", { includeZero: true }))
        expect(placed.has(JSON.stringify(s.after))).toBe(true);
    }
  });
});
