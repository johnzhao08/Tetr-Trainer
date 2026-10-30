import { describe, expect, it } from "vitest";
import { TSpinDrill, TKI_BAG } from "../src/core/tSpinDrill";
import { Game } from "../src/core/game";
import { cells, collides, emptyBoard, spawn, TYPES } from "../src/core/board";
import { defaultSettings, type Action } from "../src/core/settings";
const tap = (game: Game, action: Action) => {
  game.keyDown(action);
  game.keyUp(action);
};

describe("basic T-spin drill", () => {
  it.each([
    ["cw", "T-spin Single", "full", "success"],
    ["ccw", "T-spin Mini Single", "mini", "retry"],
  ] as const)(
    "uses the same engine verdict for %s as free play",
    (rotation, label, spin, result) => {
      const drill = new TSpinDrill(1);
      const free = new Game(1);
      free.state = structuredClone(drill.state);
      for (const game of [free, drill]) {
        tap(game, rotation);
        tap(game, "hardDrop");
      }
      expect(free.state.lastEvent).toEqual({ id: 1, label, tspin: true, spin });
      expect(drill.state.lastEvent).toEqual(free.state.lastEvent);
      expect(drill.result).toBe(result);
      drill.resume();
      tap(drill, "cw");
      tap(drill, "hardDrop");
      expect(drill.result).toBe(result);
      drill.restart(1);
      tap(drill, "cw");
      tap(drill, "hardDrop");
      expect(drill.result).toBe("success");
    },
  );
  it.each([true, false])(
    "locks a full T-spin Single through normal actions (instant soft drop=%s)",
    (instantSoftDrop) => {
      const g = new TSpinDrill(1, { ...defaultSettings(), instantSoftDrop });
      const start = structuredClone(g.state);
      expect(collides(g.state.board, g.state.active!)).toBe(false);
      g.tick(5000);
      expect(g.state).toEqual(start);
      tap(g, "softDrop");
      expect(g.state.active).toEqual({ type: "T", x: 4, y: 1, rotation: 0 });
      tap(g, "cw");
      expect(g.state.active).toEqual({ type: "T", x: 4, y: 1, rotation: 1 });
      expect(cells(g.state.active!)).toEqual(
        expect.arrayContaining([
          [4, 0],
          [4, 1],
          [4, 2],
          [5, 1],
        ]),
      );
      expect(g.result).toBeNull();
      tap(g, "hardDrop");
      expect(g.state.lastEvent).toEqual({
        id: 1,
        label: "T-spin Single",
        tspin: true,
        spin: "full",
      });
      expect(g.state.lines).toBe(1);
      expect(g.result).toBe("success");
      expect(g.state.active).toBeNull();
      const done = structuredClone(g.state);
      g.resume();
      tap(g, "hardDrop");
      tap(g, "left");
      g.tick(5000);
      g.undo();
      expect(g.state).toEqual(done);
      g.restart(2);
      expect(g.state.board).toEqual(start.board);
      expect(g.state.active).toEqual(start.active);
      expect(g.result).toBeNull();
      tap(g, "hardDrop");
      expect(g.result).toBe("retry");
    },
  );
  it("rejects a non-spin even at the target pose and resets rotation history on retry", () => {
    const g = new TSpinDrill(1);
    // Correct geometry alone is not success: no rotation action occurred.
    g.state.active = { type: "T", x: 4, y: 1, rotation: 1 };
    tap(g, "hardDrop");
    expect(g.state.lastEvent?.label).toBe("Single");
    expect(g.result).toBe("retry");
    g.restart(1);
    tap(g, "cw");
    g.restart(1);
    tap(g, "hardDrop");
    expect(g.result).toBe("retry");
  });
  it("preserves pause/input safeguards and isolates retry from free play/settings", () => {
    const settings = defaultSettings();
    const free = new Game(6, settings);
    tap(free, "hardDrop");
    const saved = structuredClone(free.state);
    const g = new TSpinDrill(1, free.settings);
    const start = structuredClone(g.state);
    tap(g, "hold");
    expect(g.state).toEqual(start);
    g.keyDown("left");
    g.pause();
    const paused = structuredClone(g.state);
    g.tick(10000);
    tap(g, "cw");
    tap(g, "hardDrop");
    expect(g.state).toEqual(paused);
    g.resume();
    g.tick(10000);
    expect(g.state.active).toEqual(paused.active);
    g.restart(1);
    g.tick(10000);
    expect(g.state).toEqual(start);
    tap(g, "cw");
    tap(g, "hardDrop");
    expect(g.result).toBe("success");
    expect(free.state).toEqual(saved);
    expect(free.settings).toEqual(settings);
    expect(g.settings).not.toBe(free.settings);
  });
});

