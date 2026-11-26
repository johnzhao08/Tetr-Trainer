import { describe, expect, it } from "vitest";
import { contentKey } from "../src/core/visionFeed";
import { PRACTICE_QUESTIONS, VisionRun } from "../src/core/visionRun";

describe("run content", () => {
  it("never repeats what the player sees (structure, seed 39)", () => {
    const run = new VisionRun("practice:structure", 39, 0);
    const looks = [contentKey(run.question)];
    let t = 0;
    while (looks.length < PRACTICE_QUESTIONS) {
      run.answer(true, (t += 10));
      run.next();
      run.show((t += 5));
      looks.push(contentKey(run.question));
    }
    expect(new Set(looks).size).toBe(PRACTICE_QUESTIONS);
  });
});
