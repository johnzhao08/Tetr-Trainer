import { describe, expect, it } from "vitest";
import { OpenerRun } from "../src/core/openerRun";
import { itemId } from "../src/core/openerReview";
import { openerById, openerFor } from "../src/core/openers";
import { bagSummary, buildOutcome, nextDueBag } from "../src/core/openerView";
import { addItem, nextRefreshDelay } from "../src/core/review";
import { defaultSettings } from "../src/core/settings";

const tki = openerById("tki-opener")!;
const dt = openerById("dt-cannon")!;
const review = (ids: string[], dueAt: number[]) =>
  ids.map((id, i) => ({ ...addItem({ items: [] }, id, "opener", dueAt[i]).items[0] }));

describe("opener screen helpers", () => {
  it("picks the most overdue bag that matches the opener and shown side", () => {
    const a = itemId({ opener: "tki-opener", bag: "ILZOSJT", mirror: false });
    const b = itemId({ opener: "tki-opener", bag: "ILZOSJT", mirror: true });
    const c = itemId({ opener: "dt-cannon", bag: "OIJTSZL", mirror: false });
    const items = review([a, b, c], [300, 100, 50]);
    expect(nextDueBag(items, 1000, "tki-opener", false, true)?.bag).toBe("ILZOSJT");
    expect(nextDueBag(items, 1000, "tki-opener", true, true)?.mirror).toBe(true);
    expect(nextDueBag(items, 1000, "dt-cannon", true, true)).toBeNull();
    expect(nextDueBag(items, 200, "tki-opener", false, true)).toBeNull();
    const older = review([a, itemId({ opener: "tki-opener", bag: "ILZOSJT", mirror: true })], [400, 20]);
    expect(nextDueBag(older, 1000, "tki-opener", true, true)?.mirror).toBe(true);
  });

  it("finds a bag that became due after the picker mounted", () => {
    const a = itemId({ opener: "tki-opener", bag: "ILZOSJT", mirror: false });
    const items = review([a], [500]);
    // Mounted at 100: not due yet, the refresh timer lands just after 500.
    expect(nextDueBag(items, 100, "tki-opener", false, true)).toBeNull();
    const delay = nextRefreshDelay(items, 100, 100)!;
    expect(delay).toBeGreaterThanOrEqual(400);
    // Requesting a bag at wall time 600 rechecks and finds it.
    expect(nextDueBag(items, 600, "tki-opener", false, true)?.bag).toBe("ILZOSJT");
  });

  it("counts supported orders only for enumerated openers", () => {
    expect(bagSummary(tki, 1680)).toBe("1680 supported first-bag orders build this opener with hold.");
    expect(bagSummary(openerFor(dt, true), 1)).toBe(`One canonical practice order: ${openerFor(dt, true).canonical[0]}.`);
    expect(bagSummary(openerFor(dt, true), 1)).not.toMatch(/supported/);
  });

  it("knows the build outcome before the continuation ends", () => {
    const r = new OpenerRun(1, defaultSettings(), tki, "ILZOSJT");
    expect(buildOutcome(r)).toBeNull();
    for (let i = 0; i < 2; i++) {
      r.keyDown("hardDrop"); // the L straight down is off the guide
      r.keyUp("hardDrop");
    }
    expect(r.stage).toBe("failed");
    expect(buildOutcome(r)).toBe(false);
    // A built opener is a success while the continuation is still running.
    const built = new OpenerRun(1, defaultSettings(), tki, "ILZOSJT");
    Object.assign(built, { stage: "continue", buildPieces: 7 });
    expect(built.over).toBe(false);
    expect(buildOutcome(built)).toBe(true);
  });
});
