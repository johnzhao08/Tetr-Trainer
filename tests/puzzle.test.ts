import { describe, expect, it } from "vitest";
import { TYPES } from "../src/core/board";
import type { Tetromino } from "../src/core/board";
import { puzzleController } from "../src/core/controller";
import { PuzzleSession } from "../src/core/puzzle";
import type { Goal, PuzzleDef } from "../src/core/puzzle";
import { PUZZLES } from "../src/core/puzzles";
import {
  boardFromRows,
  mirrorPosition,
  rowsToCells,
  validatePosition,
} from "../src/core/position";
import type { Position } from "../src/core/position";
import { emptyProgress, recordSession } from "../src/core/progress";
import { defaultSettings } from "../src/core/settings";
import type { Action } from "../src/core/settings";
import { solvePuzzle } from "./support/puzzleSearch";

const TSD_ROWS = ["...X......", "XXX...XXXX", "XXXX.XXXXX"];
const TSD_KEYS: Action[] = ["cw", "softDrop", "cw"];
const STSD = PUZZLES.find((p) => p.id === "stsd")!;
const TD = PUZZLES.find((p) => p.id === "triple-double")!;

function def(goal: Goal, position: Position, extra: Partial<PuzzleDef> = {}): PuzzleDef {
  return {
    id: "t", title: "Test", themes: [], prompt: "", explanation: "",
    position, goal, pieceLimit: 2, ...extra,
  };
}
const start = (d: PuzzleDef) => new PuzzleSession(d, 1, defaultSettings());
function play(s: PuzzleSession, keys: Action[]) {
  for (const key of [...keys, "hardDrop" as const]) {
    s.keyDown(key);
    s.keyUp(key);
  }
}
const drop = (s: PuzzleSession, n = 1) => {
  for (let i = 0; i < n; i++) play(s, []);
};
const tsdPos = (queue: Tetromino[] = ["T", "T"]): Position => ({ rows: TSD_ROWS, queue });
// Solve the first step of a chain puzzle with the keys the search finds.
const solveKeys = (d: PuzzleDef) => solvePuzzle(d)!;

describe("position", () => {
  it("boardFromRows puts the last row at y = 0", () => {
    const board = boardFromRows(TSD_ROWS);
    expect(board[0].filter(Boolean)).toHaveLength(9);
    expect(board[2][3]).toBe("X");
    expect(rowsToCells(["X."])).toEqual([{ x: 0, y: 0, char: "X" }]);
  });
  it("mirrors x, swaps L/J and S/Z, and round-trips", () => {
    const p: Position = { rows: ["JL.......S", "Z........I"], queue: ["L", "S", "T"], hold: "J" };
    const m = mirrorPosition(p);
    expect(m.rows).toEqual(["Z.......JL", "I........S"]);
    expect(m.queue).toEqual(["J", "Z", "T"]);
    expect(m.hold).toBe("L");
    expect(mirrorPosition(m)).toEqual(p);
    for (const puzzle of PUZZLES)
      expect(mirrorPosition(mirrorPosition(puzzle.position))).toEqual(puzzle.position);
  });
  it("validates rows, queue and garbage", () => {
    expect(validatePosition(tsdPos())).toEqual([]);
    expect(validatePosition({ rows: ["XXX"], queue: [] })).toHaveLength(2);
    expect(validatePosition({ rows: ["XXXXXXXXXX"], queue: ["T"] })).toHaveLength(1);
    expect(validatePosition({ rows: ["..........", "...Q......"], queue: ["T"] })).toHaveLength(1);
    expect(validatePosition({ rows: [], queue: ["T"], incoming: [0] })).toHaveLength(1);
    expect(() => start(def({ kind: "tspin", lines: 2 }, { rows: ["x"], queue: ["T"] }))).toThrow();
  });
});

