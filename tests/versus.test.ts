import { describe, expect, it } from "vitest";
import { cells, emptyBoard } from "../src/core/board";
import type { Board } from "../src/core/board";
import { STAGES } from "../src/core/curriculum";
import type { DrillDef } from "../src/core/drill";
import { DrillSession } from "../src/core/drillSession";
import { Game } from "../src/core/game";
import { garbageMultiplierAt, defaultOptions } from "../src/core/incoming";
import type { GameOptions } from "../src/core/incoming";
import { Opponent, TOP_OUT_HEIGHT } from "../src/core/opponent";
import { importProgress, exportProgress, recordSession, emptyProgress } from "../src/core/progress";
import { defaultSettings } from "../src/core/settings";
import {
  B2B_WARNING_GAP,
  b2bGap,
  b2bWarning,
  spikeWindow,
} from "../src/core/versus";

function field(rows: string[]): Board {
  const board = emptyBoard();
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      board[y][x] = cell === "#" ? "X" : null;
    }),
  );
  return board;
}
/** A vertical I over a 4-high well: the first quad sends 5 (4 plus B2B). */
function quad(options: Partial<GameOptions> = {}) {
  const g = new Game(12345, defaultSettings(), options);
  g.state.board = field([...Array(4).fill("#########."), "#........."]);
  const column = (x: number) =>
    cells({ type: "I", x, y: 20, rotation: 1 }).every(([cx]) => cx === 9);
  const x = Array.from({ length: 14 }, (_, i) => i - 3).find(column)!;
  g.state.active = { type: "I", x, y: 20, rotation: 1 };
  return g;
}
const drop = (g: Game) => {
  g.keyDown("hardDrop");
  g.keyUp("hardDrop");
};

describe("opener phase", () => {
  it("cancels 2 pending lines per attack line while behind", () => {
    const g = quad({ openerPhase: 14 });
    g.receive(8, 0);
    drop(g);
    expect(g.pendingLines).toBe(0);
    // 8 cancelled costs 4 of the 5 attack lines; 1 is sent.
    expect(g.state.stats).toMatchObject({ attack: 5, cancelled: 8, sent: 1 });

    const normal = quad();
    normal.receive(8, 0);
    drop(normal);
    expect(normal.pendingLines).toBe(3);
    expect(normal.state.stats).toMatchObject({ cancelled: 5, sent: 0 });
  });

  it("is normal when the attack covers the queue, and after the phase", () => {
    const covered = quad({ openerPhase: 14 });
    covered.receive(4, 0);
    drop(covered);
    expect(covered.state.stats).toMatchObject({ cancelled: 4, sent: 1 });

    const late = quad({ openerPhase: 14 });
    late.state.pieces = 14;
    late.receive(8, 0);
    drop(late);
    expect(late.pendingLines).toBe(3);
  });
});

describe("garbage multiplier ramp", () => {
  const ramp = {
    garbageMultiplier: 1,
    garbageIncrease: 0.5,
    garbageMarginMs: 1000,
  };
  it("is flat until the margin, then adds garbageIncrease per second", () => {
    const o = { ...defaultOptions(), ...ramp };
    expect(garbageMultiplierAt(o, 1000)).toBe(1);
    expect(garbageMultiplierAt(o, 3000)).toBe(2);
  });
  it("scales outgoing attack with a floor after the margin", () => {
    const early = quad(ramp);
    drop(early);
    expect(early.state.stats.sent).toBe(5);
    const late = quad(ramp);
    late.tick(3000);
    drop(late);
    expect(late.state.stats).toMatchObject({ attack: 5, sent: 10 });
    const odd = quad({ ...ramp, garbageIncrease: 0.1 });
    odd.tick(2000);
    drop(odd);
    expect(odd.state.stats.sent).toBe(5); // floor(5 * 1.1)
  });
  it("scales opponent attacks too", () => {
    const plain = new Game(1, defaultSettings(), {
      opponent: { seed: 4, apm: 120 },
    });
    const ramped = new Game(1, defaultSettings(), {
      opponent: { seed: 4, apm: 120 },
      garbageIncrease: 1,
      garbageMarginMs: 0,
    });
    plain.tick(6000);
    ramped.tick(6000);
    expect(ramped.pendingLines).toBeGreaterThan(plain.pendingLines);
  });
});

