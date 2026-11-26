import { describe, expect, it } from "vitest";
import { itemId, parseItem, recordOpener } from "../src/core/openerReview";
import { openerById } from "../src/core/openers";
import { dueItems } from "../src/core/review";
import { emptyTraining, MAX_REVIEW } from "../src/core/training";
import { bestBatchMs } from "./support/timing";

const tki = openerById("tki-opener")!;

describe("review items", () => {
  const item = { opener: "tki-opener", bag: "ILZOSJT", mirror: false };

  it("schedules results and rates the opener's theme", () => {
    const t0 = recordOpener(emptyTraining(), item, true, 1000);
    expect(t0.review).toHaveLength(1);
    expect(t0.review[0]).toMatchObject({ id: itemId(item), kind: "opener", box: 1 });
    expect(t0.players[tki.theme].rating).toBeGreaterThan(1500);
    const t1 = recordOpener(t0, item, false, 2000);
    expect(t1.review).toHaveLength(1);
    expect(t1.review[0]).toMatchObject({ box: 0, lapses: 1 });
    expect(t1.players[tki.theme].rating).toBeLessThan(t0.players[tki.theme].rating);
    expect(dueItems({ items: t1.review }, 2000 + 10 * 60_000)).toHaveLength(1);
  });

  it("only parses ids of real, supported items", () => {
    expect(parseItem(itemId(item), true)).toEqual(item);
    expect(parseItem(itemId({ ...item, mirror: true }), false)).not.toBeNull();
    for (const bad of [
      "opener:nope:ILZOSJT:n",
      "opener:tki-opener:ILZOSJ:n",
      "opener:tki-opener:IILZOSJ:n",
      "opener:tki-opener:ZSLOJTI:n",
      "puzzle:1",
      "",
    ])
      expect(parseItem(bad, true), bad).toBeNull();
  });

  it("parses ids quickly", () => {
    const ms = bestBatchMs(() => {
      for (let i = 0; i < 2000; i++) parseItem("opener:tki-opener:ILZOSJT:m", true);
    }, 1);
    expect(ms).toBeLessThan(50);
  });
});

describe("review capacity", () => {
  it("keeps the just-practised bag and evicts the furthest-due item", () => {
    const base = emptyTraining();
    const filler = Array.from({ length: MAX_REVIEW }, (_, i) => ({
      id: `puzzle:${i}`,
      kind: "puzzle" as const,
      box: i % 5,
      dueAt: 5000 + i,
      lastResult: "correct" as const,
      lapses: 0,
    }));
    const item = { opener: "tki-opener", bag: "ILZOSJT", mirror: false };
    const t = recordOpener({ ...base, review: filler }, item, false, 1000);
    expect(t.review).toHaveLength(MAX_REVIEW);
    expect(t.review.some((i) => i.id === itemId(item))).toBe(true);
    expect(t.review.some((i) => i.id === `puzzle:${MAX_REVIEW - 1}`)).toBe(false);
    expect(dueItems({ items: t.review }, 1000 + 10 * 60_000).map((i) => i.id)).toContain(itemId(item));
  });
});
