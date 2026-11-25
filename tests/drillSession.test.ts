import { describe, expect, it } from "vitest";
import { emptyBoard, project, spawn, WIDTH, cells } from "../src/core/board";
import type { Board, Tetromino } from "../src/core/board";
import { Game } from "../src/core/game";
import type { DrillDef } from "../src/core/drill";
import { DrillSession } from "../src/core/drillSession";
import type { Violation } from "../src/core/drillSession";
import type { PlacementReview } from "../src/core/coach";
import { hasGarbage } from "../src/core/garbage";
import {
  emptyProgress,
  exportProgress,
  importProgress,
  recordSession,
} from "../src/core/progress";
import { defaultSettings } from "../src/core/settings";
import type { Action } from "../src/core/settings";
import { findTSpin } from "./support/search";

const def = (over: Partial<DrillDef> = {}): DrillDef => ({
  id: "t",
  title: "t",
  summary: "t",
  why: "t",
  how: [],
  end: { pieces: 100 },
  primary: "app",
  metrics: ["app"],
  ...over,
});
const make = (over: Partial<DrillDef> = {}, seed = 7) =>
  new DrillSession(def(over), seed, defaultSettings());
const press = (s: DrillSession, action: Action) => {
  s.keyDown(action);
  s.keyUp(action);
};
/** Drop a piece of `type` straight down from its spawn position. */
const drop = (s: DrillSession, type: Tetromino, ms = 0) => {
  s.game.state.active = spawn(type);
  if (ms) s.tick(ms);
  press(s, "hardDrop");
};
/** Fill `rows` of the board except where `type` would land from spawn. */
function almostFull(s: DrillSession, type: Tetromino, rows: number[]) {
  const board = s.game.state.board;
  const landing = project(board, spawn(type));
  const gap = new Set(cells(landing).map(([x, y]) => y * WIDTH + x));
  for (const y of rows)
    for (let x = 0; x < WIDTH; x++)
      if (!gap.has(y * WIDTH + x)) board[y][x] = "X";
}
const garbageRows = (board: Board) => board.filter(hasGarbage).length;
const review = (penalty: number, band: PlacementReview["band"]) =>
  ({ flags: [], penalty, band }) as unknown as PlacementReview;

describe("cheese option", () => {
  const options = { cheese: { rows: 5, total: 7, messiness: 0.5 } };
  const fillHole = (g: Game) => {
    const row = g.state.board[0];
    row[row.indexOf(null)] = "X";
  };
  const lockO = (g: Game) => {
    g.state.active = spawn("O");
    g.keyDown("hardDrop");
    g.keyUp("hardDrop");
  };
  const clearBottomRow = (g: Game) => {
    fillHole(g);
    lockO(g);
  };

  it("fills at restart, refills after clears, and stops at the total", () => {
    const g = new Game(3, defaultSettings(), options);
    expect(garbageRows(g.state.board)).toBe(5);
    expect(g.state.cheese?.dealt).toBe(5);
    clearBottomRow(g);
    expect(garbageRows(g.state.board)).toBe(5);
    expect(g.state.cheese?.dealt).toBe(6);
    clearBottomRow(g);
    clearBottomRow(g);
    expect(g.state.cheese?.dealt).toBe(7);
    expect(garbageRows(g.state.board)).toBe(4);
  });

  it("restores holes and the rng exactly on undo and rewindTo", () => {
    const g = new Game(3, defaultSettings(), options);
    const snap = () => structuredClone([g.state.board, g.state.cheese]);
    fillHole(g);
    const start = snap();
    lockO(g);
    const afterOne = snap();
    fillHole(g);
    const beforeTwo = snap();
    lockO(g);
    const afterTwo = snap();
    expect(afterTwo).not.toEqual(afterOne);
    g.undo();
    expect(snap()).toEqual(beforeTwo);
    lockO(g);
    expect(snap()).toEqual(afterTwo);
    g.rewindTo(0);
    expect(snap()).toEqual(start);
    lockO(g);
    expect(snap()).toEqual(afterOne);
  });

  it("is off by default", () => {
    const g = new Game(3);
    expect(g.state.cheese).toBeNull();
    expect(garbageRows(g.state.board)).toBe(0);
  });
});

