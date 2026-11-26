import { describe, expect, it } from "vitest";
import { frameChanged, frameView, MAX_STEP_MS, newPacer, paceStep, resetPacer, settlePause, startFrame, takeStep } from "../src/core/frameView";
import { Game } from "../src/core/game";
import { defaultSettings } from "../src/core/settings";

describe("frame view", () => {
  it("changes when only pending garbage changes", () => {
    const g = new Game(1, defaultSettings(), {});
    const before = frameView(g);
    g.receive(2);
    expect(frameChanged(before, frameView(g))).toBe(true);
    expect(frameChanged(before, frameView(g))).toBe(true);
    expect(frameChanged(frameView(g), frameView(g))).toBe(false);
  });
  it("sees an opponent attack arrive during a tick", () => {
    const g = new Game(1, defaultSettings(), {
      opponent: { seed: 3, apm: 600 },
    });
    const before = frameView(g);
    g.tick(2000);
    expect(g.state.active).toBe(before.active);
    expect(g.pendingLines).toBeGreaterThan(0);
    expect(frameChanged(before, frameView(g))).toBe(true);
  });
  it("sees a bot placement that changes neither piece nor garbage", () => {
    const g = new Game(1, defaultSettings(), { bot: { seed: 3, pps: 4, skill: 0 } });
    const before = frameView(g);
    g.tick(300);
    expect(g.state.active).toBe(before.active);
    expect(frameChanged(before, frameView(g))).toBe(true);
  });
  it("works a long stall off in bounded, order-preserving steps", () => {
    let backlog = 10000;
    const steps: number[] = [];
    while (backlog > 0) {
      const { step, rest } = takeStep(backlog);
      steps.push(step);
      backlog = rest;
    }
    expect(Math.max(...steps)).toBeLessThanOrEqual(MAX_STEP_MS);
    expect(steps.reduce((a, b) => a + b, 0)).toBe(10000);
    // Stepping in chunks matches one big tick.
    const mk = () => new Game(1, defaultSettings(), { bot: { seed: 3, pps: 4, skill: 1 } });
    const a = mk();
    const b = mk();
    a.tick(10000);
    for (const step of steps) b.tick(step);
    expect(b.state.bot).toEqual(a.state.bot);
  });
  it("shares one step budget between a frame and its input events", () => {
    const p = newPacer(0);
    // 1 s stalled: the frame callback and a press and release in one frame.
    const frame = paceStep(p, 1000);
    const press = paceStep(p, 1000);
    const release = paceStep(p, 1000);
    expect(frame + press + release).toBe(MAX_STEP_MS);
    expect(p.backlog).toBe(1000 - MAX_STEP_MS);
    startFrame(p);
    expect(paceStep(p, 1000)).toBe(MAX_STEP_MS);
  });
  it("lets normal frames and inputs use their real elapsed time", () => {
    const p = newPacer(0);
    expect(paceStep(p, 16)).toBe(16);
    expect(paceStep(p, 20)).toBe(4);
    expect(paceStep(p, 10)).toBe(0);
  });
  it("drops the backlog on restart", () => {
    const p = newPacer(0);
    paceStep(p, 5000);
    resetPacer(p, 5000);
    startFrame(p);
    expect(p.backlog).toBe(0);
    expect(paceStep(p, 5016)).toBe(16);
  });
  it("spends no paused time after a manual resume", () => {
    const p = newPacer(0);
    paceStep(p, 5000); // page stalled while paused, backlog left over
    expect(p.backlog).toBeGreaterThan(0);
    settlePause(p, 5000); // resume input arrives before the next frame
    expect(paceStep(p, 5000)).toBe(0);
    startFrame(p);
    expect(paceStep(p, 5016)).toBe(16);
  });
  it("drops the backlog when pausing too", () => {
    const p = newPacer(0);
    paceStep(p, 3000);
    settlePause(p, 3000);
    expect(p.backlog).toBe(0);
    expect(p.previous).toBe(3000);
  });
});
