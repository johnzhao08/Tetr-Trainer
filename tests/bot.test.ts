import { describe, expect, it } from "vitest";
import { emptyBoard } from "../src/core/board";
import { Bot, botPending, boardRows } from "../src/core/bot";
import { calibrateBot, calibrateDrill } from "../src/core/calibrate";
import { STAGES } from "../src/core/curriculum";
import { DrillSession } from "../src/core/drillSession";
import { Game } from "../src/core/game";
import { LEAGUE_PRESSURE } from "../src/core/incoming";
import { emptyProgress, FREEPLAY_ID, recordSession } from "../src/core/progress";
import type { Progress } from "../src/core/progress";
import { defaultSettings } from "../src/core/settings";
import { constraintLines } from "../src/core/drillView";
import { bestBatchMs } from "./support/timing";

const run = (b: Bot, pieces: number) => {
  let maxB2b = -1;
  for (let i = 0; i < pieces && b.state.alive; i++) {
    b.advance(1000 / b.config.pps);
    maxB2b = Math.max(maxB2b, b.state.b2b);
  }
  return maxB2b;
};
const drop = (g: Game) => {
  g.keyDown("hardDrop");
  g.keyUp("hardDrop");
};

describe("bot play", () => {
  it("is deterministic per seed", () => {
    const a = new Bot({ seed: 5, pps: 2, skill: 0.8 });
    const b = new Bot({ seed: 5, pps: 2, skill: 0.8 });
    const c = new Bot({ seed: 6, pps: 2, skill: 0.8 });
    for (const bot of [a, b, c]) run(bot, 40);
    expect(a.state).toEqual(b.state);
    expect(a.state.board).not.toEqual(c.state.board);
  });
  it("places pieces at its target PPS on the game clock", () => {
    const b = new Bot({ seed: 1, pps: 2.5, skill: 0.5 });
    b.advance(399);
    expect(b.state.pieces).toBe(0);
    b.advance(1);
    expect(b.state.pieces).toBe(1);
    // Frame-sized steps place the same number as one big step.
    const frames = new Bot({ seed: 1, pps: 2.5, skill: 0.5 });
    for (let i = 0; i < 600; i++) frames.advance(1000 / 60);
    expect(frames.state.pieces).toBe(25);
  });
  it("clears lines and keeps B2B on a calm game at full skill", () => {
    let app = 0;
    let maxB2b = -1;
    for (const seed of [1, 2, 3, 4]) {
      const b = new Bot({ seed, pps: 2, skill: 1 });
      maxB2b = Math.max(maxB2b, run(b, 100));
      expect(b.state.pieces).toBe(100);
      expect(b.state.alive).toBe(true);
      app += b.state.attack / 100;
    }
    expect(app / 4).toBeGreaterThan(0.2);
    expect(maxB2b).toBeGreaterThanOrEqual(2);
  });
  it("skill raises efficiency", () => {
    const mean = (skill: number) =>
      [1, 2, 3, 4].reduce((sum, seed) => {
        const b = new Bot({ seed, pps: 2, skill });
        run(b, 100);
        return sum + b.state.attack / Math.max(1, b.state.pieces);
      }, 0);
    expect(mean(1)).toBeGreaterThan(mean(0));
  });
  it("cancels incoming garbage with its own attack", () => {
    const b = new Bot({ seed: 1, pps: 1, skill: 1 });
    // A 4-deep well on the right: the vertical I is a quad (4 lines of attack).
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 9; x++) b.state.board[y][x] = "J";
    // A stray block above keeps the quad from being an all clear.
    b.state.board[4][0] = "J";
    b.state.bag = ["I", "O", "O", "O", "O", "O", "O", "O"];
    b.receive(3);
    expect(botPending(b.state)).toBe(3);
    const sent = b.advance(1000);
    expect(b.state.board[0].filter(Boolean)).toHaveLength(1);
    expect(botPending(b.state)).toBe(0);
    expect(sent).toEqual([1]);
  });
  it("digs garbage it receives when it cannot clear", () => {
    const b = new Bot({ seed: 2, pps: 1, skill: 1 });
    b.receive(2);
    b.advance(6000);
    expect(botPending(b.state)).toBe(0);
  });
  it("tops out under heavy garbage", () => {
    const b = new Bot({ seed: 3, pps: 1, skill: 1 });
    for (let i = 0; i < 40 && b.state.alive; i++) {
      b.receive(8);
      b.advance(1000);
    }
    expect(b.state.alive).toBe(false);
    expect(b.advance(5000)).toEqual([]);
  });
  it("decides within the time budget", () => {
    const bot = new Bot({ seed: 9, pps: 2, skill: 1 });
    run(bot, 30);
    const base = structuredClone(bot.state);
    const count = 20;
    const ms =
      bestBatchMs(() => {
        for (let i = 0; i < count; i++) {
          bot.state = structuredClone(base);
          bot.decide();
        }
      }) / count;
    // Includes the clone; typical decisions take about 2 ms.
    expect(ms).toBeLessThan(4);
  });
  it("renders its board as MiniBoard rows", () => {
    const board = emptyBoard();
    board[0][0] = "T";
    const rows = boardRows(board);
    expect(rows).toHaveLength(20);
    expect(rows[19].startsWith("T.")).toBe(true);
  });
});