describe("hold and quad rules", () => {
  it("noHold blocks hold and records a violation", () => {
    const s = make({ noHold: true });
    const active = s.game.state.active;
    press(s, "hold");
    expect(s.game.state.active).toBe(active);
    expect(s.game.state.hold).toBeNull();
    expect(s.violations).toEqual([
      expect.objectContaining({ index: 0, kind: "hold" }),
    ]);
  });

  it("quadsOnly flags a double but not a quad", () => {
    const s = make({ quadsOnly: true });
    almostFull(s, "O", [0, 1]);
    drop(s, "O");
    expect(s.game.log[0].cleared).toBe(2);
    expect(s.violations).toEqual([
      expect.objectContaining({ index: 0, kind: "non-quad" }),
    ]);
    const q = make({ quadsOnly: true });
    const board = q.game.state.board;
    for (const y of [0, 1, 2, 3]) for (let x = 1; x < WIDTH; x++) board[y][x] = "X";
    q.game.state.active = { ...spawn("I"), rotation: 1, x: -1, y: 20 };
    press(q, "hardDrop");
    expect(q.game.log[0].cleared).toBe(4);
    expect(q.violations).toEqual([]);
  });

  it("quadsOnly flags a T-spin double", () => {
    const board = emptyBoard();
    for (let x = 0; x < WIDTH; x++) {
      if (x !== 4) board[0][x] = "X";
      if (x < 3 || x > 5) board[1][x] = "X";
    }
    for (let x = 0; x < 4; x++) board[2][x] = "X";
    const path = findTSpin(
      board,
      (g) => g.state.lastEvent?.spin === "full" && g.state.lastClear === 2,
    );
    expect(path).not.toBeNull();
    const s = make({ quadsOnly: true });
    s.game.state.board = board;
    s.game.state.active = spawn("T");
    for (const a of path!) press(s, a);
    press(s, "hardDrop");
    expect(s.game.log[0].spin).toBe("full");
    expect(s.violations).toEqual([
      expect.objectContaining({ index: 0, kind: "non-quad" }),
    ]);
  });

  it("fails after the allowed violations", () => {
    const s = make({ noHold: true, failOn: { violations: 2 } });
    press(s, "hold");
    expect(s.status).toBe("playing");
    press(s, "hold");
    expect(s.status).toBe("failed");
    expect(s.endReason).toBe("violations");
    press(s, "hardDrop");
    expect(s.game.state.pieces).toBe(0);
  });
});

describe("ending", () => {
  it("ends by pieces", () => {
    const s = make({ end: { pieces: 2 } });
    drop(s, "O");
    expect(s.status).toBe("playing");
    drop(s, "I");
    expect([s.status, s.endReason]).toEqual(["complete", "pieces"]);
  });
  it("ends by lines", () => {
    const s = make({ end: { lines: 2 } });
    almostFull(s, "O", [0, 1]);
    drop(s, "O");
    expect([s.status, s.endReason]).toEqual(["complete", "lines"]);
  });
  it("ends by time and measures the limit", () => {
    const s = make({ end: { timeMs: 1000 } });
    s.tick(900);
    expect(s.status).toBe("playing");
    s.tick(300);
    expect([s.status, s.endReason]).toEqual(["complete", "time"]);
    expect(s.metrics().timeMs).toBe(1000);
  });
  it("ends once all cheese is dealt and cleared", () => {
    const s = make({
      end: { garbage: true },
      options: { cheese: { rows: 1, total: 2, messiness: 0 } },
    });
    for (let i = 0; i < 2; i++) {
      expect(s.status).toBe("playing");
      const row = s.game.state.board[0];
      row[row.indexOf(null)] = "X";
      drop(s, "O");
    }
    expect([s.status, s.endReason]).toEqual(["complete", "garbage"]);
    expect(s.metrics().piecesPerGarbage).toBe(1);
    expect(s.metrics().garbageShare).toBe(1);
  });
  it("fails on top out, or just ends when topOut is ignored", () => {
    for (const topOut of [true, false]) {
      const s = make({ failOn: { topOut } });
      for (let i = 0; i < 40 && s.status === "playing"; i++) drop(s, "O");
      expect(s.game.state.status).toBe("over");
      expect(s.endReason).toBe("topOut");
      expect(s.status).toBe(topOut ? "failed" : "complete");
    }
  });
});

