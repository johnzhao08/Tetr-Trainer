import { afterEach, describe, expect, it, vi } from "vitest";
import { Game } from "../src/core/game";
import type { GameOptions } from "../src/core/incoming";
import { DrillSession } from "../src/core/drillSession";
import { STAGES } from "../src/core/curriculum";
import { constraintLines } from "../src/core/drillView";
import {
  pacePath,
  paceSeries,
  paceSummary,
} from "../src/core/paceChart";
import { defaultSettings } from "../src/core/settings";
import { dueBeats, Metronome } from "../src/ui/metronome";

const make = (options: Partial<GameOptions> = {}) =>
  new Game(99, defaultSettings(), options);
const drop = (g: Game) => {
  g.keyDown("hardDrop");
  g.keyUp("hardDrop");
};

describe("ppsCap", () => {
  it("holds an early hard drop and locks it when the interval has passed", () => {
    const g = make({ ppsCap: 2 }); // 500 ms between locks
    drop(g);
    expect(g.state.pieces).toBe(1);
    g.tick(200);
    drop(g);
    expect(g.state.pieces).toBe(1);
    g.tick(299);
    expect(g.state.pieces).toBe(1);
    g.tick(1);
    expect(g.state.pieces).toBe(2);
    expect(g.log[1].atMs - g.log[0].atMs).toBeCloseTo(500, 6);
    expect(g.log[1].keys).toBe(0);
    expect(g.state.stats.keys).toBe(2);
  });

  it("does not delay a drop made after the interval or the first piece", () => {
    const g = make({ ppsCap: 2 });
    drop(g);
    g.tick(800);
    drop(g);
    expect(g.state.pieces).toBe(2);
  });

  it("keeps every gap at least 1000/cap ms however fast the player drops", () => {
    const g = make({ ppsCap: 1.5 });
    for (let i = 0; i < 30; i++) {
      drop(g);
      g.tick(100);
    }
    g.tick(5000);
    const gaps = g.log.slice(1).map((p, i) => p.atMs - g.log[i].atMs);
    expect(gaps.length).toBeGreaterThanOrEqual(4);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(1000 / 1.5 - 1e-6);
  });

  it("cancels a held drop on hold, pause and undo", () => {
    const g = make({ ppsCap: 1 });
    drop(g);
    g.tick(100);
    drop(g);
    g.keyDown("hold");
    g.keyUp("hold");
    g.tick(2000);
    expect(g.state.pieces).toBe(1);
    // A held drop is also dropped by pause.
    g.restart(1);
    drop(g);
    g.tick(100);
    drop(g);
    g.pause();
    g.resume();
    g.tick(2000);
    expect(g.state.pieces).toBe(1);
    // And by undo, which respawns the piece.
    drop(g);
    expect(g.state.pieces).toBe(2);
    g.undo();
    g.tick(5000);
    expect(g.state.pieces).toBe(1);
  });

  it("measures the interval from the kept lock after undo", () => {
    const g = make({ ppsCap: 2 });
    drop(g);
    g.tick(600);
    drop(g);
    expect(g.state.pieces).toBe(2);
    g.undo();
    drop(g); // the kept timeline is back at the first lock: 500 ms to wait
    expect(g.state.pieces).toBe(1);
    g.tick(499);
    expect(g.state.pieces).toBe(1);
    g.tick(1);
    expect(g.state.pieces).toBe(2);
  });

  it("keeps drill intervals above the cap after an undo", () => {
    const stage = STAGES.find((st) => st.id === "clean-stacking")!;
    const slow = stage.drills.find((d) => d.id === "slow-room")!;
    const s = new DrillSession(slow, 3, defaultSettings());
    const press = () => {
      s.keyDown("hardDrop");
      s.keyUp("hardDrop");
    };
    s.tick(100);
    press();
    s.tick(700);
    press(); // the cap allows this one at 766 ms
    s.tick(100);
    s.undo();
    press(); // dropped again at once
    s.tick(2000);
    const times = s.lockTimes;
    expect(times.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < times.length; i++)
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(1000 / 1.5 - 1e-6);
  });

  it("counts a held hard drop that ties with the gravity lock timer", () => {
    const g = make({ ppsCap: 1, gravity: 2, lockDelayMs: 100 });
    drop(g);
    g.tick(10);
    drop(g); // held until 1000 ms
    g.tick(1500);
    expect(g.state.pieces).toBe(2);
    expect(g.state.stats.keys).toBe(2);
  });

  it("is off without the option and can be cleared with setOptions", () => {
    const g = make();
    drop(g);
    drop(g);
    expect(g.state.pieces).toBe(2);
    g.setOptions({ ppsCap: 1 });
    drop(g);
    expect(g.state.pieces).toBe(2);
    g.setOptions({ ppsCap: undefined });
    g.restart(1);
    drop(g);
    drop(g);
    expect(g.state.pieces).toBe(2);
  });

  it("delays a gravity auto-lock to the cap", () => {
    const g = make({ ppsCap: 1, gravity: 1, lockDelayMs: 100 });
    drop(g);
    g.tick(2000); // piece falls, lock timer expires, cap releases at 1000 ms
    expect(g.log.length).toBeGreaterThan(1);
    expect(g.log[1].atMs - g.log[0].atMs).toBeGreaterThanOrEqual(1000 - 1e-6);
  });
});

