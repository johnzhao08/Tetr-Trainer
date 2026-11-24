import { describe, expect, it } from "vitest";
import { LEVELS, MODULES, modulesAt } from "../src/core/catalog";
import { READY_SCREENS } from "../src/ui/ModuleScreen";

describe("learning catalog", () => {
  it("uses unique ids", () => {
    const ids = MODULES.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a screen for every ready module and none for planned ones", () => {
    for (const module of MODULES)
      expect(Boolean(READY_SCREENS[module.id]), module.id).toBe(
        module.status === "ready",
      );
  });

  it("lists something at every level, playable modules first", () => {
    for (const level of LEVELS) {
      const listed = modulesAt(level.id);
      expect(listed.length).toBeGreaterThan(0);
      const firstPlanned = listed.findIndex((m) => m.status === "planned");
      if (firstPlanned >= 0)
        expect(listed.slice(firstPlanned).every((m) => m.status === "planned"))
          .toBe(true);
    }
  });

  it("describes what each planned module will do and links real modules", () => {
    for (const module of MODULES) {
      if (module.status !== "planned") continue;
      expect(module.willDo.length).toBeGreaterThan(0);
      for (const id of module.practiseWith)
        expect(MODULES.find((m) => m.id === id)?.status).toBe("ready");
    }
  });

  it("draws previews on a ten-column board", () => {
    for (const module of MODULES)
      for (const row of module.preview ?? [])
        expect(row, module.id).toMatch(/^[.IJLOSTZX*]{10}$/);
  });
});