describe("goals", () => {
  const tspin2: Goal = { kind: "tspin", lines: 2 };
  it("tspin solves on a full T-spin double and fails on a plain drop", () => {
    const s = start(def(tspin2, tsdPos()));
    play(s, TSD_KEYS);
    expect(s.status).toBe("solved");
    expect(s.explainResult()).toBe("T-spin Double: Test complete.");
    const f = start(def(tspin2, tsdPos()));
    drop(f, 2);
    expect(f.status).toBe("failed");
    expect(f.failReason).toBe("pieceLimit");
  });
  it("tspin needs the exact line count", () => {
    const s = start(def({ kind: "tspin", lines: 3 }, tsdPos(), { pieceLimit: 1 }));
    play(s, TSD_KEYS);
    expect(s.status).toBe("failed");
  });
  it("spinClear checks piece and mini", () => {
    const run = (goal: Goal) => {
      const s = start(def(goal, tsdPos(["T"]), { pieceLimit: 1 }));
      play(s, TSD_KEYS);
      return s.status;
    };
    expect(run({ kind: "spinClear", piece: "T", lines: 2 })).toBe("solved");
    expect(run({ kind: "spinClear", lines: 2, mini: false })).toBe("solved");
    expect(run({ kind: "spinClear", lines: 2, mini: true })).toBe("failed");
    expect(run({ kind: "spinClear", piece: "I", lines: 2 })).toBe("failed");
  });
  it("clear matches any placement of the line count, spin or not", () => {
    const position: Position = { rows: ["XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX."], queue: ["I"] };
    const keys = solveKeys(def({ kind: "clear", lines: 4 }, position, { pieceLimit: 1 }))![0];
    const run = (goal: Goal) => {
      const s = start(def(goal, position, { pieceLimit: 1 }));
      play(s, keys);
      return s.status;
    };
    expect(run({ kind: "clear", lines: 4 })).toBe("solved");
    expect(run({ kind: "clear", piece: "I", lines: 4 })).toBe("solved");
    expect(run({ kind: "clear", piece: "T", lines: 4 })).toBe("failed");
    expect(run({ kind: "clear", lines: 3 })).toBe("failed");
  });
  it("dig counts garbage rows cleared", () => {
    const position: Position = { rows: ["XXXXXXXXX.", "XXXXXXXXX."], queue: ["I"] };
    const ok = def({ kind: "dig", lines: 2 }, position, { pieceLimit: 1 });
    const keys = solveKeys(ok);
    const s = start(ok);
    play(s, keys[0]);
    expect(s.status).toBe("solved");
    const hard = def({ kind: "dig", lines: 3 }, position, { pieceLimit: 1 });
    const f = start(hard);
    play(f, keys[0]);
    expect(f.status).toBe("failed");
  });
  it("keepB2b is judged when the piece limit is reached", () => {
    const position: Position = { rows: [], queue: ["O"], b2b: 3 };
    const solved = start(def({ kind: "keepB2b", min: 3 }, position, { pieceLimit: 1 }));
    expect(solved.status).toBe("playing");
    drop(solved);
    expect(solved.status).toBe("solved");
    const failed = start(def({ kind: "keepB2b", min: 4 }, position, { pieceLimit: 1 }));
    drop(failed);
    expect(failed.status).toBe("failed");
  });
  it("buildSlot needs a reachable TSD slot at the end", () => {
    const goal: Goal = { kind: "buildSlot", slot: "tsd" };
    const keep = start(def(goal, tsdPos(["O"]), { pieceLimit: 1 }));
    play(keep, ["right", "right", "right", "right"]);
    expect(keep.status).toBe("solved");
    const ruin = start(def(goal, tsdPos(["O"]), { pieceLimit: 1 }));
    drop(ruin);
    expect(ruin.status).toBe("failed");
  });
  it("noFlag fails as soon as a placement earns a listed flag", () => {
    const position: Position = { rows: ["X.XXXXXXXX"], queue: ["O", "O"] };
    const goal: Goal = { kind: "noFlag", kinds: ["hole"] };
    const bad = start(def(goal, position));
    play(bad, ["left", "left", "left", "left"]);
    expect(bad.status).toBe("failed");
    expect(bad.failReason).toBe("flagged");
    const good = start(def(goal, position));
    drop(good, 2);
    expect(good.status).toBe("solved");
  });
  it("chain goals must happen in order", () => {
    const d = (steps: Goal[]) => ({ ...TD, goal: { kind: "chain", steps } as Goal });
    const tsd: Goal = { kind: "tspin", lines: 2 };
    const tst: Goal = { kind: "tspin", lines: 3 };
    const keys = solveKeys(d([tsd, tst]));
    const play2 = (goal: PuzzleDef) => {
      const s = start(goal);
      for (const k of keys) play(s, k);
      return s;
    };
    expect(play2(d([tsd, tst])).status).toBe("solved");
    const reversed = play2(d([tst, tsd]));
    expect(reversed.status).toBe("playing");
    expect(reversed.progress.met).toBe(1);
  });
  it("progress reports the steps met so far", () => {
    const s = start(STSD);
    play(s, solveKeys(STSD)[0]);
    expect(s.status).toBe("playing");
    expect(s.progress.met).toBe(1);
    expect(s.progress.steps).toHaveLength(2);
  });
});