describe("bot in a game", () => {
  const options = { ...LEAGUE_PRESSURE, bot: { seed: 4, pps: 3, skill: 1 } };
  it("sends garbage to the player", () => {
    const g = new Game(1, defaultSettings(), options);
    g.tick(20000);
    expect(g.state.bot!.attack).toBeGreaterThan(0);
    expect(g.pendingLines).toBeGreaterThan(0);
  });
  it("replays exactly after undo", () => {
    const g = new Game(1, defaultSettings(), { ...options, gravity: 0 });
    g.tick(4000);
    drop(g);
    g.tick(3000);
    const before = structuredClone(g.state.bot);
    drop(g);
    g.tick(5000);
    const after = structuredClone(g.state.bot);
    g.undo();
    expect(g.state.bot).toEqual(before);
    g.tick(5000);
    expect(g.state.bot).toEqual(after);
  });
});

describe("calibrateBot", () => {
  const withGames = (games: { pps: number; app: number }[]): Progress =>
    games.reduce(
      (p, g, i) =>
        recordSession(p, {
          id: `f${i}`,
          drillId: FREEPLAY_ID,
          endedAt: i + 1,
          durationMs: 60000,
          completed: true,
          metrics: g,
        }),
      emptyProgress(),
    );
  it("falls back to 1 PPS and low skill without saves", () => {
    expect(calibrateBot(emptyProgress(), 7)).toEqual({
      seed: 7,
      pps: 1.05,
      skill: 0.1,
    });
  });
  it("plays 5 percent faster than the recent freeplay average", () => {
    const p = withGames([
      { pps: 1.5, app: 0.4 },
      { pps: 2.5, app: 0.4 },
    ]);
    expect(calibrateBot(p).pps).toBeCloseTo(2 * 1.05, 6);
  });
  it("maps APP onto the rank benchmarks, rising with rank", () => {
    const skill = (pps: number, app: number) =>
      calibrateBot(withGames([{ pps, app }])).skill;
    expect(skill(0.71, 0.16)).toBeLessThan(skill(1.27, 0.38));
    expect(skill(1.27, 0.38)).toBeLessThan(skill(2.36, 0.7));
    expect(skill(3.5, 0.95)).toBe(1);
    // Half a rank above the player's own band.
    expect(skill(1.27, 0.38)).toBeCloseTo(3.5 / 8, 6);
  });
  it("clamps absurd speeds", () => {
    expect(calibrateBot(withGames([{ pps: 20, app: 0.5 }])).pps).toBe(4);
  });
});

describe("spar drill", () => {
  const spar = () =>
    STAGES.flatMap((s) => s.drills).find((d) => d.id === "spar")!;
  it("is in the pressure stage and asks for calibration", () => {
    expect(STAGES.find((s) => s.id === "pressure")!.drills).toContain(spar());
    expect(spar().calibrated).toBe(true);
  });
  it("ends in a win when the bot tops out", () => {
    const s = new DrillSession(spar(), 7, defaultSettings());
    expect(s.game.state.bot).not.toBeNull();
    s.game.state.bot!.alive = false;
    s.tick(100);
    expect(s.status).toBe("complete");
    expect(s.endReason).toBe("opponentKO");
    expect(s.metrics()).toMatchObject({ win: 1, score: 1 });
  });
  it("loses when the player tops out first", () => {
    const s = new DrillSession(spar(), 7, defaultSettings());
    for (let i = 0; i < 60 && s.status === "playing"; i++) {
      s.keyDown("hardDrop");
      s.keyUp("hardDrop");
    }
    expect(s.status).toBe("failed");
    expect(s.metrics()).toMatchObject({ win: 0 });
  });
});

