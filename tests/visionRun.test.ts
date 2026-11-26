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
    run.next(); run.show(1500);
    run.answer(true, 3500);
    run.next(); run.show(4000);
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
    run.next(); run.show(60000);
    expect(run.timeLeft(60000)).toBe(STORM_MS - 5000 - STORM_PENALTY_MS);
    run.answer(true, 61000);
    expect(run.score).toBe(1);
    run.next(); run.show(61500);
    run.expire(61500 + 200000);
    expect(run.over).toBe(true);
    expect(run.record("b", 1).completed).toBe(true);
  });

  it("storm ignores an answer that lands after the clock ran out", () => {
    const run = new VisionRun("storm", 2, 0);
    expect(run.answer(true, STORM_MS + 1)).toBe(false);
    expect(run.over).toBe(true);
    expect(run.score).toBe(0);
    const rec = run.record("late", 1);
    expect(rec.metrics.accuracy).toBe(0);
    expect(rec.metrics.recognitionMs).toBeUndefined();
    // An answer inside the clock still counts.
    const ok = new VisionRun("storm", 2, 0);
    expect(ok.answer(true, STORM_MS - 1)).toBe(true);
    expect(ok.score).toBe(1);
  });

  it("starts timing when the question is shown, not when it is built", () => {
    const run = new VisionRun("storm", 4);
    expect(run.asking).toBe(false);
    expect(run.timeLeft(500)).toBe(STORM_MS);
    run.show(1000);
    run.show(9999);
    expect(run.asking).toBe(true);
    expect(run.timeLeft(1500)).toBe(STORM_MS - 500);
    run.answer(true, 3000);
    expect(run.record("s", 1).metrics.recognitionMs).toBe(2000);
  });

  it("a later question is timed from when it is shown, not from Next", () => {
    const run = new VisionRun("practice:findSlot", 4, 0);
    run.answer(true, 1000);
    run.next();
    expect(run.asking).toBe(false);
    run.answer(true, 5000);
    expect(run.answered).toBe(1);
    run.show(7000);
    run.answer(true, 7400);
    expect(run.record("s", 1).metrics.recognitionMs).toBe(700);
  });

  it("practice ends after ten questions", () => {
    const run = new VisionRun("practice:noSlot", 3, 0);
    for (let i = 0; i < PRACTICE_QUESTIONS; i++) {
      expect(run.over).toBe(false);
      expect(run.question.kind).toBe("noSlot");
      run.answer(i % 2 === 0, i * 1000 + 500);
      run.next(); run.show(i * 1000 + 600);
    }
    expect(run.over).toBe(true);
    expect(run.score).toBe(5);
  });

  it("ignores answers after the run is over", () => {
    const run = new VisionRun("streak", 1, 0);
    run.answer(false, 10);
    run.answer(true, 20);
    run.next(); run.show(30);
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

describe("VisionRun question ids", { timeout: 60_000 }, () => {
  it("never repeats a question within a run", () => {
    // Run seed 3 used to give questions 4 and 5 the same accepted id.
    const run = new VisionRun("practice:whichPiece", 3, 0);
    const ids = [run.question.id];
    for (let i = 1; i < PRACTICE_QUESTIONS; i++) {
      run.answer(true, i * 10);
      run.next();
      run.show(i * 10 + 5);
      ids.push(run.question.id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
