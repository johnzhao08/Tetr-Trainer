import { describe, expect, it } from "vitest";
import {
  cells,
  emptyBoard,
  HEIGHT,
  project,
  spawn,
  WIDTH,
} from "../src/core/board";
import type { Board } from "../src/core/board";
import { Game } from "../src/core/game";
import type { GameOptions } from "../src/core/incoming";
import { Opponent } from "../src/core/opponent";
import { paceDelta } from "../src/core/stats";
import { defaultSettings } from "../src/core/settings";
import type { Action } from "../src/core/settings";

function make(options: Partial<GameOptions> = {}) {
  return new Game(12345, defaultSettings(), options);
}
function tap(g: Game, action: Action) {
  g.keyDown(action);
  g.keyUp(action);
}
function field(rows: string[]): Board {
  const board = emptyBoard();
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      board[y][x] = cell === "#" ? "X" : null;
    }),
  );
  return board;
}
/** Park an O on the floor so only the lock timer decides what happens. */
function grounded(options: Partial<GameOptions>) {
  const g = make({ gravity: 1, ...options });
  g.state.active = project(g.state.board, spawn("O"));
  return g;
}
const garbageRows = (board: Board) =>
  board.filter((row) => row.filter((c) => c === "X").length === WIDTH - 1);
const holes = (board: Board) =>
  garbageRows(board).map((row) => row.indexOf(null));

describe("gravity and lock delay", () => {
  it("is off by default", () => {
    const g = make();
    const start = g.state.active;
    g.tick(10000);
    expect(g.state.active).toEqual(start);
    expect(g.state.pieces).toBe(0);
  });

  it("moves a piece down over time", () => {
    const g = make({ gravity: 0.02 });
    const y = g.state.active!.y;
    g.tick(1000);
    expect(g.state.active!.y).toBe(y - 1);
    g.tick(1000);
    expect(g.state.active!.y).toBe(y - 2);
  });

  it("speeds up after the margin", () => {
    const g = make({
      gravity: 0,
      gravityIncrease: 0.02,
      gravityMarginMs: 1000,
    });
    const y = g.state.active!.y;
    g.tick(1000);
    expect(g.state.active!.y).toBe(y);
    g.tick(3000);
    expect(g.state.active!.y).toBe(y - 5);
  });

  it("locks a grounded piece once the lock delay passes", () => {
    const g = grounded({});
    g.tick(400);
    expect(g.state.pieces).toBe(0);
    g.tick(150);
    expect(g.state.pieces).toBe(1);
    expect(g.state.active).not.toBeNull();
  });

  it("extends the delay with resets, then locks at the limit", () => {
    const g = grounded({ lockResets: 2 });
    g.tick(300);
    tap(g, "left");
    g.tick(300);
    tap(g, "left");
    g.tick(300);
    tap(g, "left"); // third move: no reset left
    g.tick(150);
    expect(g.state.pieces).toBe(0);
    g.tick(100);
    expect(g.state.pieces).toBe(1);
  });

  it("does not count a hard drop key for an auto-lock", () => {
    const g = grounded({});
    tap(g, "left");
    g.tick(1000);
    expect(g.state.pieces).toBe(1);
    expect(g.state.stats.keys).toBe(1);
    expect(g.log[0].keys).toBe(1);
    const h = make();
    tap(h, "hardDrop");
    expect(h.state.stats.keys).toBe(1);
  });

  const tSlot = () => field(["...#.#....", "..........", "...#......"]);
  const spinStart = (g: Game) => {
    g.state.board = tSlot();
    g.state.active = { type: "T", x: 4, y: 1, rotation: 0 };
  };

  it("scores a spin rotated into place and locked automatically", () => {
    const g = make({ gravity: 0.02 });
    spinStart(g);
    tap(g, "cw");
    g.tick(700);
    expect(g.state.pieces).toBe(1);
    expect(g.state.lastEvent?.label).toBe("T-spin Mini");
  });

  it("does not score a spin when gravity moved the piece after the rotation", () => {
    const g = make({ gravity: 0.02 });
    spinStart(g);
    tap(g, "cw");
    const landed = g.state.active!;
    // Same pose, rotated three rows higher, then let gravity bring it down.
    g.state.board = tSlot();
    g.state.active = { type: "T", x: landed.x, y: landed.y + 3, rotation: 0 };
    tap(g, "cw");
    expect(g.state.active!.y).toBe(landed.y + 3);
    g.tick(5000);
    expect(g.state.pieces).toBe(1);
    expect(g.state.lastEvent).toBeNull();
  });
});

