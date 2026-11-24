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
