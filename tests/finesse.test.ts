import { describe, expect, it } from "vitest";
import { spawn, TYPES, type Tetromino } from "../src/core/board";
import { landingKey, optimalPath, placements } from "../src/core/finesse";
import { FinesseDrill } from "../src/core/finesseDrill";
import { defaultSettings, type Action } from "../src/core/settings";

const tap = (game: FinesseDrill, action: Action) => {
  game.keyDown(action);
  game.keyUp(action);
};

describe("finesse search", () => {
  // Independent count of distinct empty-board placements (also used by lst-solver).
  it.each([
    ["T", 34],
    ["J", 34],
    ["L", 34],
    ["S", 17],
    ["Z", 17],
    ["I", 17],
    ["O", 9],
  ] as const)("finds every %s placement (%i)", (type, count) => {
    expect(placements(type)).toHaveLength(count);
  });

  it("needs no presses to drop where the piece spawns", () => {
    for (const type of TYPES) expect(optimalPath(spawn(type))).toEqual([]);
  });

  it("uses DAS for walls and taps for nearby columns", () => {
    const o = (x: number) => ({ type: "O" as Tetromino, x, y: 0, rotation: 0 as const });
    // O cells sit at x and x+1.
    expect(optimalPath(o(0))).toEqual(["dasLeft"]);
    expect(optimalPath(o(8))).toEqual(["dasRight"]);
    expect(optimalPath(o(3))).toEqual(["left"]);
    expect(optimalPath(o(1))).toEqual(["dasLeft", "right"]);
    expect(optimalPath(o(2))).toHaveLength(2);
  });

  it("prefers one 180 press over two rotations when allowed", () => {
    const flat = { type: "T" as Tetromino, x: 4, y: 1, rotation: 2 as const };
    expect(optimalPath(flat)).toEqual(["flip"]);
    expect(optimalPath(flat, false)).toHaveLength(2);
  });

  it("treats mirror-identical S, Z and I rotations as one placement", () => {
    const a = { type: "I" as Tetromino, x: 4, y: 0, rotation: 0 as const };
    const b = { type: "I" as Tetromino, x: 4, y: 1, rotation: 2 as const };
    expect(landingKey(a)).toBe(landingKey(b));
  });
});

describe("finesse drill", () => {
  const settings = { ...defaultSettings(), das: 100, arr: 0 };

  it("counts presses and grades each drop against the optimum", () => {
    const drill = new FinesseDrill(7, settings, { length: 3, hints: true, use180: true });
    const target = drill.target!;
    // Replay the optimal path through the real input handling.
    for (const input of drill.optimal) {
      if (input === "dasLeft" || input === "dasRight") {
        const action = input === "dasLeft" ? "left" : "right";
        drill.keyDown(action);
        drill.tick(200);
        drill.keyUp(action);
      } else tap(drill, input);
    }
    tap(drill, "hardDrop");
    expect(drill.results[0]).toMatchObject({
      type: target.type,
      correct: true,
    });
    expect(drill.results[0].presses).toBe(drill.results[0].optimal);
    expect(drill.perfect).toBe(1);
    expect(drill.state.board.flat().every((c) => c === null)).toBe(true);
  });

  it("marks wasted presses and wrong placements, then stops at the length", () => {
    const drill = new FinesseDrill(3, settings, { length: 2, hints: false, use180: true });
    tap(drill, "left");
    tap(drill, "right");
    // Spawn position is right only if the target happens to be the spawn drop.
    const atSpawn = landingKey(drill.state.active!) === landingKey(drill.target!);
    tap(drill, "hardDrop");
    expect(drill.results[0].presses).toBe(2);
    expect(drill.results[0].correct).toBe(atSpawn);
    tap(drill, "hold");
    expect(drill.state.hold).toBeNull();
    tap(drill, "hardDrop");
    expect(drill.done).toBe(true);
    expect(drill.state.active).toBeNull();
    expect(drill.state.status).toBe("paused");
    drill.restart(3);
    expect(drill.results).toEqual([]);
    expect(drill.target).not.toBeNull();
  });

  it("draws the same targets for the same seed", () => {
    const a = new FinesseDrill(42);
    const b = new FinesseDrill(42);
    for (let i = 0; i < 5; i++) {
      expect(a.target).toEqual(b.target);
      tap(a, "hardDrop");
      tap(b, "hardDrop");
    }
  });
});
