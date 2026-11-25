import { describe, expect, it } from "vitest";
import {
  best,
  emptyProgress,
  evaluateGate,
  exportProgress,
  importProgress,
  loadProgress,
  METRIC_INFO,
  PROGRESS_KEY,
  recentAverage,
  recordSession,
  saveProgress,
  sessionsFor,
} from "../src/core/progress";
import type { Progress, SessionRecord } from "../src/core/progress";

let counter = 0;
function rec(
  drillId: string,
  metrics: SessionRecord["metrics"],
  over: Partial<SessionRecord> = {},
): SessionRecord {
  counter++;
  return {
    id: `s${counter}`,
    drillId,
    endedAt: counter * 1000,
    durationMs: 60000,
    completed: true,
    metrics,
    ...over,
  };
}
function build(...sessions: SessionRecord[]): Progress {
  return sessions.reduce(recordSession, emptyProgress());
}
function store(initial: string | null = null) {
  let saved = initial;
  return {
    getItem: (key: string) => {
      expect(key).toBe(PROGRESS_KEY);
      return saved;
    },
    setItem: (_k: string, v: string) => {
      saved = v;
    },
  };
}

describe("progress storage", () => {
  it("round trips through storage and export", () => {
    const p = build(rec("a", { app: 0.5, pps: 2 }), rec("b", { lines: 40 }));
    const s = store();
    expect(saveProgress(s, p)).toBe(true);
    expect(loadProgress(s)).toEqual(p);
    expect(importProgress(exportProgress(p))).toEqual(p);
  });

  it("recovers from missing and corrupt data", () => {
    for (const raw of [
      null,
      "",
      "{broken",
      "null",
      "[]",
      "42",
      '{"version":2}',
    ])
      expect(loadProgress(store(raw))).toEqual(emptyProgress());
  });

  it("never throws when storage itself throws", () => {
    const s = {
      getItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadProgress(s)).toEqual(emptyProgress());
  });

  it("drops invalid records and keeps valid ones", () => {
    const good = rec("a", { app: 1 });
    const bad = rec("a", {});
    const raw = JSON.stringify({
      version: 1,
      sessions: [
        good,
        { ...bad, metrics: { app: "INF" } },
        { ...bad, metrics: { app: null } },
        { ...bad, metrics: { bogus: 1 } },
        { ...bad, endedAt: "x" },
        { ...bad, completed: "yes" },
        { ...bad, id: undefined },
        { ...bad, drillId: 5 },
        null,
        "str",
      ],
    }).replace('"INF"', "1e999");
    expect(loadProgress(store(raw)).sessions).toEqual([good]);
  });

  it("returns false when storage throws", () => {
    const s = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(saveProgress(s, emptyProgress())).toBe(false);
  });

  it("drops impossible values and keeps valid neighbours", () => {
    const good = rec("a", { finesse: 1, garbageShare: 0, tsdRate: 1.5 });
    const bad = rec("a", {});
    const raw = JSON.stringify({
      version: 1,
      sessions: [
        { ...bad, durationMs: -1 },
        { ...bad, endedAt: -5 },
        { ...bad, metrics: { pps: -0.1 } },
        { ...bad, metrics: { finesse: 1.01 } },
        { ...bad, metrics: { garbageShare: 2 } },
        good,
      ],
    });
    expect(loadProgress(store(raw)).sessions).toEqual([good]);
    expect(importProgress(raw)?.sessions).toEqual([good]);
  });

  it("rejects garbage on import", () => {
    for (const t of [
      "",
      "nope",
      "[]",
      "{}",
      '{"version":1}',
      '{"version":1,"sessions":5}',
    ])
      expect(importProgress(t)).toBeNull();
  });
});

