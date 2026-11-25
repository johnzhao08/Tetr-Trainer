import { describe, expect, it } from "vitest";
import {
  RANK_BENCHMARKS,
  STAGES,
  STRETCH,
  estimateRank,
  recommendedStage,
  stageStatus,
} from "../src/core/curriculum";
import { DrillSession } from "../src/core/drillSession";
import {
  emptyProgress,
  evaluateGate,
  METRIC_INFO,
  recordSession,
} from "../src/core/progress";
import type { MetricId, Progress } from "../src/core/progress";
import { defaultSettings } from "../src/core/settings";

const drills = STAGES.flatMap((s) => s.drills);

const sessions = (
  drillId: string,
  metrics: Partial<Record<MetricId, number>>,
  count = 3,
  completed = true,
): Progress => {
  let p = emptyProgress();
  for (let i = 0; i < count; i++)
    p = recordSession(p, {
      id: `${drillId}-${i}`,
      drillId,
      endedAt: i,
      durationMs: 1000,
      completed,
      metrics,
    });
  return p;
};
const merge = (...ps: Progress[]): Progress =>
  ps.reduce((a, b) => ({ version: 1, sessions: [...a.sessions, ...b.sessions] }));

describe("curriculum data", () => {
  it("has unique drill and stage ids", () => {
    expect(new Set(drills.map((d) => d.id)).size).toBe(drills.length);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length);
    expect(STAGES.map((s) => s.id)[0]).toBe("controls");
  });
  it("uses valid metric ids and complete definitions", () => {
    for (const d of drills) {
      expect(Object.hasOwn(METRIC_INFO, d.primary), d.id).toBe(true);
      expect(d.metrics, d.id).toContain(d.primary);
      for (const m of d.metrics) expect(Object.hasOwn(METRIC_INFO, m), d.id).toBe(true);
      expect(Object.keys(d.end).length, d.id).toBeGreaterThan(0);
      expect(d.why.length, d.id).toBeGreaterThan(20);
      expect(d.how.length, d.id).toBeGreaterThan(0);
    }
  });
  it("gates reference drills in their own stage and shown metrics", () => {
    for (const stage of STAGES) {
      expect(stage.gates.length).toBeGreaterThan(0);
      for (const gate of stage.gates) {
        // Vision trainer modes are not DrillDefs; they have their own screen.
        if (gate.drillId.startsWith("vision:")) continue;
        const drill = stage.drills.find((d) => d.id === gate.drillId);
        expect(drill, `${stage.id}:${gate.drillId}`).toBeDefined();
        expect(drill!.metrics).toContain(gate.metric);
      }
    }
  });
  it("starts every drill and survives a hard drop", () => {
    for (const d of drills) {
      const s = new DrillSession(d, 1, defaultSettings());
      s.tick(100);
      s.keyDown("hardDrop");
      s.keyUp("hardDrop");
      expect(s.game.state.pieces, d.id).toBe(1);
      expect(s.reviews, d.id).toHaveLength(1);
    }
  });
});

describe("rank estimate", () => {
  it("returns each benchmark row's own rank", () => {
    for (const row of RANK_BENCHMARKS)
      expect(estimateRank({ pps: row.pps, app: row.app })).toBe(row.rank);
  });
  it("rows are consistent: APM is PPS x APP x 60", () => {
    for (const row of RANK_BENCHMARKS)
      expect(Math.abs((row.pps * row.app * 60) / row.apm - 1)).toBeLessThan(0.03);
  });
  it("picks the nearest band and handles extremes", () => {
    expect(estimateRank({ pps: 1.3, app: 0.4 })).toBe("A");
    expect(estimateRank({ pps: 10, app: 2 })).toBe("X+");
    expect(estimateRank({ pps: 0, app: 0 })).toBe("D");
    expect(estimateRank({ pps: 0.1, app: 0.01 })).toBe("D");
  });
});

describe("stage status", () => {
  it("recommends the first stage for empty progress", () => {
    expect(recommendedStage(emptyProgress())).toBe(STAGES[0]);
    const status = stageStatus(emptyProgress(), STAGES[0]);
    expect(status.passed).toBe(false);
    expect(status.gates.every((g) => g.value === null)).toBe(true);
  });

  it("passes when non-stretch gates are met, even without the stretch", () => {
    const p = sessions("finesse-live", { finesse: 0.7 });
    const status = stageStatus(p, STAGES[0]);
    expect(status.passed).toBe(true);
    expect(status.gates.find((g) => g.gate.label === STRETCH)?.met).toBe(false);
  });

  it("moves the recommendation past passed stages only", () => {
    const stage0 = sessions("finesse-live", { finesse: 0.7 });
    const stage1 = merge(
      sessions("quads-40l", { timeMs: 80000, violations: 0 }, 1),
      sessions("clean-100", { holesPer100: 2 }),
    );
    expect(recommendedStage(stage0)).toBe(STAGES[1]);
    expect(recommendedStage(merge(stage0, stage1))).toBe(STAGES[2]);
    // Skipping ahead does not pass the earlier stage.
    expect(recommendedStage(stage1)).toBe(STAGES[0]);
  });

  it("ignores failed sessions and sessions below the gate's minPps", () => {
    expect(
      stageStatus(sessions("finesse-live", { finesse: 0.9 }, 3, false), STAGES[0]).passed,
    ).toBe(false);
    const tsd = STAGES.find((s) => s.id === "tsd")!;
    const base = sessions("tsd-hunt", { tsdRate: 0.5, holesPer100: 2 });
    const slow = sessions("app-100", { app: 0.5, pps: 0.9 }, 1);
    const fast = sessions("app-100", { app: 0.5, pps: 1.1 }, 1);
    expect(stageStatus(merge(base, slow), tsd).passed).toBe(false);
    expect(stageStatus(merge(base, fast), tsd).passed).toBe(true);
  });

  it("falls back to the last stage when all are passed", () => {
    const all = merge(
      ...STAGES.flatMap((s) =>
        s.gates.map((g) =>
          sessions(g.drillId, {
            [g.metric]: g.target,
            ...Object.fromEntries((g.requireZero ?? []).map((m) => [m, 0])),
            pps: 5,
          } as Partial<Record<MetricId, number>>),
        ),
      ),
    );
    expect(recommendedStage(all)).toBe(STAGES[STAGES.length - 1]);
    expect(STAGES.every((s) => stageStatus(all, s).passed)).toBe(true);
  });
});

describe("quad-only gate", () => {
  it("ignores runs with non-quad clears or no violation record", () => {
    const gate = STAGES[1].gates[0];
    expect(gate.drillId).toBe("quads-40l");
    for (const metrics of [
      { timeMs: 80000, violations: 1 },
      { timeMs: 80000 },
    ])
      expect(evaluateGate(sessions("quads-40l", metrics, 1), gate).met).toBe(
        false,
      );
    expect(
      evaluateGate(
        sessions("quads-40l", { timeMs: 80000, violations: 0 }, 1),
        gate,
      ).met,
    ).toBe(true);
  });
});