describe("incoming garbage", () => {
  it("waits for readyAt, then inserts on the next non-clearing lock", () => {
    const g = make();
    g.receive(2);
    expect(g.pendingLines).toBe(2);
    expect(g.state.incoming).toEqual([{ lines: 2, readyAt: 333 }]);
    tap(g, "hardDrop");
    expect(garbageRows(g.state.board)).toHaveLength(0);
    expect(g.pendingLines).toBe(2);
    g.tick(400);
    tap(g, "hardDrop");
    expect(garbageRows(g.state.board)).toHaveLength(2);
    expect(g.pendingLines).toBe(0);
  });

  it("caps insertion per lock and keeps the rest queued", () => {
    const g = make();
    g.receive(10, 0);
    tap(g, "hardDrop");
    expect(garbageRows(g.state.board)).toHaveLength(8);
    expect(g.pendingLines).toBe(2);
    tap(g, "hardDrop");
    expect(garbageRows(g.state.board)).toHaveLength(10);
    expect(g.pendingLines).toBe(0);
    // A split entry keeps one hole column.
    expect(new Set(holes(g.state.board)).size).toBe(1);
  });

  const quad = (options: Partial<GameOptions> = {}) => {
    const g = make(options);
    g.state.board = field([...Array(4).fill("#########."), "#........."]);
    const column = (x: number) =>
      cells({ type: "I", x, y: 20, rotation: 1 }).every(([cx]) => cx === 9);
    const x = Array.from({ length: 14 }, (_, i) => i - 3).find(column)!;
    g.state.active = { type: "I", x, y: 20, rotation: 1 };
    return g;
  };

  it("cancels queued lines oldest first and reports sent and cancelled", () => {
    const g = quad();
    g.receive(3, 0);
    g.receive(3, 0);
    tap(g, "hardDrop");
    expect(g.state.lastClear).toBe(4);
    expect(g.state.incoming.map((e) => e.lines)).toEqual([1]);
    expect(g.state.stats).toMatchObject({ attack: 5, cancelled: 5, sent: 0 });
    // Clearing locks never insert garbage.
    expect(garbageRows(g.state.board)).toHaveLength(0);

    const h = quad();
    h.receive(1, 0);
    tap(h, "hardDrop");
    expect(h.pendingLines).toBe(0);
    expect(h.state.stats).toMatchObject({ attack: 5, cancelled: 1, sent: 4 });
  });

  const dropMany = (messiness: number) => {
    const g = make({ garbageMessiness: messiness });
    for (let i = 0; i < 6; i++) {
      g.receive(1, 0);
      tap(g, "hardDrop");
    }
    return holes(g.state.board);
  };

  it("keeps the hole column at messiness 0 and always changes it at 1", () => {
    const steady = dropMany(0);
    expect(steady).toHaveLength(6);
    expect(new Set(steady).size).toBe(1);
    const messy = dropMany(1);
    expect(messy).toHaveLength(6);
    for (let i = 1; i < messy.length; i++)
      expect(messy[i]).not.toBe(messy[i - 1]);
  });

  it("tops out when garbage pushes a block past the top row", () => {
    const g = make();
    g.state.board[HEIGHT - 1][0] = "X";
    g.receive(1, 0);
    tap(g, "hardDrop");
    expect(g.state.status).toBe("over");
    expect(g.state.active).toBeNull();
  });

  it("restores the queue and garbage rng on undo, so redo matches", () => {
    const g = make({ garbageMessiness: 1 });
    tap(g, "hardDrop");
    g.receive(2, 0);
    g.receive(3, 0);
    const before = structuredClone({
      incoming: g.state.incoming,
      garbage: g.state.garbage,
    });
    tap(g, "hardDrop");
    const board = structuredClone(g.state.board);
    const holesAfter = holes(g.state.board);
    expect(g.state.incoming).toEqual([]);
    g.undo();
    expect({ incoming: g.state.incoming, garbage: g.state.garbage }).toEqual(
      before,
    );
    tap(g, "hardDrop");
    expect(g.state.board).toEqual(board);
    expect(holes(g.state.board)).toEqual(holesAfter);
  });

  it("freezes while paused or over", () => {
    const g = make({ gravity: 1, opponent: { seed: 1, apm: 600 } });
    g.pause();
    const snap = structuredClone(g.state);
    g.tick(5000);
    expect(g.state).toEqual(snap);
    expect(g.elapsedMs).toBe(0);
  });
});

describe("opponent", () => {
  const total = (o: Opponent, ms: number) => {
    let sum = 0;
    for (let t = 0; t < ms; t += 16)
      sum += o.advance(16).reduce((a, b) => a + b, 0);
    return sum;
  };

  it("matches its apm over a minute, within 15%", () => {
    for (const apm of [30, 60, 120]) {
      const lines = total(new Opponent(7, { apm, burst: [5, 6, 7, 8] }), 60000);
      expect(Math.abs(lines - apm) / apm).toBeLessThan(0.15);
    }
  });

  it("is deterministic per seed and varies between seeds", () => {
    const run = (seed: number) => {
      const o = new Opponent(seed, { apm: 90, burst: [5, 8] });
      return Array.from({ length: 600 }, () => o.advance(100)).flat();
    };
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
    expect(Math.max(...run(3))).toBeGreaterThanOrEqual(5);
    expect(
      Math.max(...new Opponent(3, { apm: 90 }).advance(600000)),
    ).toBeLessThanOrEqual(4);
  });

  it("feeds a game and restores its state on undo", () => {
    const g = make({ opponent: { seed: 5, apm: 120 } });
    g.tick(10000);
    expect(g.pendingLines).toBeGreaterThan(0);
    const opponent = structuredClone(g.state.opponent);
    const incoming = structuredClone(g.state.incoming);
    tap(g, "hardDrop");
    g.tick(5000);
    expect(g.state.opponent).not.toEqual(opponent);
    g.undo();
    expect(g.state.opponent).toEqual(opponent);
    expect(g.state.incoming).toEqual(incoming);
  });
});

describe("pace", () => {
  it("counts pieces ahead of or behind the target", () => {
    expect(paceDelta(10, 4000, 2)).toBe(2);
    expect(paceDelta(3, 4000, 2)).toBe(-5);
    expect(paceDelta(0, 0, 2)).toBe(0);
  });
});
