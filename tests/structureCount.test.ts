import { describe, expect, it } from "vitest";
import { countStructure, STRUCTURE_WINDOW } from "../src/core/structureCount";
import { LESSON_DRILLS } from "../src/core/lessonDrills";
import { STAGES } from "../src/core/curriculum";
import { METRIC_INFO } from "../src/core/progress";

type Hit = Parameters<typeof countStructure>[0][number];
const t = (index: number, cleared: number, spin: Hit["spin"] = "full"): Hit => ({
  index, type: "T", spin, cleared,
});
const other = (index: number, cleared: number): Hit => ({
  index, type: "I", spin: null, cleared,
});

describe("countStructure", () => {
  it("counts full T-spin triples for tst", () => {
    expect(countStructure([t(0, 3), t(5, 2), t(9, 3), t(10, 3, "mini")], "tst")).toBe(2);
  });
  it("counts two spin clears within the window for pair", () => {
    expect(countStructure([t(0, 2), t(2, 2)], "pair")).toBe(1);
    expect(countStructure([t(0, 2), t(STRUCTURE_WINDOW + 1, 2)], "pair")).toBe(0);
    expect(countStructure([t(0, 2), t(2, 2), t(3, 2)], "pair")).toBe(1);
    expect(countStructure([t(0, 2), t(2, 2), t(3, 2), t(4, 3)], "pair")).toBe(2);
    expect(countStructure([t(0, 2), t(1, 2, "mini")], "pair")).toBe(0);
  });
  it("needs a double then a triple for td", () => {
    expect(countStructure([t(0, 2), t(2, 3)], "td")).toBe(1);
    expect(countStructure([t(0, 3), t(2, 2)], "td")).toBe(0);
  });
  it("needs a TSD then a quad for donation", () => {
    expect(countStructure([t(0, 2), other(4, 4)], "donation")).toBe(1);
    expect(countStructure([t(0, 2), other(4, 3)], "donation")).toBe(0);
    expect(countStructure([other(0, 4), t(1, 2)], "donation")).toBe(0);
  });
});

describe("lesson drills", () => {
  it("are in a stage and score structureCount", () => {
    const staged = new Set(STAGES.flatMap((s) => s.drills.map((d) => d.id)));
    for (const d of LESSON_DRILLS) {
      expect(staged.has(d.id), d.id).toBe(true);
      expect(d.primary).toBe("structureCount");
      expect(d.structure).toBeDefined();
    }
    expect(METRIC_INFO.structureCount.format(2)).toBe("2");
  });
});
