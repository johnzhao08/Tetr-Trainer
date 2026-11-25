import { describe, expect, it } from "vitest";
import { emptyBoard, spawn } from "../src/core/board";
import { drillController, type Controller } from "../src/core/controller";
import { STAGES } from "../src/core/curriculum";
import type { DrillDef } from "../src/core/drill";
import { findDrill, gateText } from "../src/core/drillLookup";
import { DrillSession } from "../src/core/drillSession";
import {
  bandCounts,
  boardRows,
  constraintLines,
  endText,
  flagText,
  paceText,
  remaining,
} from "../src/core/drillView";
import { Game } from "../src/core/game";
import { defaultSettings } from "../src/core/settings";

const def: DrillDef = {
  id: "t",
  title: "t",
  summary: "t",
  why: "t",
  how: [],
  end: { pieces: 3 },
  primary: "app",
  metrics: ["app"],
};

describe("findDrill", () => {
  it("finds every curriculum drill with its stage", () => {
    for (const stage of STAGES)
      for (const drill of stage.drills) {
        const found = findDrill(drill.id);
        expect(found?.drill).toBe(drill);
        expect(found?.stage).toBe(stage);
      }
  });
  it("returns null for unknown ids", () => {
    expect(findDrill("nope")).toBeNull();
  });
});

describe("gateText", () => {
  it("describes direction, speed and span", () => {
    const text = gateText({
      drillId: "x",
      metric: "app",
      target: 0.5,
      over: { recent: 3 },
      minPps: 1.6,
    });
    expect(text).toBe("APP at least 0.50 at 1.6+ PPS, average of last 3");
    expect(
      gateText({ drillId: "x", metric: "holesPer100", target: 2, over: "best" }),
    ).toBe("Holes per 100 at most 2.0, best run");
  });
});

const drop = (c: Controller) => {
  c.keyDown("hardDrop");
  c.keyUp("hardDrop");
};

describe("drillController", () => {
  it("drives the session and reports rewinds and restarts", () => {
    const session = new DrillSession(def, 1, defaultSettings());
    const calls: string[] = [];
    const c = drillController(session, {
      onRewind: () => calls.push("rewind"),
      onRestart: () => calls.push("restart"),
    });
    expect(c.state).toBe(session.game.state);
    expect(c.phase).toBe("playing");
    c.undo();
    expect(calls).toEqual([]);
    drop(c);
    expect(c.state.pieces).toBe(1);
    expect(c.canUndo).toBe(true);
    c.undo();
    expect(c.state.pieces).toBe(0);
    c.restart(5);
    expect(calls).toEqual(["rewind", "restart"]);
    for (let i = 0; i < 3; i++) drop(c);
    expect(c.phase).not.toBe("playing");
    expect(session.status).toBe("complete");
  });
  it("lets a plain Game satisfy the same contract", () => {
    const game = new Game(1, defaultSettings());
    const c: Controller = game;
    expect(c.phase).toBeUndefined();
  });
});

describe("view helpers", () => {
  it("words flags and counts bands", () => {
    expect(flagText({ kind: "hole", count: 1 })).toBe("Created a hole");
    expect(flagText({ kind: "hole", count: 2 })).toBe("Created 2 holes");
    expect(flagText({ kind: "two-wide", x: 0 })).toBe("2-wide well");
    const review = (band: "best" | "blunder") =>
      ({ band }) as import("../src/core/coach").PlacementReview;
    expect(bandCounts([review("best"), review("best"), review("blunder")])).toEqual({
      best: 2,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 1,
    });
  });
  it("describes objective and constraints", () => {
    expect(endText({ pieces: 100 })).toBe("Place 100 pieces");
    expect(endText({ lines: 40, timeMs: 120000 })).toBe(
      "Clear 40 lines, or survive 120 seconds",
    );
    const lines = constraintLines({
      ...def,
      noHold: true,
      quadsOnly: true,
      targetPps: 1.6,
      options: { cheese: { rows: 4, total: 10, messiness: 0.3 } },
    });
    expect(lines).toHaveLength(4);
    expect(constraintLines(def)).toEqual([]);
  });
  it("counts what is left", () => {
    const now = { pieces: 30, lines: 10, garbageCleared: 4, elapsedMs: 61_500 };
    expect(remaining({ ...def, end: { pieces: 100 } }, now)).toEqual([
      { label: "Pieces left", value: "70" },
    ]);
    expect(remaining({ ...def, end: { timeMs: 120_000 } }, now)).toEqual([
      { label: "Time left", value: "0:59" },
    ]);
    expect(
      remaining(
        {
          ...def,
          end: { garbage: true },
          options: { cheese: { rows: 4, total: 10, messiness: 0.3 } },
        },
        now,
      ),
    ).toEqual([{ label: "Garbage left", value: "6" }]);
  });
  it("words pace", () => {
    expect(paceText(1.25)).toBe("1.3 pieces ahead");
    expect(paceText(-2)).toBe("2.0 pieces behind");
  });
  it("renders board rows top-down with the landing outlined", () => {
    const board = emptyBoard();
    board[0][0] = "X";
    board[1][0] = "X";
    const landing = { ...spawn("O"), x: 5, y: 0 };
    const rows = boardRows(board, landing);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.every((r) => r.length === 10)).toBe(true);
    expect(rows.at(-1)![0]).toBe("X");
    expect(rows.join("")).toContain("*");
  });
});
