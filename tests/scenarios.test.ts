import { describe, expect, it } from "vitest";
import { emptyBoard, type Board, type Tetromino } from "../src/core/board";
import { rowsToCells, ScenarioDrill, type Scenario } from "../src/core/scenario";
import {
  DT_FIXED_QUEUE,
  DT_GUIDE,
  PCO_FIXED_QUEUE,
  PCO_GUIDE,
  SCENARIO_MODULES,
  TKI_GUIDE,
} from "../src/core/scenarios";
import type { Action } from "../src/core/settings";
import { lockings, perfectClear } from "./support/search";

const play = (drill: ScenarioDrill, actions: readonly Action[]) => {
  for (const action of actions) {
    drill.keyDown(action);
    drill.keyUp(action);
  }
};
const finished = (rows: readonly string[]) => rows.map((r) => r.replace(/\*/g, "."));

/** Places `queue` (skipping held pieces) one by one onto the guide's cells. */
function buildGuide(guide: readonly string[], queue: readonly Tetromino[]): Board {
  const want = new Map(rowsToCells(guide).map((c) => [`${c.x},${c.y}`, c.char]));
  let board = emptyBoard();
  for (const type of queue) {
    const next = lockings(board, type).find(
      (option) =>
        option.cleared === 0 &&
        option.board.every((row, y) =>
          row.every((cell, x) => cell === board[y][x] || want.get(`${x},${y}`) === type),
        ),
    );
    expect(next, `${type} has a place on the guide`).toBeDefined();
    board = next!.board;
  }
  return board;
}

describe("opener content", () => {
  it("uses ten-column guides made of whole pieces", () => {
    for (const guide of [TKI_GUIDE, PCO_GUIDE, DT_GUIDE]) {
      expect(guide.every((row) => /^[.IJLOSTZG*]{10}$/.test(row))).toBe(true);
      const counts = new Map<string, number>();
      for (const { char } of rowsToCells(guide)) counts.set(char, (counts.get(char) ?? 0) + 1);
      for (const [char, count] of counts) if (!"G*".includes(char)) expect(count % 4).toBe(0);
    }
  });

  it("builds TKI from its fixed bag and spins a T-spin double", () => {
    const built = buildGuide(TKI_GUIDE, [..."ILZOSJ"] as Tetromino[]);
    const target = rowsToCells(TKI_GUIDE).filter((c) => c.char !== "*");
    expect(target.every(({ x, y }) => built[y][x] === TKI_GUIDE[TKI_GUIDE.length - 1 - y][x])).toBe(true);
    const drill = new ScenarioDrill(1, undefined, {
      board: finished(TKI_GUIDE),
      queue: ["T"],
      goals: [{ kind: "tspin", lines: 2 }],
    });
    play(drill, ["left", "left", "ccw", "softDrop", "ccw", "hardDrop"]);
    expect(drill.state.lastEvent?.label).toBe("T-spin Double");
    expect(drill.result).toBe("success");
  });

  it("builds the PCO with I held and the fixed second bag can perfect clear", () => {
    const firstBag = PCO_FIXED_QUEUE.slice(1, 7);
    const built = buildGuide(PCO_GUIDE, firstBag);
    expect(perfectClear(built, PCO_FIXED_QUEUE.slice(7), "I", 4)).not.toBeNull();
  });

  it("builds the DT base from its fixed bags, then doubles into a triple", () => {
    buildGuide(DT_GUIDE, [...DT_FIXED_QUEUE.slice(0, 7), "J", "O"]);
    // One fill of the grey cells with I, L, Z, S (found by the test search).
    const filled = [
      "..OO......",
      "..OO......",
      "...LLLLS.I",
      "JJ.LLZZSSI",
      "J..LLSZZSI",
      "J...TSSZZI",
      "OO.TTTSJZZ",
      "OO.IIIIJJJ",
    ];
    for (const { x, y, char } of rowsToCells(DT_GUIDE))
      expect(filled[filled.length - 1 - y][x] === ".").toBe(char === "*");
    const drill = new ScenarioDrill(1, undefined, {
      board: filled,
      queue: ["T", "T"],
      goals: [{ kind: "tspin", lines: 2 }, { kind: "tspin", lines: 3 }],
    });
    play(drill, ["left", "left", "left", "cw", "left", "softDrop", "ccw", "ccw", "softDrop", "ccw", "hardDrop"]);
    expect(drill.state.lastEvent?.label).toBe("T-spin Double");
    expect(drill.goalIndex).toBe(1);
    play(drill, ["left", "left", "left", "cw", "left", "softDrop", "ccw", "ccw", "hardDrop"]);
    expect(drill.state.lastEvent?.label).toBe("T-spin Triple");
    expect(drill.result).toBe("success");
  });

  it("enters the T-spin triple drill with the documented SRS+ kick", () => {
    const drill = new ScenarioDrill(1, undefined, SCENARIO_MODULES["tst-entry"].steps[0].scenario);
    play(drill, ["right", "right", "right", "softDrop", "left", "left", "cw", "hardDrop"]);
    expect(drill.state.lastEvent?.label).toBe("T-spin Triple");
    expect(drill.result).toBe("success");
  });
});

describe("scenario rules", () => {
  const pc: Scenario = {
    board: ["XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX.", "XXXXXXXXX."],
    queue: ["O", "I"],
    goals: [{ kind: "allClear" }],
    pieceLimit: 2,
  };

  it("counts goals only when the lock meets them, and undo restores progress", () => {
    const drill = new ScenarioDrill(1, undefined, pc);
    play(drill, ["hardDrop"]);
    expect(drill.goalIndex).toBe(0);
    expect(drill.result).toBeNull();
    play(drill, ["cw", "right", "right", "right", "right", "right", "hardDrop"]);
    // Four lines clear, but the O is left behind: not a perfect clear.
    expect(drill.state.lastClear).toBe(4);
    expect(drill.state.allClearId).toBeNull();
    expect(drill.result).toBe("failed");
    expect(drill.failure).toBe("outOfPieces");
    drill.undo();
    expect(drill.result).toBeNull();
    expect(drill.state.status).toBe("playing");
    expect(drill.state.active?.type).toBe("I");
    drill.restart(1);
    play(drill, ["hold", "cw", "right", "right", "right", "right", "right", "hardDrop"]);
    expect(drill.state.allClearId).not.toBeNull();
    expect(drill.result).toBe("success");
    expect(drill.state.active).toBeNull();
  });

  it("does not count minis or wrong line counts as T-spin goals", () => {
    const drill = new ScenarioDrill(1, undefined, {
      ...SCENARIO_MODULES["tst-entry"].steps[0].scenario,
      pieceLimit: undefined,
    });
    play(drill, ["hardDrop"]);
    expect(drill.goalIndex).toBe(0);
    drill.undo();
    expect(drill.goalIndex).toBe(0);
    expect(drill.state.pieces).toBe(0);
  });

  it("blocks hold when the scenario turns it off", () => {
    const drill = new ScenarioDrill(1, undefined, SCENARIO_MODULES["tst-entry"].steps[0].scenario);
    play(drill, ["hold"]);
    expect(drill.state.hold).toBeNull();
    expect(drill.state.canHold).toBe(false);
  });
});