describe("slow room drill", () => {
  const stage = STAGES.find((s) => s.id === "clean-stacking")!;
  const slow = stage.drills.find((d) => d.id === "slow-room")!;

  it("is a 100 piece, 1.5 PPS capped drill in clean stacking", () => {
    expect(slow.options?.ppsCap).toBe(1.5);
    expect(slow.end.pieces).toBe(100);
    expect(constraintLines(slow).join(" ")).toContain("Speed cap: 1.5 PPS");
  });

  it("never lets a run exceed the cap", () => {
    const s = new DrillSession(slow, 3, defaultSettings());
    for (let i = 0; i < 6; i++) {
      s.keyDown("hardDrop");
      s.keyUp("hardDrop");
      s.tick(50);
    }
    s.tick(2000);
    const times = s.lockTimes;
    for (let i = 1; i < times.length; i++)
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(1000 / 1.5 - 1e-6);
  });
});

describe("pace chart", () => {
  it("is ahead when locks beat the pace and behind when they trail it", () => {
    const points = paceSeries([400, 800, 2000], 2);
    expect(points.map((p) => p.piece)).toEqual([1, 2, 3]);
    expect(points[0].delta).toBeCloseTo(0.2);
    expect(points[1].delta).toBeCloseTo(0.4);
    expect(points[2].delta).toBeCloseTo(-1);
    expect(paceSummary(points)).toBe("Finished 1.0 pieces behind the pace.");
    expect(paceSummary(paceSeries([400], 2))).toBe(
      "Finished 0.2 pieces ahead of the pace.",
    );
    expect(paceSummary([])).toBe("No pieces placed.");
  });

  it("maps points into the box with zero at mid-height", () => {
    const points = paceSeries([500, 1000, 3000], 2);
    // deltas 0, 0, -3; extent 3
    expect(pacePath(points, 100, 60)).toBe("0.0,30.0 50.0,30.0 100.0,60.0");
    expect(pacePath([], 100, 60)).toBe("");
  });

  it("reads lock times from a drill session and follows undo", () => {
    const s = new DrillSession(
      {
        id: "t",
        title: "t",
        summary: "t",
        why: "t",
        how: [],
        end: { pieces: 100 },
        primary: "app",
        metrics: ["app"],
        targetPps: 2,
      },
      5,
      defaultSettings(),
    );
    for (const ms of [100, 300]) {
      s.tick(ms);
      s.keyDown("hardDrop");
      s.keyUp("hardDrop");
    }
    expect(s.lockTimes).toEqual([100, 400]);
    s.undo();
    expect(s.lockTimes).toEqual([100]);
  });
});

