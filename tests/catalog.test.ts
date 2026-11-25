import { describe, expect, it } from "vitest";
import { MODULES, REFERENCE, SIDE_TRACK } from "../src/core/catalog";
import { STAGES } from "../src/core/curriculum";
import { READY_SCREENS } from "../src/ui/ModuleScreen";

describe("module catalog", () => {
  it("has a screen for every entry and no orphan screens", () => {
    for (const module of MODULES)
      expect(Boolean(READY_SCREENS[module.id]), module.id).toBe(true);
    expect(Object.keys(READY_SCREENS).sort()).toEqual(
      MODULES.map((m) => m.id).sort(),
    );
  });

  it("keeps drill and module ids unique across stages and catalog", () => {
    const ids = [
      ...STAGES.flatMap((stage) => stage.drills.map((d) => d.id)),
      ...MODULES.map((m) => m.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("splits modules into a side track and reference groups", () => {
    expect(SIDE_TRACK.map((m) => m.id)).toEqual([
      "tki-opener",
      "dt-cannon",
      "tst-entry",
      "pc-opener",
    ]);
    expect(REFERENCE.map((m) => m.id)).toEqual([
      "t-spin-basics",
      "finesse-fundamentals",
    ]);
  });

  it("notes the Season 2 all clear value on the PCO card", () => {
    const pco = SIDE_TRACK.find((m) => m.id === "pc-opener");
    expect(pco?.note).toMatch(/5 lines/);
  });

  it("draws previews on a ten-column board", () => {
    for (const module of MODULES)
      for (const row of module.preview ?? [])
        expect(row, module.id).toMatch(/^[.IJLOSTZX*]{10}$/);
  });
});