describe("final lock that tops out", () => {
  it("fails instead of completing when garbage tops out on the goal piece", () => {
    const s = make({ end: { pieces: 1 } });
    // Nearly full stack: the lock clears nothing and incoming garbage
    // pushes cells off the board.
    const board = s.game.state.board;
    for (let y = 0; y < 39; y++) board[y][WIDTH - 1] = "X";
    s.game.receive(4, 0);
    s.game.state.active = spawn("O");
    press(s, "hardDrop");
    expect(s.game.state.status).toBe("over");
    expect(s.status).toBe("failed");
    expect(s.endReason).toBe("topOut");
  });
  it("fails when the next spawn is blocked on the goal piece", () => {
    const s = make({ end: { pieces: 1 } });
    const board = s.game.state.board;
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < WIDTH; x++) board[y][x] = x === 0 ? null : "X";
    s.game.state.active = spawn("O");
    press(s, "hardDrop");
    expect(s.game.state.status).toBe("over");
    expect(s.status).toBe("failed");
  });
});

describe("metrics", () => {
  it("computes rates from a scripted sequence", () => {
    const s = make();
    drop(s, "O", 500);
    drop(s, "I", 500);
    drop(s, "O", 500);
    const m = s.metrics();
    expect(m).toMatchObject({
      pieces: 3,
      lines: 0,
      timeMs: 1500,
      pps: 2,
      app: 0,
      apm: 0,
      kpp: 1,
      finesse: 1,
      attack: 0,
      maxB2b: 0,
      holesPer100: (4 * 100) / 3,
      tsdRate: 0,
    });
    expect(m.garbageShare).toBeUndefined();
    expect(m.piecesPerGarbage).toBeUndefined();
  });

  it("counts T-spin doubles per bag and uses the primary as score", () => {
    const board = emptyBoard();
    for (let x = 0; x < WIDTH; x++) {
      if (x !== 4) board[0][x] = "X";
      if (x < 3 || x > 5) board[1][x] = "X";
    }
    for (let x = 0; x < 4; x++) board[2][x] = "X";
    const path = findTSpin(
      board,
      (g) => g.state.lastEvent?.spin === "full" && g.state.lastClear === 2,
    );
    expect(path).not.toBeNull();
    const s = make({ primary: "tsdRate" });
    s.game.state.board = board;
    s.game.state.active = spawn("T");
    for (const a of path!) press(s, a);
    press(s, "hardDrop");
    const m = s.metrics();
    expect(m.tsdRate).toBe(7);
    expect(m.score).toBe(7);
    expect(m.attack).toBe(s.game.log[0].attack);
    expect(m.attack).toBeGreaterThan(0);
  });
});

describe("undo and retry alignment", () => {
  const played = () => {
    const s = make({ noHold: true });
    for (const type of ["O", "I", "O", "I"] as const) {
      press(s, "hold");
      drop(s, type, 100);
    }
    return s;
  };

  it("keeps reviews and violations aligned with the log", () => {
    const s = played();
    expect(s.reviews).toHaveLength(4);
    expect(s.violations.map((v) => v.index)).toEqual([0, 1, 2, 3]);
    s.undo();
    expect(s.game.log).toHaveLength(3);
    expect(s.reviews).toHaveLength(3);
    expect(s.violations.map((v) => v.index)).toEqual([0, 1, 2]);
    s.retryFrom(1);
    expect(s.game.log).toHaveLength(1);
    expect(s.reviews).toHaveLength(1);
    expect(s.violations.map((v) => v.index)).toEqual([0]);
    s.retryFrom(5);
    expect(s.reviews).toHaveLength(1);
  });

  it("returns to playing, with the clock rewound", () => {
    const s = make({ end: { pieces: 2 } });
    drop(s, "O", 400);
    drop(s, "O", 400);
    expect(s.status).toBe("complete");
    s.retryFrom(1);
    expect(s.status).toBe("playing");
    expect(s.endReason).toBeNull();
    expect(s.elapsedMs).toBe(400);
    drop(s, "I", 100);
    expect(s.status).toBe("complete");
    expect(s.metrics().timeMs).toBe(500);
  });

  it("can retry after topping out", () => {
    const s = make();
    for (let i = 0; i < 40 && s.status === "playing"; i++) drop(s, "O");
    expect(s.status).toBe("failed");
    s.retryFrom(0);
    expect(s.status).toBe("playing");
    expect(s.game.state.status).toBe("playing");
  });
});