describe("limits", () => {
  it("fails on the time limit", () => {
    const s = start(def({ kind: "tspin", lines: 2 }, tsdPos(), { timeMs: 1000 }));
    s.tick(400);
    expect(s.status).toBe("playing");
    s.tick(5000);
    expect(s.status).toBe("failed");
    expect(s.failReason).toBe("time");
    expect(s.elapsedMs).toBe(1000);
  });
  it("fails when the board is already topped out", () => {
    const rows = Array<string>(24).fill("XXXX.XXXXX");
    const s = start(def({ kind: "tspin", lines: 2 }, { rows, queue: ["T"] }));
    expect(s.status).toBe("failed");
    expect(s.failReason).toBe("topOut");
  });
  it("fails early when the pieces left cannot finish the goal", () => {
    const s = start(
      def({ kind: "tspin", lines: 2 }, tsdPos(["O", "O"]), { allowHold: false }),
    );
    expect(s.status).toBe("failed");
    expect(s.failReason).toBe("impossible");
    expect(s.explainResult()).toContain("no longer be reached");
  });
  it("counts the extra draw an empty hold gives", () => {
    const one = def({ kind: "tspin", lines: 2 }, tsdPos(["O", "T"]), { pieceLimit: 1 });
    expect(start(one).status).toBe("playing");
    const s = start({ ...one, allowHold: false });
    expect(s.failReason).toBe("impossible");
  });
  it("keeps a bag-boundary T possible partway through a bag", () => {
    const tsd: Goal = { kind: "tspin", lines: 2 };
    const goal: Goal = { kind: "chain", steps: [tsd, tsd] };
    // Seeded bags only: no known T needed, the draws just span two bags.
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = new PuzzleSession(
        def(goal, tsdPos(["O"]), { pieceLimit: 9, allowHold: false }),
        seed,
        defaultSettings(),
      );
      for (let n = 0; n < 4; n++) {
        expect(s.failReason).not.toBe("impossible");
        drop(s);
      }
    }
  });
  it("still fails when even one T per bag cannot cover the goal", () => {
    const tsd: Goal = { kind: "tspin", lines: 2 };
    const goal: Goal = { kind: "chain", steps: [tsd, tsd, tsd] };
    const s = start(def(goal, tsdPos(["O"]), { pieceLimit: 5, allowHold: false }));
    expect(s.failReason).toBe("impossible");
  });
  it("rejects end-of-run steps that are not last in a goal", () => {
    const bad: Goal = {
      kind: "chain",
      steps: [{ kind: "keepB2b", min: 1 }, { kind: "tspin", lines: 2 }],
    };
    expect(() => start(def(bad, tsdPos()))).toThrow(/last step/);
    const ok: Goal = {
      kind: "chain",
      steps: [{ kind: "tspin", lines: 2 }, { kind: "keepB2b", min: 0 }],
    };
    expect(() => start(def(ok, tsdPos()))).not.toThrow();
  });
  it("continues with seeded bags after the fixed queue", () => {
    const s = start(def({ kind: "tspin", lines: 2 }, tsdPos(["T"])));
    expect(s.game.state.active?.type).toBe("T");
    expect(s.game.state.queue.length).toBeGreaterThanOrEqual(7);
    expect(s.game.state.queue.every((t) => TYPES.includes(t))).toBe(true);
  });
  it("blocks hold when not allowed, and starts with set hold, b2b and garbage", () => {
    const s = start(
      def({ kind: "keepB2b", min: 0 }, { rows: [], queue: ["O"], hold: "I", b2b: 2, incoming: [3] }, { allowHold: false }),
    );
    expect(s.game.state.hold).toBe("I");
    expect(s.game.state.b2b).toBe(2);
    s.keyDown("hold");
    expect(s.game.state.hold).toBe("I");
    expect(s.game.state.active?.type).toBe("O");
    drop(s);
    expect(s.game.state.board.filter((row) => row.includes("X"))).toHaveLength(3);
  });
});

