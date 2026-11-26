import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VisionResults } from "../src/ui/VisionResults";

const record = {
  id: "a", drillId: "vision:practice:whichPiece", endedAt: 1, durationMs: 1,
  completed: false, metrics: { score: 2, accuracy: 1 },
};
const render = (exhausted: boolean, rec = record) =>
  renderToString(
    createElement(VisionResults, {
      title: "t", record: rec, priorBest: null, saved: true, exhausted,
      onAgain: () => {}, onMenu: () => {},
    }),
  );

describe("VisionResults", () => {
  it("says so when the set ended early", () => {
    expect(render(true)).toContain("Ended early");
    expect(render(true)).toContain("No new questions were left");
  });
  it("shows a normal finish otherwise", () => {
    expect(render(false)).toContain("Run complete");
  });
  it("never calls an exhausted run a new best", () => {
    expect(render(true)).not.toContain("New best");
    expect(render(false, { ...record, completed: true })).toContain("New best");
  });
});
