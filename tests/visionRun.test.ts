import { describe, expect, it } from "vitest";
import {
  PRACTICE_QUESTIONS,
  STORM_MS,
  STORM_PENALTY_MS,
  VisionRun,
} from "../src/core/visionRun";
import { emptyProgress, METRIC_INFO, recordSession } from "../src/core/progress";

describe("VisionRun", () => {
  it("streak ends on the first wrong answer", () => {
    const run = new VisionRun("streak", 1, 0);
    run.answer(true, 1000);
    run.next(1500);
    run.answer(true, 3500);
    run.next(4000);
    run.answer(false, 5000);
    expect(run.over).toBe(true);
    expect(run.score).toBe(2);
    const rec = run.record("a", 9);
    expect(rec.drillId).toBe("vision:streak");
    expect(rec.metrics.accuracy).toBeCloseTo(2 / 3);
    // Only correct answers count: 1000 ms and 2000 ms.
    expect(rec.metrics.recognitionMs).toBe(1500);
    expect(rec.metrics.timeMs).toBe(4000);
  });

  it("storm charges 10 s per wrong answer and ends at zero", () => {
    const run = new VisionRun("storm", 2, 0);
    expect(run.timeLeft(0)).toBe(STORM_MS);
    run.answer(false, 5000);
    expect(run.timeLeft(5000)).toBe(STORM_MS - 5000 - STORM_PENALTY_MS);
    // Time spent reading the answer is free.
    run.next(60000);
    expect(run.timeLeft(60000)).toBe(STORM_MS - 5000 - STORM_PENALTY_MS);
    run.answer(true, 61000);
    expect(run.score).toBe(1);
    run.next(61500);
    run.expire(61500 + 200000);
    expect(run.over).toBe(true);
    expect(run.record("b", 1).completed).toBe(true);
  });

  it("practice ends after ten questions", () => {
    const run = new VisionRun("practice:noSlot", 3, 0);
    for (let i = 0; i < PRACTICE_QUESTIONS; i++) {
      expect(run.over).toBe(false);
      expect(run.question.kind).toBe("noSlot");
      run.answer(i % 2 === 0, i * 1000 + 500);
      run.next(i * 1000 + 600);
    }
    expect(run.over).toBe(true);
    expect(run.score).toBe(5);
  });

  it("ignores answers after the run is over", () => {
    const run = new VisionRun("streak", 1, 0);
    run.answer(false, 10);
    run.answer(true, 20);
    run.next(30);
    expect(run.score).toBe(0);
  });
});

describe("vision metrics", () => {
  it("accuracy is a 0..1 fraction and recognition is lower-is-better", () => {
    expect(METRIC_INFO.recognitionMs.better).toBe("lower");
    const ok = (accuracy: number) =>
      recordSession(emptyProgress(), {
        id: "x",
        drillId: "vision:storm",
        endedAt: 1,
        durationMs: 1,
        completed: true,
        metrics: { accuracy },
      }).sessions.length;
    expect(ok(0.8)).toBe(1);
    expect(ok(1)).toBe(1);
    expect(ok(1.2)).toBe(0);
    expect(ok(-0.1)).toBe(0);
  });
});
