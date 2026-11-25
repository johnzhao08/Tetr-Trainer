import { describe, expect, it } from "vitest";
import {
  addItem,
  BOX_INTERVALS_MS,
  dueItems,
  emptyReview,
  recordResult,
  scheduleResult,
} from "../src/core/review";

const NOW = 1_000_000;

describe("review", () => {
  it("adds items once, due immediately in box 0", () => {
    const s = addItem(emptyReview(), "p1", "puzzle", NOW);
    expect(s.items[0]).toEqual({
      id: "p1",
      kind: "puzzle",
      box: 0,
      dueAt: NOW,
      lastResult: null,
      lapses: 0,
    });
    expect(addItem(s, "p1", "vision", NOW + 5)).toBe(s);
  });

  it("climbs a box per correct answer and caps at box 5", () => {
    let item = addItem(emptyReview(), "p1", "puzzle", NOW).items[0];
    for (let box = 1; box <= 5; box++) {
      item = scheduleResult(item, true, NOW);
      expect(item.box).toBe(box);
      expect(item.dueAt).toBe(NOW + BOX_INTERVALS_MS[box]);
    }
    item = scheduleResult(item, true, NOW);
    expect(item.box).toBe(5);
    expect(item.lapses).toBe(0);
    expect(item.lastResult).toBe("correct");
  });

  it("drops to box 0 on failure and counts a lapse", () => {
    let item = addItem(emptyReview(), "p1", "puzzle", NOW).items[0];
    item = scheduleResult(scheduleResult(item, true, NOW), true, NOW);
    item = scheduleResult(item, false, NOW);
    expect(item.box).toBe(0);
    expect(item.dueAt).toBe(NOW + BOX_INTERVALS_MS[0]);
    expect(item.lapses).toBe(1);
    expect(item.lastResult).toBe("fail");
  });

  it("returns due items most overdue first, limited", () => {
    let s = emptyReview();
    s = addItem(s, "b", "puzzle", 300);
    s = addItem(s, "a", "vision", 300);
    s = addItem(s, "c", "opener", 100);
    s = addItem(s, "late", "puzzle", 900);
    expect(dueItems(s, 500).map((i) => i.id)).toEqual(["c", "a", "b"]);
    expect(dueItems(s, 500, 2).map((i) => i.id)).toEqual(["c", "a"]);
    expect(dueItems(s, 500, 0)).toEqual([]);
    expect(dueItems(s, 50)).toEqual([]);
  });

  it("recordResult updates one item and ignores unknown ids", () => {
    const s = addItem(emptyReview(), "p1", "puzzle", NOW);
    expect(recordResult(s, "nope", true, NOW)).toBe(s);
    const next = recordResult(s, "p1", true, NOW);
    expect(next.items[0].box).toBe(1);
    expect(dueItems(next, NOW)).toEqual([]);
  });
});
