import { describe, expect, it } from "vitest";
import {
  acceptRun,
  HANDLING_DAS_STEPS,
  HANDLING_PIECES,
  HANDLING_DCD,
  handlingSettings,
  nextDas,
  recommendDas,
} from "../src/core/handling";
import type { HandlingRun } from "../src/core/handling";
import { defaultSettings } from "../src/core/settings";

const run = (das: number, finesse: number): HandlingRun => ({
  das,
  finesse,
  extraPresses: 0,
});

describe("handling wizard", () => {
  it("steps DAS from 130 down to 80", () => {
    expect([...HANDLING_DAS_STEPS]).toEqual([130, 120, 110, 100, 90, 80]);
    expect(nextDas([])).toBe(130);
    expect(nextDas([run(130, 0.7)])).toBe(120);
    expect(nextDas(HANDLING_DAS_STEPS.map((d) => run(d, 0.7)))).toBeNull();
  });

  it("sets ARR 0 and the recommended DCD, keeping other settings", () => {
    const base = { ...defaultSettings(), arr: 5, softDropSpeed: 77 };
    const next = handlingSettings(base, 100);
    expect(next).toMatchObject({
      das: 100,
      arr: 0,
      dcd: HANDLING_DCD,
      softDropSpeed: 77,
    });
    expect(base.arr).toBe(5);
  });

  it("recommends the lowest DAS within 5 points of the best run", () => {
    const runs = [
      run(130, 0.7),
      run(120, 0.72),
      run(110, 0.7),
      run(100, 0.68),
      run(90, 0.6),
      run(80, 0.4),
    ];
    expect(recommendDas(runs)).toBe(100);
  });

  it("accepts a run exactly 5 points under the best", () => {
    expect(recommendDas([run(130, 0.8), run(120, 0.75)])).toBe(120);
  });

  it("falls back to the best DAS when only it is safe", () => {
    expect(recommendDas([run(130, 0.9), run(120, 0.6), run(110, 0.5)])).toBe(130);
  });

  it("recommends nothing without runs", () => {
    expect(recommendDas([])).toBeNull();
  });

  it("accepts only runs that reach the full piece count", () => {
    expect(acceptRun(100, { pieces: HANDLING_PIECES, finesse: 0.9, extraPresses: 2 })).toEqual({
      das: 100,
      finesse: 0.9,
      extraPresses: 2,
    });
    expect(acceptRun(100, { pieces: HANDLING_PIECES - 1, finesse: 1, extraPresses: 0 })).toBeNull();
    expect(acceptRun(100, { pieces: HANDLING_PIECES, finesse: undefined, extraPresses: 0 })).toBeNull();
  });
});