describe("undo and retry", () => {
  it("undo restores board, progress, reviews and time", () => {
    const s = start(STSD);
    const before = structuredClone(s.game.state.board);
    s.tick(500);
    play(s, solveKeys(STSD)[0]);
    expect(s.progress.met).toBe(1);
    expect(s.reviews).toHaveLength(1);
    s.undo();
    expect(s.game.state.board).toEqual(before);
    expect(s.progress.met).toBe(0);
    expect(s.reviews).toHaveLength(0);
    expect(s.game.log).toHaveLength(0);
    expect(s.status).toBe("playing");
    expect(s.canUndo).toBe(false);
  });
  it("undo reopens a failed puzzle but not a solved one", () => {
    const f = start(def({ kind: "tspin", lines: 2 }, tsdPos()));
    drop(f, 2);
    expect(f.status).toBe("failed");
    f.undo();
    expect(f.status).toBe("playing");
    expect(f.game.state.pieces).toBe(1);
    const s = start(def({ kind: "tspin", lines: 2 }, tsdPos()));
    play(s, TSD_KEYS);
    expect(s.status).toBe("solved");
    expect(s.canUndo).toBe(false);
  });
  it("retry starts the same position again and counts attempts", () => {
    const s = start(STSD);
    const board = structuredClone(s.game.state.board);
    drop(s, 3);
    expect(s.status).toBe("failed");
    s.retry();
    expect(s.attempts).toBe(2);
    expect(s.status).toBe("playing");
    expect(s.game.state.board).toEqual(board);
    expect(s.game.log).toHaveLength(0);
    expect(s.elapsedMs).toBe(0);
    play(s, solveKeys(STSD)[0]);
    expect(s.progress.met).toBe(1);
  });
  it("the controller's restart replays the original seed", () => {
    const s = start(STSD);
    const queue = [...s.game.state.queue];
    const c = puzzleController(s);
    drop(s);
    c.restart(987654);
    expect(s.game.state.queue).toEqual(queue);
    expect(s.attempts).toBe(2);
  });
  it("records a progress-valid session", () => {
    const s = start(def({ kind: "tspin", lines: 2 }, tsdPos()));
    play(s, TSD_KEYS);
    const record = s.record("r1", 1000);
    expect(record.drillId).toBe("puzzle:t");
    expect(record.metrics).toMatchObject({ pieces: 1, score: 1 });
    expect(recordSession(emptyProgress(), record).sessions).toHaveLength(1);
  });
});

describe("starter puzzles", () => {
  it("have unique ids and valid positions", () => {
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    for (const p of PUZZLES) expect(validatePosition(p.position)).toEqual([]);
  });
  for (const puzzle of PUZZLES) {
    it(`${puzzle.id} is solvable within ${puzzle.pieceLimit} pieces`, () => {
      const keys = solvePuzzle(puzzle);
      expect(keys).not.toBeNull();
      expect(keys!.length).toBeLessThanOrEqual(puzzle.pieceLimit);
      const s = start(puzzle);
      for (const k of keys!) play(s, k);
      expect(s.status).toBe("solved");
      expect(s.explainResult()).toContain(`${puzzle.title} complete`);
    });
    if (!puzzle.noMirror)
      it(`${puzzle.id} mirrored is solvable too`, () => {
        const mirrored = { ...puzzle, position: mirrorPosition(puzzle.position), guide: undefined };
        expect(solvePuzzle(mirrored)).not.toBeNull();
      });
  }
  it("STSD explains both spins", () => {
    const s = start(STSD);
    for (const k of solveKeys(STSD)) play(s, k);
    expect(s.explainResult()).toBe("T-spin Double, then T-spin Double: STSD complete.");
  });
});
