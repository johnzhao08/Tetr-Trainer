import { describe, expect, it } from "vitest";
import { GarbageSource, hasGarbage } from "../src/core/garbage";
import { ScenarioDrill, type Scenario } from "../src/core/scenario";
import { SCENARIO_MODULES } from "../src/core/scenarios";
import type { Action } from "../src/core/settings";

const play = (drill: ScenarioDrill, actions: readonly Action[]) => {
  for (const action of actions) {
    drill.keyDown(action);
    drill.keyUp(action);
  }
};
const holes = (source: GarbageSource) => {
  const out: number[] = [];
  for (let row = source.row(); row; row = source.row()) out.push(row.indexOf(null));
  return out;
};

describe("garbage source", () => {
  it("deals single-hole rows up to the total, reproducibly", () => {
    const spec = { rows: 10, total: 18, messiness: 1 };
    const a = holes(new GarbageSource(5, spec));
    expect(a).toHaveLength(18);
    expect(a).toEqual(holes(new GarbageSource(5, spec)));
    // Fully messy: every row moves its hole.
    for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
  });

  it("keeps the hole in place with zero messiness", () => {
    const a = holes(new GarbageSource(9, { rows: 5, total: 5, messiness: 0 }));
    expect(new Set(a).size).toBe(1);
  });
});

describe("cheese drills", () => {
  const scenario: Scenario = {
    queue: ["I", "I"],
    garbage: { rows: 4, total: 6, messiness: 0 },
    goals: [{ kind: "dig", lines: 6 }],
    allowUndo: false,
  };
  const dropIntoHole = (drill: ScenarioDrill) => {
    const hole = drill.state.board[0].indexOf(null);
    // A clockwise I from spawn stands in column 5.
    const step: Action = hole < 5 ? "left" : "right";
    play(drill, ["cw", ...Array<Action>(Math.abs(hole - 5)).fill(step), "hardDrop"]);
  };

  it("counts cleared garbage, refills from below, and finishes the race", () => {
    const drill = new ScenarioDrill(3, undefined, scenario);
    expect(drill.state.board.filter(hasGarbage)).toHaveLength(4);
    dropIntoHole(drill);
    expect(drill.state.lastClear).toBe(4);
    expect(drill.garbageCleared).toBe(4);
    // Two rows are left to deal, so two rise back in.
    expect(drill.state.board.filter(hasGarbage)).toHaveLength(2);
    expect(drill.canUndo).toBe(false);
    dropIntoHole(drill);
    expect(drill.garbageCleared).toBe(6);
    expect(drill.result).toBe("success");
  });

  it("ships three cheese levels with growing difficulty", () => {
    const specs = ["cheese-basics", "cheese-10", "cheese-18"].map(
      (id) => SCENARIO_MODULES[id].steps[0].scenario.garbage!,
    );
    expect(specs.map((s) => s.total)).toEqual([6, 10, 18]);
    expect(specs[0].messiness).toBeLessThan(specs[1].messiness);
  });
});