describe("recording sessions", () => {
  it("is immutable", () => {
    const p = emptyProgress();
    recordSession(p, rec("a", {}));
    expect(p.sessions).toEqual([]);
  });

  it("keeps a retried record in place when timestamps tie", () => {
    const a = rec("t", { finesse: 0 }, { endedAt: 5 });
    const b = rec("t", { finesse: 1 }, { endedAt: 5 });
    const gate = { drillId: "t", metric: "finesse" as const, target: 0.5, over: { recent: 1 } };
    const p = build(a, b);
    expect(evaluateGate(p, gate).met).toBe(true);
    const retried = recordSession(p, a);
    expect(retried.sessions.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(evaluateGate(retried, gate).met).toBe(true);
  });

  it("ignores an invalid record instead of replacing a valid one", () => {
    const a = rec("t", { finesse: 0.5 });
    const p = build(a);
    const bad = recordSession(p, { ...a, metrics: { finesse: 2 } });
    expect(bad).toBe(p);
    expect(bad.sessions[0].metrics.finesse).toBe(0.5);
  });

  it("caps 40 per drill and 600 total, dropping oldest", () => {
    let p = emptyProgress();
    const first = rec("a", {});
    p = recordSession(p, first);
    for (let i = 0; i < 45; i++) p = recordSession(p, rec("a", {}));
    expect(sessionsFor(p, "a")).toHaveLength(40);
    expect(sessionsFor(p, "a").some((s) => s.id === first.id)).toBe(false);
    for (let d = 0; d < 20; d++)
      for (let i = 0; i < 40; i++) p = recordSession(p, rec(`d${d}`, {}));
    expect(p.sessions).toHaveLength(600);
    expect(sessionsFor(p, "d19")).toHaveLength(40);
    expect(sessionsFor(p, "a").length).toBeLessThan(40);
  });

  it("is idempotent by id and stable across reload", () => {
    const gate = {
      drillId: "a",
      metric: "app",
      target: 1,
      over: { recent: 2 },
    } as const;
    const first = rec("a", { app: 1 });
    const second = rec("a", { app: 1 });
    const once = build(first, second);
    const twice = recordSession(recordSession(once, second), second);
    expect(twice.sessions).toEqual(once.sessions);
    const s = store();
    saveProgress(s, twice);
    const reloaded = loadProgress(s);
    expect(reloaded.sessions).toEqual(twice.sessions);
    expect(evaluateGate(twice, gate)).toEqual(evaluateGate(reloaded, gate));
    expect(evaluateGate(twice, gate).met).toBe(true);
    const replaced = recordSession(once, { ...second, metrics: { app: 2 } });
    expect(replaced.sessions).toHaveLength(2);
    expect(replaced.sessions[1].metrics.app).toBe(2);
  });

  it("lists sessions newest first", () => {
    const a = rec("a", {});
    const b = rec("a", {});
    expect(sessionsFor(build(a, b), "a").map((s) => s.id)).toEqual([
      b.id,
      a.id,
    ]);
  });
});

describe("best and recent average", () => {
  it("respects direction and completedOnly", () => {
    const p = build(
      rec("a", { app: 0.4, timeMs: 90000 }),
      rec("a", { app: 0.9, timeMs: 50000 }, { completed: false }),
      rec("a", { app: 0.6, timeMs: 70000 }),
    );
    expect(best(p, "a", "app")).toBe(0.9);
    expect(best(p, "a", "app", { completedOnly: true })).toBe(0.6);
    expect(best(p, "a", "timeMs")).toBe(50000);
    expect(best(p, "a", "timeMs", { completedOnly: true })).toBe(70000);
    expect(best(p, "a", "pps")).toBeNull();
    expect(best(p, "zzz", "app")).toBeNull();
  });

  it("averages the newest completed window", () => {
    const p = build(
      rec("a", { app: 1 }),
      rec("a", { app: 2 }),
      rec("a", { app: 100 }, { completed: false }),
      rec("a", { app: 4 }),
    );
    expect(recentAverage(p, "a", "app", 2)).toBe(3);
    expect(recentAverage(p, "a", "app", 10)).toBeCloseTo(7 / 3);
    expect(recentAverage(p, "a", "pps", 2)).toBeNull();
  });
});

describe("gates", () => {
  const p = build(
    rec("a", { app: 0.5, pps: 1.5 }),
    rec("a", { app: 0.8, pps: 2.5 }),
    rec("a", { app: 1.0, pps: 1.0 }),
    rec("a", { app: 0.6, pps: 2.0 }),
  );
  const base = { drillId: "a", metric: "app", target: 0.7 } as const;

  it("evaluates best", () => {
    const s = evaluateGate(p, { ...base, over: "best" });
    expect(s.value).toBe(1.0);
    expect(s.met).toBe(true);
    expect(s.progress).toBe(1);
  });

  it("evaluates recent N and needs N sessions", () => {
    const s = evaluateGate(p, { ...base, over: { recent: 2 } });
    expect(s.value).toBeCloseTo(0.8);
    expect(s.met).toBe(true);
    const low = evaluateGate(p, { ...base, target: 1, over: { recent: 2 } });
    expect(low.met).toBe(false);
    expect(low.progress).toBeCloseTo(0.8);
    const few = evaluateGate(p, { ...base, over: { recent: 9 } });
    expect(few.value).toBeNull();
    expect(few.met).toBe(false);
  });

  it("filters by minPps", () => {
    const s = evaluateGate(p, {
      ...base,
      target: 0.9,
      over: "best",
      minPps: 2,
    });
    expect(s.value).toBe(0.8);
    expect(s.met).toBe(false);
    expect(s.progress).toBeCloseTo(0.8 / 0.9);
    expect(
      evaluateGate(p, { ...base, over: "best", minPps: 5 }).value,
    ).toBeNull();
  });

  it("handles lower-is-better targets", () => {
    const q = build(
      rec("a", { piecesPerGarbage: 4 }),
      rec("a", { piecesPerGarbage: 6 }),
    );
    const gate = {
      drillId: "a",
      metric: "piecesPerGarbage",
      target: 2,
      over: "best",
    } as const;
    const s = evaluateGate(q, gate);
    expect(s.value).toBe(4);
    expect(s.met).toBe(false);
    expect(s.progress).toBe(0.5);
    expect(evaluateGate(q, { ...gate, target: 5 }).met).toBe(true);
  });

  it("clamps progress to 0..1 and reports no data", () => {
    const tiny = build(rec("a", { app: 0.001 }));
    const s = evaluateGate(tiny, { ...base, target: 1e9, over: "best" });
    expect(s.progress).toBeGreaterThanOrEqual(0);
    expect(s.progress).toBeLessThanOrEqual(1);
    const gate = { ...base, over: "best" } as const;
    expect(evaluateGate(emptyProgress(), gate)).toEqual({
      gate,
      value: null,
      met: false,
      progress: 0,
    });
  });

  it("tolerates float rounding at the target, both directions", () => {
    const avg = build(rec("a", { app: 0.6 }), rec("a", { app: 0.7 }));
    const up = evaluateGate(avg, {
      drillId: "a",
      metric: "app",
      target: 0.65,
      over: { recent: 2 },
    });
    expect(up.value).not.toBe(0.65);
    expect(up.met).toBe(true);
    const low = build(rec("a", { kpp: 0.6 }), rec("a", { kpp: 0.7 }));
    const lower = evaluateGate(low, {
      drillId: "a",
      metric: "kpp",
      target: 0.65,
      over: { recent: 2 },
    });
    expect(lower.met).toBe(true);
    const missedLower = evaluateGate(low, {
      drillId: "a",
      metric: "kpp",
      target: 0.64,
      over: { recent: 2 },
    });
    expect(missedLower.met).toBe(false);
    const missedHigher = evaluateGate(avg, {
      drillId: "a",
      metric: "app",
      target: 0.66,
      over: { recent: 2 },
    });
    expect(missedHigher.met).toBe(false);
  });

  it("ignores incomplete sessions", () => {
    const q = build(rec("a", { app: 5 }, { completed: false }));
    expect(evaluateGate(q, { ...base, over: "best" }).value).toBeNull();
  });
});

describe("metric formatting", () => {
  it("formats values", () => {
    expect(METRIC_INFO.app.format(0.456)).toBe("0.46");
    expect(METRIC_INFO.finesse.format(0.925)).toBe("92.5%");
    expect(METRIC_INFO.timeMs.format(83450)).toBe("1:23.45");
    expect(METRIC_INFO.timeMs.format(5000)).toBe("0:05.00");
  });
});