describe("T-spin progression", () => {
  it.each([true, false])(
    "step 2 allows entry from spawn with instant soft drop=%s",
    (instantSoftDrop) => {
      const g = new TSpinDrill(1, { ...defaultSettings(), instantSoftDrop }, 2);
      expect(g.state.active).toEqual(spawn("T"));
      tap(g, "left");
      g.keyDown("softDrop");
      g.tick(2000);
      g.keyUp("softDrop");
      expect(g.state.active).toEqual({ type: "T", x: 3, y: 1, rotation: 0 });
      tap(g, "right");
      tap(g, "cw");
      expect(g.result).toBeNull();
      tap(g, "hardDrop");
      expect(g.result).toBe("success");
      g.restart(1);
      tap(g, "hardDrop");
      expect(g.result).toBe("retry");
    },
  );
  it.each([true, false])(
    "builds the documented TKI through normal actions (overhang=%s)",
    (withOverhang) => {
      const g = new TSpinDrill(42, defaultSettings(), 3);
      const initial = structuredClone(g.state);
      expect([g.state.active!.type, ...g.state.queue.slice(0, 6)]).toEqual(
        TKI_BAG,
      );
      expect(g.state.board).toEqual(emptyBoard());
      const shift = (action: "left" | "right", count: number) => {
        for (let i = 0; i < count; i++) tap(g, action);
      };
      tap(g, "hardDrop"); // I horizontal, columns 4–7.
      tap(g, "cw");
      shift("left", 4);
      tap(g, "hardDrop"); // L upright, left wall.
      tap(g, "hardDrop"); // Z makes the overhang above column 4.
      shift("right", 4);
      tap(g, "hardDrop"); // O, right wall.
      tap(g, "cw");
      shift("right", 2);
      tap(g, "hardDrop"); // S beside O.
      shift("right", 4);
      tap(g, "hardDrop"); // J caps right side.
      expect(
        g.state.board
          .slice(0, 4)
          .map((row) => row.map((c) => c ?? ".").join("")),
      ).toEqual(["LL.IIIISOO", "L...ZZSSOO", "L..ZZ.SJJJ", ".......J.."]);
      expect(g.state.active!.type).toBe("T");
      expect(g.result).toBeNull();
      if (!withOverhang) g.state.board[2][3] = null;
      tap(g, "ccw");
      shift("left", 2);
      tap(g, "softDrop");
      expect(g.state.active).toEqual({ type: "T", x: 2, y: 1, rotation: 3 });
      tap(g, "ccw");
      expect(g.state.active).toEqual({ type: "T", x: 2, y: 1, rotation: 2 });
      tap(g, "hardDrop");
      expect(g.state.lastEvent?.label).toBe(
        withOverhang ? "T-spin Double" : "Double",
      );
      expect(g.state.fullTSpins).toBe(withOverhang ? 1 : 0);
      expect(g.result).toBe(withOverhang ? "success" : null);
      g.restart(999);
      expect(g.state).toEqual(initial);
      // After the opening, the continuation still consists of intact 7-bags.
      const continuation = g.state.queue.slice(6);
      for (let i = 0; i < continuation.length; i += 7)
        expect([...continuation.slice(i, i + 7)].sort()).toEqual(
          [...TYPES].sort(),
        );
    },
  );
  it("step 4 counts three full spins, ignores minis/ordinary locks and rolls back progress with undo", () => {
    const g = new TSpinDrill(42, defaultSettings(), 4);
    const fixture = new TSpinDrill(1).state;
    const prepare = () => {
      g.state.board = structuredClone(fixture.board);
      g.state.active = { ...fixture.active! };
    };
    const spin = (rotation: "cw" | "ccw") => {
      prepare();
      tap(g, rotation);
      tap(g, "hardDrop");
    };
    expect(g.state.board).toEqual(emptyBoard());
    spin("cw");
    expect(g.state.fullTSpins).toBe(1);
    expect(g.result).toBeNull();
    g.undo();
    expect(g.state.fullTSpins).toBe(0);
    spin("cw");
    spin("ccw");
    expect(g.state.fullTSpins).toBe(1);
    expect(g.result).toBeNull();
    prepare();
    tap(g, "hardDrop");
    expect(g.state.fullTSpins).toBe(1);
    expect(g.result).toBeNull();
    spin("cw");
    expect(g.result).toBeNull();
    spin("cw");
    expect(g.state.fullTSpins).toBe(3);
    expect(g.result).toBe("success");
    g.resume();
    tap(g, "hardDrop");
    g.undo();
    expect(g.state.fullTSpins).toBe(3);
    g.restart(43);
    expect(g.state.fullTSpins).toBe(0);
    expect(g.result).toBeNull();
  });
  it("steps 3 and 4 permit hold, and top-out ends an unfinished attempt", () => {
    for (const step of [3, 4] as const) {
      const g = new TSpinDrill(1, defaultSettings(), step);
      const first = g.state.active!.type;
      tap(g, "hold");
      expect(g.state.hold).toBe(first);
      g.state.board[21][4] = "X";
      g.state.active = { type: "O", x: 0, y: 0, rotation: 0 };
      tap(g, "hardDrop");
      expect(g.result).toBe("retry");
      expect(g.state.status).toBe("over");
      g.restart(2);
      expect(g.result).toBeNull();
      expect(g.state.hold).toBeNull();
    }
    const a = new TSpinDrill(1, defaultSettings(), 4),
      b = new TSpinDrill(2, defaultSettings(), 4);
    expect([a.state.active?.type, ...a.state.queue]).not.toEqual([
      b.state.active?.type,
      ...b.state.queue,
    ]);
    expect([a.state.active!.type, ...a.state.queue.slice(0, 6)].sort()).toEqual(
      [...TYPES].sort(),
    );
  });
});
