import { describe, expect, it } from "vitest";
import type { DrillDef } from "../src/core/drill";
import { DrillSession } from "../src/core/drillSession";
import {
  emptyProgress,
  importProgress,
  loadProgress,
  MAX_PER_DRILL,
  PROGRESS_KEY,
  recordSession,
  saveProgress,
} from "../src/core/progress";
import type { SessionRecord } from "../src/core/progress";
import { replaySession } from "../src/core/replay";
import {
  MAX_REPLAY_MOVES,
  parseReplay,
  REPLAYS_KEPT,
} from "../src/core/replayFormat";
import { defaultSettings } from "../src/core/settings";
import type { Action } from "../src/core/settings";

const def = (over: Partial<DrillDef> = {}): DrillDef => ({
  id: "replay-test",
  title: "Replay test",
  summary: "t",
  why: "t",
  how: [],
  end: { pieces: 60 },
  primary: "app",
  metrics: ["app"],
  ...over,
});

const press = (s: DrillSession, action: Action) => {
  s.keyDown(action);
  s.keyUp(action);
};

/** A scripted but varied game: shifts, spins and the odd hold. */
function play(d: DrillDef, seed: number, boards: unknown[] = []): DrillSession {
  const s = new DrillSession(d, seed, defaultSettings());
  const grade = s.game.onLock!;
  s.game.onLock = (info) => {
    boards[info.placement.index] = info.before;
    grade(info);
  };
  let n = 0;
  while (s.status === "playing" && n < 80) {
    const k = (n * 7 + seed) % 11;
    if (k % 5 === 0) press(s, "hold");
    for (let i = 0; i < k % 4; i++) press(s, "cw");
    const side: Action = k % 2 ? "left" : "right";
    for (let i = 0; i < k % 5; i++) press(s, side);
    press(s, "hardDrop");
    n++;
  }
  return s;
}

describe("replaySession", () => {
  for (const [name, d] of [
    ["plain", def()],
    ["cheese", def({ options: { cheese: { rows: 6, total: 20, messiness: 0.5 } } })],
  ] as const)
    it(`reproduces the original boards exactly (${name})`, () => {
      const live: unknown[] = [];
      const s = play(d, 12345, live);
      const record = s.record("a", 1);
      expect(s.game.log.length).toBeGreaterThan(10);
      expect(record.replay?.moves.length).toBe(s.game.log.length);
      const replay = replaySession(record, d)!;
      expect(replay).not.toBeNull();
      expect(replay.boards).toEqual(live);
      expect(replay.reviews).toEqual(s.reviews);
      expect(
        replay.placements.map((p) => [p.type, p.landing, p.cleared, p.spin, p.held]),
      ).toEqual(
        s.game.log.map((p) => [p.type, p.landing, p.cleared, p.spin, p.held]),
      );
    });

  it("includes held placements and snapshots of the queue", () => {
    const d = def();
    const record = play(d, 99).record("b", 1);
    expect(record.replay!.moves.some((m) => (m[4] & 1) === 1)).toBe(true);
    const replay = replaySession(record, d)!;
    expect(replay.steps[0].next).toHaveLength(4);
    expect(replay.steps[0].hold).toBeNull();
  });

  it("rejects an unreachable pose", () => {
    const d = def();
    const record = play(d, 5).record("c", 1);
    const moves = record.replay!.moves.map((m) => [...m]) as NonNullable<typeof record.replay>["moves"];
    moves[3][1] = 40;
    expect(replaySession({ ...record, replay: { ...record.replay!, moves } }, d)).toBeNull();
  });

  const withMove = (
    record: SessionRecord,
    i: number,
    move: NonNullable<SessionRecord["replay"]>["moves"][number],
  ) => {
    const moves = [...record.replay!.moves];
    moves[i] = move;
    return { ...record, replay: { ...record.replay!, moves } };
  };

  it("recomputes spins instead of trusting the flag", () => {
    const d = def();
    const record = play(d, 5).record("e", 1);
    // An O can never spin, and no flat landing on an empty board is a spin.
    const first = record.replay!.moves[0];
    const forged = withMove(record, 0, [first[0], first[1], first[2], first[3], 4]);
    expect(replaySession(forged, d)).toBeNull();
    const mini = withMove(record, 0, [first[0], first[1], first[2], first[3], 2]);
    expect(replaySession(mini, d)).toBeNull();
    expect(replaySession(record, d)).not.toBeNull();
  });

  it("rejects out-of-board poses that alias an in-board footprint", () => {
    const d = def();
    const record = play(d, 5).record("f", 1);
    const [type, x, y, rotation, flags] = record.replay!.moves[0];
    // Shifting x by +WIDTH and y by -1 keeps x + y * WIDTH unchanged.
    const moved = withMove(record, 0, [type, x + 10, y - 1, rotation, flags]);
    expect(() => replaySession(moved, d)).not.toThrow();
    expect(replaySession(moved, d)).toBeNull();
  });

  it("rejects held moves in a no-hold drill", () => {
    const d = def({ noHold: true });
    const held = def();
    const record = play(held, 99).record("g", 1);
    expect(replaySession(record, held)).not.toBeNull();
    expect(replaySession(record, d)).toBeNull();
  });

  it("has no replay for opponent drills", () => {
    const d = def({ options: { opponent: { seed: 1, apm: 30 } } });
    expect(play(d, 1).record("d", 1).replay).toBeUndefined();
  });
});

