import { describe, expect, it } from "vitest";
import { STAGES } from "../src/core/curriculum";
import { drillPassed, firstUnpassedDrill, recentSkill } from "../src/core/level";
import { emptyProgress, recordSession } from "../src/core/progress";
import type { MetricId, Progress } from "../src/core/progress";

const add = (
  p: Progress,
  drillId: string,
  at: number,
  metrics: Partial<Record<MetricId, number>>,
  completed = true,
) =>
  recordSession(p, {
    id: `${drillId}-${at}`,
    drillId,
    endedAt: at,
    durationMs: 1000,
    completed,
    metrics,
  });

describe("recentSkill", () => {
  it("is null with no usable sessions", () => {
    expect(recentSkill(emptyProgress())).toBeNull();
    expect(recentSkill(add(emptyProgress(), "x", 1, { pps: 1 }))).toBeNull();
  });

  it("averages only the newest sessions", () => {
    let p = emptyProgress();
    for (let i = 0; i < 12; i++)
      p = add(p, "x", i, { pps: i < 2 ? 10 : 1, app: i < 2 ? 10 : 0.5 });
    expect(recentSkill(p, 10)).toEqual({ pps: 1, app: 0.5, runs: 10 });
  });
});

describe("recentSkill with zero APP", () => {
  it("counts a recorded APP of 0 and reports the contributing runs", () => {
    let p = emptyProgress();
    p = add(p, "x", 1, { pps: 2, app: 0 });
    p = add(p, "x", 2, { pps: 2, app: 1 });
    p = add(p, "x", 3, { pps: 2 });
    expect(recentSkill(p)).toEqual({ pps: 2, app: 0.5, runs: 2 });
  });
});

describe("firstUnpassedDrill", () => {
  const stage = STAGES.find((s) => s.id === "clean-stacking")!;
  const [quads, noHold, clean] = stage.drills;

  it("starts at the first drill with no history", () => {
    expect(firstUnpassedDrill(emptyProgress(), stage)).toBe(quads);
  });

  it("passes a gated drill only when its gate is met", () => {
    const slow = add(emptyProgress(), quads.id, 1, { timeMs: 120000 });
    expect(drillPassed(slow, stage, quads)).toBe(false);
    const fast = add(emptyProgress(), quads.id, 1, { timeMs: 80000, violations: 0 });
    expect(drillPassed(fast, stage, quads)).toBe(true);
    expect(firstUnpassedDrill(fast, stage)).toBe(noHold);
  });

  it("passes an ungated drill after one completed run", () => {
    expect(drillPassed(add(emptyProgress(), noHold.id, 1, {}, false), stage, noHold)).toBe(false);
    const p = add(emptyProgress(), noHold.id, 1, {});
    expect(drillPassed(p, stage, noHold)).toBe(true);
  });

  it("falls back to the first drill once everything is passed", () => {
    let p = add(emptyProgress(), quads.id, 1, { timeMs: 80000, violations: 0 });
    p = add(p, noHold.id, 2, {});
    for (let i = 0; i < 3; i++) p = add(p, clean.id, 3 + i, { holesPer100: 1 });
    expect(firstUnpassedDrill(p, stage)).toBe(quads);
  });
});
