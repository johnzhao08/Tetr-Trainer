import { describe, expect, it } from "vitest";
import { emptyProgress, MAX_FREEPLAY, MAX_PER_DRILL, MAX_TOTAL, recordSession } from "../src/core/progress";
import type { MetricId, Progress } from "../src/core/progress";
import { emptyStats } from "../src/core/stats";
import {
  freeplayRecord,
  isoWeek,
  trackActivity,
  trendSeries,
  weekPositions,
  weeklyTrend,
} from "../src/core/trends";

const at = (iso: string) => Date.parse(iso);
const add = (
  p: Progress,
  drillId: string,
  time: string,
  metrics: Partial<Record<MetricId, number>>,
  n = 0,
) =>
  recordSession(p, {
    id: `${drillId}-${time}-${n}`,
    drillId,
    endedAt: at(time),
    durationMs: 1000,
    completed: true,
    metrics,
  });

describe("isoWeek", () => {
  it("starts weeks on Monday", () => {
    expect(isoWeek(at("2026-11-23T00:00:00Z")).week).toBe("2026-W48");
    expect(isoWeek(at("2026-11-29T23:59:59Z")).week).toBe("2026-W48");
    expect(isoWeek(at("2026-11-30T00:00:00Z")).week).toBe("2026-W49");
  });
  it("uses the ISO year around New Year", () => {
    expect(isoWeek(at("2021-01-03T12:00:00Z")).week).toBe("2020-W53");
    expect(isoWeek(at("2024-12-30T12:00:00Z")).week).toBe("2025-W01");
  });
});

describe("weeklyTrend", () => {
  it("is empty without sessions", () => {
    expect(weeklyTrend([])).toEqual([]);
    expect(trendSeries(emptyProgress())).toEqual({ freeplay: [], drills: [] });
  });

  it("gives one point for a single session", () => {
    const p = add(emptyProgress(), "d", "2026-11-24T10:00:00Z", {
      pps: 1.3,
      app: 0.38,
    });
    const [point, ...rest] = weeklyTrend(p.sessions);
    expect(rest).toEqual([]);
    expect(point).toMatchObject({ week: "2026-W48", pps: 1.3, app: 0.38, count: 1, rank: "A" });
  });

  it("averages within a week and orders weeks oldest first", () => {
    let p = emptyProgress();
    p = add(p, "d", "2026-12-02T10:00:00Z", { pps: 2, app: 0.6 });
    p = add(p, "d", "2026-11-24T10:00:00Z", { pps: 1, app: 0.2 }, 1);
    p = add(p, "d", "2026-11-26T10:00:00Z", { pps: 2, app: 0.4 }, 2);
    const points = weeklyTrend(p.sessions);
    expect(points.map((x) => x.week)).toEqual(["2026-W48", "2026-W49"]);
    expect(points[0]).toMatchObject({ pps: 1.5, count: 2 });
    expect(points[0].app).toBeCloseTo(0.3);
  });

  it("skips sessions without PPS and APP", () => {
    const p = add(emptyProgress(), "d", "2026-11-24T10:00:00Z", { finesse: 0.5 });
    expect(weeklyTrend(p.sessions)).toEqual([]);
  });

  it("separates freeplay from drills", () => {
    let p = emptyProgress();
    p = add(p, "freeplay", "2026-11-24T10:00:00Z", { pps: 1, app: 0.3 });
    p = add(p, "quads-40l", "2026-11-24T11:00:00Z", { pps: 2, app: 0.5 });
    const series = trendSeries(p);
    expect(series.freeplay).toHaveLength(1);
    expect(series.freeplay[0].pps).toBe(1);
    expect(series.drills[0].pps).toBe(2);
  });
});

describe("freeplayRecord", () => {
  const game = (pieces: number) => ({
    seed: 7,
    stats: { ...emptyStats(), attack: pieces / 2, cleanPieces: pieces, keys: pieces * 3 },
    pieces,
    elapsedMs: pieces * 500,
  });
  it("never saves fewer than 40 pieces", () => {
    expect(freeplayRecord(game(39), 1)).toBeNull();
  });
  it("saves 40 pieces with the headline metrics", () => {
    const record = freeplayRecord(game(40), 5);
    expect(record).toMatchObject({
      id: "freeplay-7",
      drillId: "freeplay",
      endedAt: 5,
      durationMs: 20000,
    });
    expect(record?.metrics).toMatchObject({
      pps: 2,
      app: 0.5,
      apm: 60,
      finesse: 1,
      pieces: 40,
      timeMs: 20000,
    });
  });
  it("skips a game with no elapsed time", () => {
    expect(freeplayRecord({ ...game(50), elapsedMs: 0 }, 1)).toBeNull();
  });
});

describe("weekPositions", () => {
  const week = (iso: string) => ({ start: isoWeek(at(iso)).start });
  it("spaces points by week, leaving a gap for a skipped week", () => {
    const xs = weekPositions(
      [week("2026-11-02T00:00:00Z"), week("2026-11-09T00:00:00Z"), week("2026-11-30T00:00:00Z")],
      100,
      0,
    );
    expect(xs).toEqual([0, 25, 100]);
  });
  it("centers a single point and handles none", () => {
    expect(weekPositions([week("2026-11-02T00:00:00Z")], 100, 8)).toEqual([50]);
    expect(weekPositions([], 100, 8)).toEqual([]);
  });
});

describe("trackActivity", () => {
  it("keeps the time of an unchanged game and moves it on a new lock or seed", () => {
    const first = trackActivity(undefined, 1, 40, 1000);
    expect(first.at).toBe(1000);
    expect(trackActivity(first, 1, 40, 9000)).toBe(first);
    expect(trackActivity(first, 1, 41, 9000).at).toBe(9000);
    expect(trackActivity(first, 2, 40, 9000).at).toBe(9000);
  });
});

describe("freeplay storage cap", () => {
  it("saving freeplay against full drill history evicts no drill records", () => {
    let p = emptyProgress();
    const drills = Math.floor(MAX_TOTAL / MAX_PER_DRILL);
    for (let d = 0; d < drills; d++)
      for (let i = 0; i < MAX_PER_DRILL; i++)
        p = add(p, `d${d}`, `2026-01-01T00:${String(i).padStart(2, "0")}:00Z`, { pps: 1 }, d);
    const before = p.sessions.length;
    expect(before).toBe(MAX_TOTAL);
    for (let i = 0; i < 5; i++)
      p = add(p, "freeplay", `2026-11-0${i + 1}T10:00:00Z`, { pps: 1, app: 0.3 });
    expect(p.sessions.filter((s) => s.drillId !== "freeplay")).toHaveLength(before);
    expect(p.sessions.filter((s) => s.drillId === "freeplay")).toHaveLength(5);
  });
  it("caps freeplay on its own", () => {
    let p = emptyProgress();
    for (let i = 0; i < MAX_FREEPLAY + 10; i++)
      p = add(p, "freeplay", new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), { pps: 1 });
    expect(p.sessions).toHaveLength(MAX_FREEPLAY);
  });
});