describe("metronome", () => {
  afterEach(() => vi.useRealTimers());

  it("schedules beats one interval apart and only those inside the lookahead", () => {
    const first = dueBeats(1, 0, 1, 0.5, 4);
    expect(first.beats.map((b) => b.at)).toEqual([1, 1.25]);
    expect(first.index).toBe(2);
    const more = dueBeats(first.next, first.index, 1.3, 0.5, 4);
    expect(more.beats.map((b) => b.index)).toEqual([2, 3]);
  });

  it("does not schedule a beat in the past", () => {
    const { beats } = dueBeats(0.5, 0, 2, 0.1, 1);
    expect(beats.every((b) => b.at >= 2)).toBe(true);
  });

  function fakeContext() {
    const created: { freq: number; peak: number }[] = [];
    const sources: { stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
    const ctx = {
      currentTime: 0,
      destination: {},
      state: "running",
      resume: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      createOscillator() {
        const osc = {
          frequency: { value: 0 },
          connect: (n: unknown) => n,
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
        };
        sources.push(osc);
        created.push({ freq: 0, peak: 0 });
        const record = created[created.length - 1];
        Object.defineProperty(osc.frequency, "value", {
          set: (v: number) => {
            record.freq = v;
          },
          get: () => record.freq,
        });
        return osc;
      },
      createGain() {
        const record = () => created[created.length - 1];
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: (v: number) => {
              if (v > record().peak) record().peak = v;
            },
          },
          connect: (n: unknown) => n,
          disconnect: vi.fn(),
        };
      },
    };
    return { ctx, created, sources };
  }

  it("clicks on a timer, accents every 7th, and stops silent", () => {
    vi.useFakeTimers();
    const { ctx, created } = fakeContext();
    const m = new Metronome(() => ctx as never);
    m.start({ pps: 10, volume: 1, accent: true });
    expect(m.running).toBe(true);
    for (let i = 0; i < 20; i++) {
      ctx.currentTime += 0.1;
      vi.advanceTimersByTime(100);
    }
    expect(created.length).toBeGreaterThan(14);
    const strong = created.map((c) => c.freq === 1320);
    expect(strong[0]).toBe(true);
    expect(strong[7]).toBe(true);
    expect(strong.filter(Boolean).length).toBe(Math.ceil(created.length / 7));
    m.stop();
    const count = created.length;
    ctx.currentTime += 1;
    vi.advanceTimersByTime(1000);
    expect(created.length).toBe(count);
    expect(m.running).toBe(false);
    m.dispose();
    expect(ctx.close).toHaveBeenCalled();
  });

  it("skips beats a late poll missed instead of bursting them", () => {
    const late = dueBeats(1, 0, 3, 0.12, 4);
    expect(late.beats.every((b) => b.at >= 3)).toBe(true);
    // Beats 0..7 are overdue (1.0 to 2.75); the next due is index 8 at 3.0.
    expect(late.beats.map((b) => b.index)).toEqual([8]);
    expect(new Set(late.beats.map((b) => b.at)).size).toBe(late.beats.length);

    vi.useFakeTimers();
    const { ctx, created } = fakeContext();
    const m = new Metronome(() => ctx as never);
    m.start({ pps: 10, volume: 1, accent: false });
    const before = created.length;
    ctx.currentTime += 5; // the page stalled for 5 s
    vi.advanceTimersByTime(30);
    expect(created.length - before).toBeLessThanOrEqual(2);
    m.dispose();
  });

  it("silences already scheduled clicks on stop", () => {
    vi.useFakeTimers();
    const { ctx, sources } = fakeContext();
    const m = new Metronome(() => ctx as never);
    m.start({ pps: 20, volume: 1, accent: false });
    expect(sources.length).toBeGreaterThan(0);
    const queued = sources.length;
    for (const src of sources) src.stop.mockClear();
    m.stop();
    expect(sources.slice(0, queued).every((x) => x.stop.mock.calls.length === 1)).toBe(true);
    expect(sources.every((x) => x.disconnect.mock.calls.length >= 1)).toBe(true);
    m.dispose();
  });

  it("stays silent at zero volume and survives missing audio", () => {
    vi.useFakeTimers();
    const { ctx, created } = fakeContext();
    const quiet = new Metronome(() => ctx as never);
    quiet.start({ pps: 5, volume: 0, accent: false });
    ctx.currentTime += 1;
    vi.advanceTimersByTime(1000);
    expect(created.length).toBe(0);
    quiet.dispose();
    const broken = new Metronome(() => {
      throw new Error("no audio");
    });
    broken.start({ pps: 5, volume: 1, accent: false });
    expect(broken.running).toBe(false);
  });
});
