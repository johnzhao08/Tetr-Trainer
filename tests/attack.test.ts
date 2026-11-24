import { describe, expect, it } from "vitest";
import { attackFor } from "../src/core/attack";
import type { AttackInput } from "../src/core/attack";

const hit = (input: Partial<AttackInput>) =>
  attackFor({
    lines: 0,
    spin: null,
    b2b: -1,
    combo: -1,
    garbageCleared: false,
    allClear: false,
    ...input,
  });

describe("attack table", () => {
  it.each([
    ["none", [0, 0, 1, 2, 4]],
    ["mini", [0, 0, 1, 2, 10]],
    ["full", [0, 2, 4, 6, 10]],
  ] as const)("matches the %s row for every line count", (spin, row) => {
    for (let lines = 1; lines <= 4; lines++)
      expect(hit({ lines, spin: spin === "none" ? null : spin }).total).toBe(
        row[lines],
      );
  });

  it("sends nothing and resets combo without a clear", () => {
    expect(hit({ b2b: 3, combo: 4 })).toEqual({
      parts: [],
      total: 0,
      b2b: 3,
      combo: -1,
      surge: 0,
    });
  });
});

describe("back to back", () => {
  it("gives the first qualifying clear no bonus and the second +1", () => {
    const first = hit({ lines: 4 });
    expect([first.total, first.b2b]).toEqual([4, 0]);
    const second = hit({ lines: 4, b2b: first.b2b });
    expect([second.total, second.b2b]).toEqual([5, 1]);
  });

  it("chains a quad into a T-spin double", () => {
    expect(hit({ lines: 2, spin: "full", b2b: 0 }).total).toBe(5);
  });

  it("keeps B2B through a mini spin", () => {
    const r = hit({ lines: 1, spin: "mini", b2b: 2 });
    expect([r.b2b, r.total, r.surge]).toEqual([3, 1, 0]);
  });

  it("breaks B2B on a plain single without surge below 4", () => {
    const r = hit({ lines: 1, b2b: 3 });
    expect([r.b2b, r.surge, r.parts]).toEqual([-1, 0, []]);
  });

  it("releases a surge in three parts when a chain of 4 or more breaks", () => {
    expect(hit({ lines: 1, b2b: 4 })).toMatchObject({
      parts: [1, 1, 2],
      total: 4,
      surge: 4,
      b2b: -1,
    });
    expect(hit({ lines: 1, b2b: 7 }).parts).toEqual([2, 2, 3]);
  });

  it("sends the surge before the clear's own attack", () => {
    expect(hit({ lines: 2, b2b: 4 }).parts).toEqual([1, 1, 2, 1]);
  });
});

describe("combo", () => {
  it("scales four triples in a row", () => {
    let combo = -1;
    const sent = [0, 1, 2, 3].map(() => {
      const r = hit({ lines: 3, combo });
      combo = r.combo;
      return r.total;
    });
    expect(sent).toEqual([2, 2, 3, 3]);
    expect(combo).toBe(3);
  });

  it("floors long combos with the logarithm", () => {
    expect(hit({ lines: 1, combo: 7 }).total).toBe(2);
  });
});

describe("garbage bonus and all clear", () => {
  it("adds 1 for a quad or spin through garbage, not a plain double", () => {
    expect(hit({ lines: 4, garbageCleared: true }).total).toBe(5);
    expect(hit({ lines: 2, spin: "full", garbageCleared: true }).total).toBe(5);
    expect(hit({ lines: 2, garbageCleared: true }).total).toBe(1);
  });

  it("appends an unmultiplied +5 part that counts as B2B", () => {
    expect(hit({ lines: 1, allClear: true })).toMatchObject({
      parts: [5],
      total: 5,
      b2b: 0,
    });
    const chained = hit({ lines: 1, b2b: 3, combo: 2, allClear: true });
    expect(chained.b2b).toBe(4);
    expect(chained.parts.at(-1)).toBe(5);
    expect(chained.surge).toBe(0);
  });
});