describe("reactive opponent", () => {
  it("is deterministic per seed", () => {
    const run = (seed: number) => {
      const o = new Opponent(seed, { apm: 60, surge: true });
      const out: number[] = [];
      for (let i = 0; i < 3000; i++) {
        if (i % 200 === 0) o.receive(3);
        out.push(...o.advance(16));
      }
      return { out, state: o.state };
    };
    expect(run(2)).toEqual(run(2));
    expect(run(2)).not.toEqual(run(3));
  });

  it("builds a B2B chain and breaks it with a Surge", () => {
    const o = new Opponent(5, { apm: 60, surge: true });
    let best = 0;
    const sizes: number[] = [];
    for (let i = 0; i < 6000; i++) {
      sizes.push(...o.advance(100));
      best = Math.max(best, o.state.b2b);
    }
    expect(best).toBeGreaterThanOrEqual(4);
    expect(Math.max(...sizes)).toBeGreaterThan(4);
  });

  it("restores exactly on undo and receives what the player sent", () => {
    const g = quad({ opponent: { seed: 9, apm: 0 } });
    const before = structuredClone(g.state.opponent);
    drop(g);
    expect(g.state.opponent!.pending).toBe(5);
    g.tick(2000);
    expect(g.state.opponent!.dirt).toBe(5);
    g.undo();
    expect(g.state.opponent).toEqual(before);
    // The restored opponent still drives the game.
    g.tick(1000);
    expect(g.state.opponent!.stack).toBeGreaterThan(before!.stack);
  });

  it("tops out at the height limit", () => {
    const o = new Opponent(1, { apm: 0 });
    o.receive(40);
    o.advance(10000);
    expect(o.state.height).toBeGreaterThanOrEqual(TOP_OUT_HEIGHT);
    expect(o.state.alive).toBe(false);
    expect(o.advance(1000)).toEqual([]);
  });

  it("cancels its own pending garbage before sending", () => {
    const o = new Opponent(1, { apm: 60 });
    o.receive(1000);
    o.state.landIn = 1e9;
    expect(o.advance(30000)).toEqual([]);
    expect(o.state.pending).toBeLessThan(1000);
  });
});

describe("versus helpers", () => {
  const opp = (b2b: number, height = 5) => {
    const o = new Opponent(1, { apm: 0 }).state;
    o.b2b = b2b;
    o.height = height;
    return o;
  };
  it("measures the B2B gap and warns at 8 behind", () => {
    expect(b2bGap(2, opp(6))).toBe(4);
    expect(b2bGap(-1, opp(-1))).toBe(0);
    expect(b2bWarning(0, opp(B2B_WARNING_GAP - 1))).toBe(false);
    expect(b2bWarning(0, opp(B2B_WARNING_GAP))).toBe(true);
    expect(b2bWarning(5, opp(12))).toBe(false);
    expect(b2bWarning(4, opp(12))).toBe(true);
  });
  it("opens the spike window at height 12", () => {
    expect(spikeWindow(opp(0, 11))).toBe(false);
    expect(spikeWindow(opp(0, 12))).toBe(true);
  });
});

describe("opponentKO drills", () => {
  const def = (over: Partial<DrillDef> = {}): DrillDef => ({
    id: "t",
    title: "t",
    summary: "t",
    why: "t",
    how: [],
    options: { opponent: { seed: 1, apm: 0 } },
    end: { opponentKO: true },
    primary: "win",
    metrics: ["win"],
    ...over,
  });
  it("completes with a win when the opponent tops out", () => {
    const s = new DrillSession(def(), 7, defaultSettings());
    const o = s.game.state.opponent!;
    o.pending = 60;
    o.landIn = 0;
    s.tick(20000);
    expect(s.status).toBe("complete");
    expect(s.endReason).toBe("opponentKO");
    expect(s.metrics()).toMatchObject({ win: 1, score: 1 });
  });
  it("records a loss when you top out first", () => {
    const s = new DrillSession(def(), 7, defaultSettings());
    for (let i = 0; i < 60 && s.status === "playing"; i++) {
      s.keyDown("hardDrop");
      s.keyUp("hardDrop");
    }
    expect(s.status).toBe("failed");
    expect(s.metrics()).toMatchObject({ win: 0, score: 0 });
  });
  it("queues startIncoming on start and restart, and counts cancelled", () => {
    const s = new DrillSession(
      def({
        options: {},
        end: { pieces: 5 },
        primary: "cancelled",
        startIncoming: [{ lines: 6, delayMs: 4000 }],
      }),
      7,
      defaultSettings(),
    );
    expect(s.game.pendingLines).toBe(6);
    s.game.receive(2, 0);
    s.restart();
    expect(s.game.pendingLines).toBe(6);
    expect(s.metrics().cancelled).toBe(0);
  });
  it("stores win and cancelled in progress", () => {
    const s = new DrillSession(def(), 7, defaultSettings());
    s.game.state.opponent!.alive = false;
    s.tick(100);
    const progress = recordSession(emptyProgress(), s.record("a", 1));
    expect(importProgress(exportProgress(progress))?.sessions).toHaveLength(1);
    const bad = JSON.parse(exportProgress(progress));
    bad.sessions[0].metrics.win = 2;
    expect(importProgress(JSON.stringify(bad))?.sessions ?? []).toHaveLength(0);
  });
  it("ships both drills in the pressure stage", () => {
    const ids = STAGES.find((x) => x.id === "pressure")!.drills.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["versus-bot", "cancel-or-send"]));
  });
});
