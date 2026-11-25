import { describe, expect, it } from "vitest";
import { findDrill, drillBest } from "../src/core/drillLookup";
import { emptyProgress, recordSession } from "../src/core/progress";

describe("drillBest", () => {
  it("honors a drill that is better lower", () => {
    const cheese = findDrill("cheese-100")!.drill;
    expect(cheese.better).toBe("lower");
    let p = emptyProgress();
    expect(drillBest(p, cheese)).toBeNull();
    for (const [at, value] of [[1, 120], [2, 95], [3, 140]] as const)
      p = recordSession(p, {
        id: `c${at}`,
        drillId: cheese.id,
        endedAt: at,
        durationMs: 1000,
        completed: true,
        metrics: { [cheese.primary]: value },
      });
    expect(drillBest(p, cheese)).toBe(95);
  });
});