describe("bot review fixes", () => {
  // (3,21) is an I spawn cell the O spawn does not use.
  const blockSpawn = (b: Bot) => {
    b.state.board[21][3] = "X";
  };
  it("tops out on a blocked spawn instead of holding out of it", () => {
    const b = new Bot({ seed: 1, pps: 1, skill: 1 });
    blockSpawn(b);
    b.state.bag = ["I", "O", "O", "O", "O", "O", "O", "O"];
    b.advance(1000);
    expect(b.state.alive).toBe(false);
    expect(b.state.pieces).toBe(0);
  });
  it("tops out when the next spawn is blocked, at that placement", () => {
    const b = new Bot({ seed: 1, pps: 1, skill: 0 });
    // Columns 4-5 are the only open drop, filled to row 19 and open above, so
    // the O lands on the spawn cells and the next O cannot spawn.
    for (let y = 0; y < 22; y++)
      for (let x = 1; x < 10; x++)
        b.state.board[y][x] = y < 20 || (x !== 4 && x !== 5) ? "X" : null;
    b.state.bag = ["O", "O", "O", "O", "O", "O", "O", "O"];
    b.advance(1000);
    expect(b.state.pieces).toBe(1);
    expect(b.state.alive).toBe(false);
  });
  it("lands player garbage 333 ms after it was sent, not after the bot frame", () => {
    const b = new Bot({ seed: 1, pps: 3, skill: 1 });
    b.receive(4, 1);
    b.advance(1000 / 3);
    expect(botPending(b.state)).toBe(4);
    b.advance(1000 / 3);
    expect(botPending(b.state)).toBe(0);
  });
  it("cancels double in the opener phase and obeys the cap", () => {
    const setup = (rules: { openerPhase: number; garbageCap: number }) => {
      const b = new Bot(
        { seed: 1, pps: 1, skill: 1 },
        { garbageMessiness: 0.3, ...rules },
      );
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 9; x++) b.state.board[y][x] = "J";
      b.state.board[4][0] = "J";
      b.state.bag = ["I", "O", "O", "O", "O", "O", "O", "O"];
      b.receive(7);
      return b;
    };
    const opener = setup({ openerPhase: 14, garbageCap: 8 });
    expect(opener.advance(1000)).toEqual([]);
    expect(botPending(opener.state)).toBe(0);
    const plain = setup({ openerPhase: 0, garbageCap: 8 });
    plain.advance(1000);
    expect(botPending(plain.state)).toBe(3);
    // A cap of 2 digs at most 2 rows per lock.
    const capped = new Bot(
      { seed: 2, pps: 1, skill: 0 },
      { openerPhase: 0, garbageMessiness: 0, garbageCap: 2 },
    );
    capped.receive(6, -1000);
    capped.advance(1000);
    expect(botPending(capped.state)).toBe(4);
  });
  it("shares the game's rules and picks one rival", () => {
    const g = new Game(1, defaultSettings(), {
      bot: { seed: 4, pps: 3, skill: 1 },
      opponent: { seed: 3, apm: 60 },
      openerPhase: 14,
    });
    expect(g.state.bot).not.toBeNull();
    expect(g.state.opponent).toBeNull();
    g.setOptions({ opponent: { seed: 5, apm: 60 } });
    g.restart(2);
    expect(g.state.opponent).toBeNull();
    g.setOptions({ bot: undefined });
    g.restart(3);
    expect(g.state.bot).toBeNull();
    expect(g.state.opponent).not.toBeNull();
  });
  it("derives the bot seed again on a drill restart", () => {
    const def = STAGES.flatMap((st) => st.drills).find((d) => d.id === "spar")!;
    const bot = calibrateDrill(def, emptyProgress()).options!.bot!;
    const s = new DrillSession({ ...def, options: { ...def.options, bot } }, 7, defaultSettings());
    const first = s.game.state.bot!.garbage.rng;
    s.restart(8);
    expect(s.game.state.bot!.garbage.rng).not.toBe(first);
  });
  it("times a knockout at the game clock, not the last player lock", () => {
    const def = STAGES.flatMap((st) => st.drills).find((d) => d.id === "spar")!;
    const s = new DrillSession(calibrateDrill(def, emptyProgress()), 7, defaultSettings());
    s.keyDown("hardDrop");
    s.keyUp("hardDrop");
    const lockMs = s.lockTimes[0];
    s.tick(500);
    s.game.state.bot!.board[21][4] = "X";
    s.tick(3000);
    expect(s.endReason).toBe("opponentKO");
    expect(s.metrics().timeMs).toBeCloseTo(s.elapsedMs, 6);
    expect(s.elapsedMs).toBeGreaterThan(lockMs + 400);
  });
  it("shows the calibrated bot speed in the intro", () => {
    const def = STAGES.flatMap((st) => st.drills).find((d) => d.id === "spar")!;
    expect(constraintLines(calibrateDrill(def, emptyProgress())).join(" ")).toContain("1.1 PPS");
  });
});
