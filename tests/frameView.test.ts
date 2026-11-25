import { describe, expect, it } from "vitest";
import { frameChanged, frameView } from "../src/core/frameView";
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
});