describe("replay storage", () => {
  const withReplay = (id: string, endedAt: number, drillId = "replay-test"): SessionRecord => {
    const r = play(def(), endedAt + 3).record(id, endedAt);
    return { ...r, drillId };
  };

  it("loads old records without a replay", () => {
    const store = new Map<string, string>();
    store.set(
      PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        sessions: [
          { id: "old", drillId: "x", endedAt: 1, durationMs: 1, completed: true, metrics: { pps: 1 } },
        ],
      }),
    );
    const p = loadProgress({ getItem: (k) => store.get(k) ?? null });
    expect(p.sessions).toHaveLength(1);
    expect(p.sessions[0].replay).toBeUndefined();
  });

  it("round-trips a replay through storage", () => {
    const store = new Map<string, string>();
    const p = recordSession(emptyProgress(), withReplay("r1", 1000));
    saveProgress({ setItem: (k, v) => void store.set(k, v) }, p);
    const back = loadProgress({ getItem: (k) => store.get(k) ?? null });
    expect(back.sessions[0].replay).toEqual(p.sessions[0].replay);
    expect(back.sessions[0].replay).toBeDefined();
  });

  it("strips replays beyond the newest 30 but keeps the sessions", () => {
    let p = emptyProgress();
    const total = REPLAYS_KEPT + 5;
    for (let i = 0; i < total; i++)
      p = recordSession(p, withReplay(`s${i}`, 1000 + i));
    expect(p.sessions).toHaveLength(Math.min(total, MAX_PER_DRILL));
    const flags = p.sessions.map((s) => s.replay !== undefined);
    expect(flags.filter(Boolean)).toHaveLength(REPLAYS_KEPT);
    // The newest keep theirs; the oldest lose them.
    expect(flags.slice(-REPLAYS_KEPT).every(Boolean)).toBe(true);
    expect(flags.slice(0, -REPLAYS_KEPT).some(Boolean)).toBe(false);
    // Imports are capped the same way.
    const bulk = JSON.stringify({
      version: 1,
      sessions: Array.from({ length: total }, (_, i) => withReplay(`i${i}`, 5000 + i)),
    });
    const imported = importProgress(bulk)!;
    expect(imported.sessions.filter((s) => s.replay)).toHaveLength(REPLAYS_KEPT);
  });

  it("counts replay-less sessions in the retention window", () => {
    const plain = (id: string, endedAt: number): SessionRecord => {
      const rest = withReplay(id, endedAt);
      delete rest.replay;
      return rest;
    };
    let p = emptyProgress();
    p = recordSession(p, withReplay("old", 1));
    for (let i = 0; i < REPLAYS_KEPT; i++) p = recordSession(p, plain(`n${i}`, 10 + i));
    expect(p.sessions.find((s) => s.id === "old")?.replay).toBeUndefined();
    expect(p.sessions.find((s) => s.id === "old")).toBeDefined();
  });

  it("keeps a session whose replay is invalid, minus the replay", () => {
    const good = withReplay("g", 10);
    const bad = { ...good, replay: { seed: 1, moves: [["T", 1, 1, 9, 0]] } };
    const p = importProgress(JSON.stringify({ version: 1, sessions: [bad] }))!;
    expect(p.sessions).toHaveLength(1);
    expect(p.sessions[0].replay).toBeUndefined();
  });

  it("validates replay arrays strictly", () => {
    const ok = [["T", 3, 0, 0, 0]];
    expect(parseReplay({ seed: 1, moves: ok })).not.toBeNull();
    const bad: unknown[] = [
      null,
      { seed: -1, moves: ok },
      { seed: 1.5, moves: ok },
      { seed: 1, moves: [] },
      { seed: 1, moves: [["Q", 3, 0, 0, 0]] },
      { seed: 1, moves: [["T", 3, 0, 4, 0]] },
      { seed: 1, moves: [["T", 3.5, 0, 0, 0]] },
      { seed: 1, moves: [["T", 3, 0, 0, 6]] },
      { seed: 1, moves: [["T", 3, 0, 0]] },
      { seed: 1, moves: [["T", "3", 0, 0, 0]] },
      { seed: 1, moves: Array(MAX_REPLAY_MOVES + 1).fill(ok[0]) },
    ];
    for (const b of bad) expect(parseReplay(b)).toBeNull();
  });
});
