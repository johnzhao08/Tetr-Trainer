import { describe, expect, it } from "vitest";
import { stepAnswerLatch } from "../src/core/visionAnswer";

const locked = { pieces: 1, status: "playing" };
const fresh = { pieces: 0, status: "playing" };

describe("stepAnswerLatch", () => {
  it("does not judge or latch a lock seen before the question is shown", () => {
    expect(stepAnswerLatch(false, false, locked)).toEqual({
      latched: false,
      judge: false,
    });
  });

  it("counts a valid placement after an early lock and a reset", () => {
    let latched = false;
    latched = stepAnswerLatch(latched, false, locked).latched;
    latched = stepAnswerLatch(latched, false, fresh).latched;
    const step = stepAnswerLatch(latched, true, locked);
    expect(step.judge).toBe(true);
  });

  it("judges once, then re-arms after Reset piece", () => {
    let step = stepAnswerLatch(false, true, locked);
    expect(step.judge).toBe(true);
    step = stepAnswerLatch(step.latched, true, locked);
    expect(step.judge).toBe(false);
    step = stepAnswerLatch(step.latched, true, fresh);
    expect(step.latched).toBe(false);
    expect(stepAnswerLatch(step.latched, true, locked).judge).toBe(true);
  });
});