describe("keyMoments", () => {
  it("ranks by penalty then index, adds violations and keeps spacing", () => {
    const s = make();
    s.reviews = [
      review(0, "best"),
      review(6, "blunder"),
      review(3, "mistake"),
      ...Array.from({ length: 3 }, () => review(0, "good")),
      review(4, "mistake"),
      ...Array.from({ length: 2 }, () => review(0, "good")),
      review(4, "mistake"),
      ...Array.from({ length: 2 }, () => review(0, "good")),
      review(1, "inaccuracy"),
    ];
    s.violations = [{ index: 20, kind: "hold", reason: "Used hold" } as Violation];
    expect(s.keyMoments().map((m) => m.index)).toEqual([1, 20, 6, 12]);
    expect(s.keyMoments(2).map((m) => m.index)).toEqual([1, 20]);
    expect(s.keyMoments()[1]).toMatchObject({ band: "blunder", label: "Used hold" });
  });
  it("merges a violation into the same placement", () => {
    const s = make();
    s.reviews = [review(3, "mistake")];
    s.violations = [{ index: 0, kind: "hold", reason: "Used hold" }];
    expect(s.keyMoments()).toHaveLength(1);
    expect(s.keyMoments()[0].band).toBe("blunder");
  });
  it("reports real hole mistakes from play", () => {
    const s = make();
    drop(s, "O");
    drop(s, "I");
    const [moment] = s.keyMoments();
    expect(moment).toMatchObject({ index: 1 });
    expect(moment.flags).toContainEqual({ kind: "hole", count: 4 });
  });
});

describe("record", () => {
  it("produces a session that progress accepts and round-trips", () => {
    const s = make({ end: { pieces: 2 } });
    drop(s, "O", 500);
    drop(s, "O", 500);
    const record = s.record("a1", 1000);
    expect(record).toMatchObject({
      id: "a1",
      drillId: "t",
      endedAt: 1000,
      durationMs: 1000,
      completed: true,
    });
    const progress = recordSession(emptyProgress(), record);
    expect(progress.sessions).toEqual([record]);
    expect(importProgress(exportProgress(progress))).toEqual(progress);
  });
  it("marks failed sessions as not completed", () => {
    const s = make();
    for (let i = 0; i < 40 && s.status === "playing"; i++) drop(s, "O");
    expect(s.record("a2", 5).completed).toBe(false);
  });
});

describe("pressure options", () => {
  it("seeds the opponent from the session seed", () => {
    const options = { opponent: { seed: 1, apm: 60 }, gravity: 0.02 };
    const run = (seed: number) => {
      const s = make({ options }, seed);
      s.tick(20000);
      return s.game.state.opponent;
    };
    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
  });
  it("shows the pace against targetPps", () => {
    const s = make({ targetPps: 2 });
    expect(s.pace).toBe(0);
    s.tick(1000);
    expect(s.pace).toBe(-2);
    expect(make().pace).toBeNull();
  });
});

describe("terminal events inside one tick", () => {
  const softDropping = (over: Partial<DrillDef>) => {
    const s = make({ options: { gravity: 1 }, ...over });
    s.keyDown("softDrop");
    return s;
  };
  it("stops at the piece limit instead of recording extra locks", () => {
    const s = softDropping({ end: { pieces: 1 } });
    s.tick(5000);
    expect(s.game.state.pieces).toBe(1);
    expect([s.status, s.endReason]).toEqual(["complete", "pieces"]);
  });
  it("completes at the time limit before a later top-out", () => {
    const s = make({
      options: { gravity: 20, lockDelayMs: 0 },
      end: { timeMs: 50 },
    });
    s.tick(5000);
    expect([s.status, s.endReason]).toEqual(["complete", "time"]);
    expect(s.game.state.status).toBe("playing");
    expect(s.elapsedMs).toBeCloseTo(50);
  });
  it("does not accumulate rewound time over repeated undos", () => {
    const s = make();
    drop(s, "O", 100);
    drop(s, "I", 100);
    s.undo();
    drop(s, "I", 100);
    s.undo();
    drop(s, "I", 100);
    expect(s.game.state.pieces).toBe(2);
    expect(s.elapsedMs).toBe(200);
    expect(s.metrics().timeMs).toBe(200);
  });
  it("counts a quad-only run with a double as a violation metric", () => {
    const s = make({ quadsOnly: true });
    almostFull(s, "O", [0, 1]);
    drop(s, "O");
    expect(s.metrics().violations).toBe(1);
  });
  it("ignores hold while paused in a no-hold drill", () => {
    const s = make({ noHold: true });
    s.game.pause();
    press(s, "hold");
    expect(s.violations).toEqual([]);
  });
});
