import { describe, expect, it } from "vitest";
import { cells, emptyBoard, project, spawn, TYPES } from "../src/core/board";
import type { Board, Tetromino } from "../src/core/board";
import { Game } from "../src/core/game";
import { defaultSettings } from "../src/core/settings";
import type { Action, Settings } from "../src/core/settings";

function game(settings: Partial<Settings> = {}) {
  return new Game(12345, { ...defaultSettings(), ...settings });
}
function tap(g: Game, action: Action) {
  g.keyDown(action);
  g.keyUp(action);
}
function field(rows: string[]): Board {
  const board = emptyBoard();
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      board[y][x] = cell === "#" ? "X" : null;
    }),
  );
  return board;
}
function sequence(seed: number): Tetromino[] {
  const g = new Game(seed);
  return Array.from({ length: 70 }, () => {
    const type = g.state.active!.type;
    g.state.board = emptyBoard();
    tap(g, "hardDrop");
    return type;
  });
}

describe("free-play session", () => {
  it("draws reproducible shuffled seven-piece bags, including seed zero", () => {
    const drawn = sequence(0);
    expect(sequence(0)).toEqual(drawn);
    expect(sequence(1)).not.toEqual(drawn);
    for (let i = 0; i < drawn.length; i += 7)
      expect(drawn.slice(i, i + 7).sort()).toEqual([...TYPES].sort());
  });

  it("permits one hold per piece and resets its position and orientation on swap", () => {
    const g = game();
    const initial = g.state.active!.type;
    const next = g.state.queue[0];
    tap(g, "hold");
    expect(g.state.hold).toBe(initial);
    expect(g.state.active).toEqual(spawn(next));
    const afterHold = structuredClone(g.state);
    tap(g, "hold");
    expect(g.state).toEqual(afterHold);
    tap(g, "hardDrop");
    const outgoing = g.state.active!.type;
    const queue = [...g.state.queue];
    tap(g, "cw");
    tap(g, "left");
    tap(g, "hold");
    expect(g.state.active).toEqual(spawn(initial));
    expect(g.state.hold).toBe(outgoing);
    expect(g.state.queue).toEqual(queue);
    expect(g.state.canHold).toBe(false);
  });

  it("never applies gravity or automatic locking, including while touching the floor", () => {
    const g = game();
    const initial = structuredClone(g.state);
    g.tick(60_000);
    expect(g.state).toEqual(initial);
    g.state.active = { type: "T", x: 4, y: 0, rotation: 0 };
    const grounded = structuredClone(g.state);
    g.tick(60_000);
    expect(g.state).toEqual(grounded);
    tap(g, "right");
    expect(g.state.active!.x).toBe(5);
    expect(g.state.pieces).toBe(0);
  });

  it("locks exactly the projected ghost cells once per hard-drop press", () => {
    const g = game();
    g.state.active = spawn("T");
    const landing = project(g.state.board, g.state.active);
    g.keyDown("hardDrop");
    expect(g.state.pieces).toBe(1);
    for (const [x, y] of cells(landing)) expect(g.state.board[y][x]).toBe("T");
    expect(g.state.board.flat().filter(Boolean)).toHaveLength(4);
    const once = structuredClone(g.state);
    g.keyDown("hardDrop");
    expect(g.state).toEqual(once);
    g.keyUp("hardDrop");
    g.keyDown("hardDrop");
    expect(g.state.pieces).toBe(2);
  });

  it("instant soft drop grounds pieces without locking and stays active after movement", () => {
    const g = game({ instantSoftDrop: true });
    g.state.active = spawn("T");
    g.state.board[0][4] = "X";
    g.keyDown("softDrop");
    expect(g.state.active!.y).toBe(1);
    tap(g, "right");
    tap(g, "right");
    expect(g.state.active).toEqual({ type: "T", x: 6, y: 0, rotation: 0 });
    g.tick(10_000);
    expect(g.state.pieces).toBe(0);
    expect(g.state.board.flat().filter(Boolean)).toHaveLength(1);
  });

  it("finite soft drop moves immediately, then at exact speed boundaries without locking", () => {
    const g = game({ instantSoftDrop: false, softDropSpeed: 20 });
    g.state.active = spawn("T");
    g.keyDown("softDrop");
    expect(g.state.active!.y).toBe(20);
    g.tick(49);
    expect(g.state.active!.y).toBe(20);
    g.tick(1);
    expect(g.state.active!.y).toBe(19);
    g.tick(5000);
    expect(g.state.active!.y).toBe(0);
    expect(g.state.pieces).toBe(0);
    g.keyUp("softDrop");
    g.state.active = spawn("T");
    g.tick(1000);
    expect(g.state.active).toEqual(spawn("T"));
  });

  it("stops at blocked spawn and ignores subsequent gameplay input", () => {
    const g = game();
    g.state.active = { ...spawn("O"), x: 8 };
    g.state.queue[0] = "T";
    g.state.board[21][4] = "X";
    tap(g, "hardDrop");
    expect(g.state.status).toBe("over");
    expect(g.state.active).toBeNull();
    const over = structuredClone(g.state);
    tap(g, "hold");
    tap(g, "hardDrop");
    g.tick(1000);
    expect(g.state).toEqual(over);
  });

  it("pause, resume, configuration, and restart clear stale held inputs and timers", () => {
    const g = game({ instantSoftDrop: false });
    g.keyDown("left");
    g.keyDown("softDrop");
    g.pause();
    const paused = structuredClone(g.state);
    g.tick(1000);
    tap(g, "right");
    expect(g.state).toEqual(paused);
    g.resume();
    const resumed = structuredClone(g.state);
    g.tick(1000);
    expect(g.state).toEqual(resumed);
    g.keyDown("right");
    g.configure({ ...g.settings, arr: 30 });
    const configured = structuredClone(g.state);
    g.tick(1000);
    expect(g.state).toEqual(configured);
    tap(g, "hold");
    tap(g, "hardDrop");
    g.keyDown("left");
    g.keyDown("softDrop");
    g.restart(0);
    expect(g.state).toEqual(new Game(0, g.settings).state);
    expect(g.settings.arr).toBe(30);
    const restarted = structuredClone(g.state);
    g.tick(1000);
    expect(g.state).toEqual(restarted);
  });
});

describe("handling timeline", () => {
  it("honors exact DAS and ARR boundaries and ignores repeated keydown", () => {
    const g = game({ das: 100, arr: 20 });
    g.state.active = spawn("T");
    g.keyDown("left");
    expect(g.state.active!.x).toBe(3);
    g.tick(99);
    g.keyDown("left");
    expect(g.state.active!.x).toBe(3);
    g.tick(1);
    expect(g.state.active!.x).toBe(2);
    g.tick(19);
    expect(g.state.active!.x).toBe(2);
    g.tick(1);
    expect(g.state.active!.x).toBe(1);
    g.keyUp("left");
    g.tick(1000);
    expect(g.state.active!.x).toBe(1);
  });

  it("supports ARR zero at DAS and both DAS/ARR zero on initial keydown", () => {
    const g = game({ das: 100, arr: 0 });
    g.state.active = spawn("T");
    g.keyDown("right");
    g.tick(99);
    expect(g.state.active!.x).toBe(5);
    g.tick(1);
    expect(g.state.active!.x).toBe(8);
    g.configure({ ...g.settings, das: 0 });
    g.keyDown("left");
    expect(g.state.active!.x).toBe(1);
  });

  it("uses the most recent horizontal press and recharges the remaining direction on release", () => {
    const g = game({ das: 100, arr: 20 });
    g.state.active = spawn("T");
    g.keyDown("left");
    g.tick(50);
    g.keyDown("right");
    expect(g.state.active!.x).toBe(4);
    g.tick(99);
    expect(g.state.active!.x).toBe(4);
    g.tick(1);
    expect(g.state.active!.x).toBe(5);
    g.keyUp("right");
    expect(g.state.active!.x).toBe(4);
    g.tick(99);
    expect(g.state.active!.x).toBe(4);
    g.tick(1);
    expect(g.state.active!.x).toBe(3);
  });

  it("preserves charged movement across hard drop and hold when DCD is zero", () => {
    const g = game({ das: 100, arr: 0, dcd: 0 });
    g.state.active = spawn("T");
    g.state.queue[0] = "T";
    g.state.queue[1] = "T";
    g.keyDown("left");
    g.tick(100);
    expect(g.state.active!.x).toBe(1);
    tap(g, "hardDrop");
    expect(g.state.active!.x).toBe(1);
    tap(g, "hold");
    expect(g.state.active!.x).toBe(1);
    expect(g.state.canHold).toBe(false);
  });

  it("continues finite soft-drop timing across a spawn", () => {
    const g = game({ instantSoftDrop: false, softDropSpeed: 20 });
    g.state.active = spawn("T");
    g.state.queue[0] = "T";
    g.keyDown("softDrop");
    g.tick(25);
    tap(g, "hardDrop");
    expect(g.state.active!.y).toBe(21);
    g.tick(24);
    expect(g.state.active!.y).toBe(21);
    g.tick(1);
    expect(g.state.active!.y).toBe(20);
  });

  it("DCD delays movement after wall contact and spawn, but not ordinary rotations", () => {
    const wall = game({ das: 100, arr: 0, dcd: 50 });
    wall.state.active = spawn("T");
    wall.state.queue[0] = "T";
    wall.keyDown("left");
    wall.tick(100);
    tap(wall, "hardDrop");
    expect(wall.state.active!.x).toBe(4);
    wall.tick(49);
    expect(wall.state.active!.x).toBe(4);
    wall.tick(1);
    expect(wall.state.active!.x).toBe(1);

    const open = game({ das: 100, arr: 20, dcd: 50 });
    open.state.active = spawn("T");
    open.keyDown("left");
    open.tick(110);
    tap(open, "cw");
    open.tick(9);
    expect(open.state.active!.x).toBe(2);
    open.tick(1);
    expect(open.state.active!.x).toBe(1);
  });

  it("DCD uses a failed horizontal attempt, then permits rotation away from the wall", () => {
    const g = game({ das: 100, arr: 20, dcd: 50 });
    g.state.active = spawn("T");
    g.keyDown("left");
    g.tick(140); // Steps at 100 and 120; the attempted step at 140 hits the wall.
    tap(g, "cw");
    expect(g.state.active!.x).toBe(1);
    g.tick(49);
    expect(g.state.active!.x).toBe(1);
    g.tick(1);
    expect(g.state.active!.x).toBe(0);
  });

  it("produces identical state for the same input timeline under different frame schedules", () => {
    const events: [number, Action, boolean][] = [
      [0, "left", true],
      [41, "softDrop", true],
      [125, "cw", true],
      [126, "cw", false],
      [210, "left", false],
      [222, "hardDrop", true],
      [223, "hardDrop", false],
      [280, "right", true],
      [335, "hold", true],
      [336, "hold", false],
      [410, "right", false],
      [490, "flip", true],
      [491, "flip", false],
      [600, "softDrop", false],
      [625, "hardDrop", true],
      [626, "hardDrop", false],
    ];
    function simulate(frames: number[]) {
      const g = game({
        das: 100,
        arr: 17,
        dcd: 25,
        instantSoftDrop: false,
        softDropSpeed: 40,
      });
      let now = 0;
      let frame = 0;
      for (const [at, action, down] of events) {
        while (now < at) {
          const dt = Math.min(frames[frame++ % frames.length], at - now);
          g.tick(dt);
          now += dt;
        }
        if (down) g.keyDown(action);
        else g.keyUp(action);
      }
      g.tick(1000 - now);
      return g.state;
    }
    expect(simulate([1])).toEqual(simulate([16, 17]));
    expect(simulate([250])).toEqual(simulate([16, 17]));
  });

  it("rejects invalid elapsed time without changing state", () => {
    const g = game();
    const initial = structuredClone(g.state);
    for (const dt of [-1, NaN, Infinity]) expect(() => g.tick(dt)).toThrow();
    expect(g.state).toEqual(initial);
  });
});

describe("spin placements through real runtime actions", () => {
  it.each([false, true])(
    "performs a T-spin triple (mirrored: %s)",
    (mirrored) => {
      const g = game({ instantSoftDrop: true });
      const rows = [
        "####.#####",
        "####..####",
        "####.#####",
        "..........",
        "....#.....",
      ];
      g.state.board = field(
        mirrored ? rows.map((row) => [...row].reverse().join("")) : rows,
      );
      g.state.active = spawn("T");
      // Enter beside the roof before sliding underneath; dropping over it cannot reach the cavity.
      for (let i = 0; i < (mirrored ? 2 : 3); i++)
        tap(g, mirrored ? "left" : "right");
      g.keyDown("softDrop");
      tap(g, mirrored ? "right" : "left");
      tap(g, mirrored ? "right" : "left");
      expect(g.state.active).toEqual({
        type: "T",
        x: mirrored ? 4 : 5,
        y: 3,
        rotation: 0,
      });
      tap(g, mirrored ? "ccw" : "cw");
      expect(g.state.active).toEqual({
        type: "T",
        x: mirrored ? 5 : 4,
        y: 1,
        rotation: mirrored ? 3 : 1,
      });
      tap(g, "hardDrop");
      expect(g.state.lastClear).toBe(3);
      expect(g.state.lines).toBe(3);
      expect(g.state.pieces).toBe(1);
    },
  );

  it.each(["S", "Z"] as const)(
    "performs the %s spin double with held instant soft drop",
    (type) => {
      const g = game({ instantSoftDrop: true });
      const rows = ["###..#####", "####..####"];
      g.state.board = field(
        type === "Z" ? rows.map((row) => [...row].reverse().join("")) : rows,
      );
      g.state.active = { ...spawn(type), x: type === "S" ? 3 : 6 };
      const rotation = type === "S" ? "cw" : "ccw";
      tap(g, rotation);
      g.keyDown("softDrop");
      expect(g.state.active).toEqual({
        type,
        x: type === "S" ? 3 : 6,
        y: 2,
        rotation: type === "S" ? 1 : 3,
      });
      tap(g, rotation);
      expect(g.state.active).toEqual({
        type,
        x: type === "S" ? 4 : 5,
        y: 1,
        rotation: 2,
      });
      tap(g, "hardDrop");
      expect(g.state.lastClear).toBe(2);
      expect(g.state.lines).toBe(2);
    },
  );
});

describe("additional acceptance regressions", () => {
  it.each(["S", "Z"] as const)(
    "performs a walled %s spin double in the opposite direction",
    (type) => {
      const g = game({ instantSoftDrop: true });
      const rows = ["###..#####", "####..####", "...#..#..."];
      g.state.board = field(
        type === "Z" ? rows.map((row) => [...row].reverse().join("")) : rows,
      );
      g.state.active = { ...spawn(type), x: type === "S" ? 5 : 4 };
      const action = type === "S" ? "ccw" : "cw";
      tap(g, action);
      g.keyDown("softDrop");
      tap(g, action);
      expect(g.state.active).toEqual({
        type,
        x: type === "S" ? 4 : 5,
        y: 1,
        rotation: 2,
      });
      tap(g, "hardDrop");
      expect(g.state.lastClear).toBe(2);
    },
  );
  it.each(["S", "Z"] as const)(
    "does not let the wrong %s rotation tunnel through the stack",
    (type) => {
      const g = game({ instantSoftDrop: true });
      const rows = ["###..#####", "####..####"];
      g.state.board = field(
        type === "Z" ? rows.map((row) => [...row].reverse().join("")) : rows,
      );
      g.state.active = { ...spawn(type), x: type === "S" ? 3 : 6 };
      const action = type === "S" ? "ccw" : "cw";
      tap(g, action);
      g.keyDown("softDrop");
      tap(g, action);
      tap(g, "hardDrop");
      expect(g.state.lastClear).toBe(0);
    },
  );
  it.each([0, 8])(
    "survives locking entirely above the visible field at side x=%i",
    (x) => {
      const g = game();
      g.state.board[19][x] = "X";
      g.state.board[19][x + 1] = "X";
      g.state.active = { ...spawn("O"), x };
      g.state.queue[0] = "T";
      tap(g, "hardDrop");
      expect(g.state.board[20][x]).toBe("O");
      expect(g.state.board[21][x]).toBe("O");
      expect(g.state.pieces).toBe(1);
      expect(g.state.status).toBe("playing");
      expect(g.state.active).toEqual(spawn("T"));
    },
  );

  it("clears rows before testing whether the next piece can spawn", () => {
    const g = game();
    g.state.board[20][8] = "X";
    g.state.board[20][9] = "X";
    g.state.board[21].fill("X", 0, 8);
    g.state.active = { ...spawn("O"), x: 8 };
    g.state.queue[0] = "T";
    tap(g, "hardDrop");
    expect(g.state.lastClear).toBe(1);
    expect(g.state.status).toBe("playing");
    expect(g.state.active).toEqual(spawn("T"));
  });

  it.each([null, "T"] as const)(
    "still tops out if hold cannot spawn normally (held=%s)",
    (held) => {
      const g = game();
      g.state.active = { ...spawn("O"), x: 8 };
      g.state.hold = held;
      g.state.queue[0] = "T";
      g.state.board[21][4] = "X";
      tap(g, "hold");
      expect(g.state.status).toBe("over");
      expect(g.state.active).toBeNull();
    },
  );
});

describe("session clock and clear indicators", () => {
  it("counts playing time, pauses during breaks/game over, and resets on restart", () => {
    const g = game();
    g.tick(1250);
    expect(g.elapsedMs).toBe(1250);
    g.pause();
    g.tick(90_000);
    expect(g.elapsedMs).toBe(1250);
    g.resume();
    g.tick(750);
    expect(g.elapsedMs).toBe(2000);
    g.state.active = { ...spawn("O"), x: 8 };
    g.state.queue[0] = "T";
    g.state.board[21][4] = "X";
    tap(g, "hardDrop");
    expect(g.state.status).toBe("over");
    g.tick(5000);
    expect(g.elapsedMs).toBe(2000);
    g.restart(123);
    expect(g.elapsedMs).toBe(0);
    expect(g.state.lastEvent).toBeNull();
  });

  it.each(["Single", "Double", "Triple", "Quad"])(
    "labels a %s from the actual cleared rows",
    (label) => {
      const g = game();
      const count = ["Single", "Double", "Triple", "Quad"].indexOf(label) + 1;
      g.state.board = field(Array(count).fill("#####.####"));
      g.state.active = { type: "I", x: 4, y: 21, rotation: 1 };
      tap(g, "hardDrop");
      expect(g.state.lastEvent).toEqual({ id: 1, label, tspin: false });
      expect(g.state.lines).toBe(count);
      // A non-clearing piece preserves the most recent event; a repeated clear gets a fresh ID.
      tap(g, "hardDrop");
      expect(g.state.lastEvent?.id).toBe(1);
      g.state.board = field(Array(count).fill("#####.####"));
      g.state.active = { type: "I", x: 4, y: 21, rotation: 1 };
      tap(g, "hardDrop");
      expect(g.state.lastEvent).toEqual({ id: 3, label, tspin: false });
    },
  );

  it("recognizes a zero-line T-spin and ignores unsuccessful moves after rotation", () => {
    const g = game();
    g.state.board = field(["...#.#....", "..........", "...#......"]);
    g.state.active = { type: "T", x: 4, y: 1, rotation: 0 };
    tap(g, "cw");
    tap(g, "left");
    tap(g, "softDrop");
    tap(g, "hardDrop");
    expect(g.state.lastEvent?.label).toBe("T-spin");
    expect(g.state.lastClear).toBe(0);
  });

  it("does not count a rotated T dropped from above, or a translation away and back", () => {
    const g = game();
    g.state.board = field(["...#.#....", "..........", "...#......"]);
    g.state.active = spawn("T");
    tap(g, "cw");
    tap(g, "hardDrop");
    expect(g.state.lastEvent).toBeNull();
    g.state.board = field(["...#.#....", "..........", "...#......"]);
    g.state.active = { type: "T", x: 4, y: 1, rotation: 1 };
    tap(g, "ccw");
    tap(g, "right");
    tap(g, "left");
    tap(g, "hardDrop");
    expect(g.state.lastEvent).toBeNull();
  });

  it.each([false, true])(
    "labels the mirrored T-spin triple correctly (mirror=%s)",
    (mirrored) => {
      const g = game();
      const rows = [
        "####.#####",
        "####..####",
        "####.#####",
        "..........",
        "....#.....",
      ];
      g.state.board = field(
        mirrored ? rows.map((row) => [...row].reverse().join("")) : rows,
      );
      g.state.active = { type: "T", x: mirrored ? 4 : 5, y: 3, rotation: 0 };
      tap(g, mirrored ? "ccw" : "cw");
      tap(g, "hardDrop");
      expect(g.state.lastEvent).toEqual({
        id: 1,
        label: "T-spin Triple",
        tspin: true,
      });
    },
  );
});

describe("combo and B2B chains", () => {
  function clear(g: Game, rows: number, spin = false) {
    if (spin) {
      // Fifth-kick T-spin entry. Remove a distant cell from rows that should not clear.
      const fieldRows = [
        "####.#####",
        "####..####",
        "####.#####",
        "..........",
        "....#.....",
      ];
      for (let y = rows; y < 3; y++) fieldRows[y] = "." + fieldRows[y].slice(1);
      g.state.board = field(fieldRows);
      g.state.active = { type: "T", x: 5, y: 3, rotation: 0 };
      tap(g, "cw");
    } else {
      g.state.board = field(Array(rows).fill("#####.####"));
      g.state.active = { type: "I", x: 4, y: 21, rotation: 1 };
    }
    tap(g, "hardDrop");
    expect(g.state.lastClear).toBe(rows);
    if (spin) expect(g.state.lastEvent?.tspin).toBe(true);
  }

  it("chains all clear sizes and resets combo on a non-clearing placement", () => {
    const g = game();
    expect(g.state.combo).toBe(-1);
    for (const [index, rows] of [1, 2, 3, 4].entries()) {
      clear(g, rows);
      expect(g.state.combo).toBe(index);
    }
    clear(g, 0);
    expect(g.state.combo).toBe(-1);
    clear(g, 2, true);
    expect(g.state.combo).toBe(0);
    clear(g, 1, true);
    expect(g.state.combo).toBe(1);
    clear(g, 0, true);
    expect(g.state.combo).toBe(-1);
  });

  it("mixes quads and T-spin singles/doubles, preserving B2B over empty placements", () => {
    const g = game();
    clear(g, 4);
    expect(g.state.b2b).toBe(0);
    clear(g, 0);
    expect(g.state.b2b).toBe(0);
    clear(g, 1, true);
    expect(g.state.b2b).toBe(1);
    clear(g, 0, true);
    expect(g.state.b2b).toBe(1);
    clear(g, 2, true);
    expect(g.state.b2b).toBe(2);
    clear(g, 4);
    expect(g.state.b2b).toBe(3);
  });

  it.each([1, 2, 3])(
    "breaks B2B on an ordinary %i-line clear while combo continues",
    (rows) => {
      const g = game();
      clear(g, 4);
      clear(g, 4);
      expect(g.state.b2b).toBe(1);
      clear(g, rows);
      expect(g.state.b2b).toBe(-1);
      expect(g.state.combo).toBe(2);
      clear(g, 4);
      expect(g.state.b2b).toBe(0);
    },
  );

  it("T-spin triples start and extend B2B alongside other qualifying clears", () => {
    const g = game();
    clear(g, 3, true);
    expect(g.state.b2b).toBe(0);
    clear(g, 4);
    expect(g.state.b2b).toBe(1);
    clear(g, 3, true);
    expect(g.state.b2b).toBe(2);
    clear(g, 0);
    expect(g.state.b2b).toBe(2);
    clear(g, 3, true);
    expect(g.state.b2b).toBe(3);
    clear(g, 2, true);
    expect(g.state.b2b).toBe(4);
  });

  it("preserves chains through hold, pause, settings, and failed inputs; restart resets them", () => {
    const g = game();
    clear(g, 4);
    clear(g, 4);
    tap(g, "hold");
    tap(g, "hold");
    tap(g, "cw");
    g.pause();
    g.tick(1000);
    tap(g, "hardDrop");
    g.configure(g.settings);
    g.resume();
    expect(g.state.combo).toBe(1);
    expect(g.state.b2b).toBe(1);
    g.restart(0);
    expect(g.state.combo).toBe(-1);
    expect(g.state.b2b).toBe(-1);
  });
});

describe("undo", () => {
  it("restores placements, hold, queue and future bags repeatedly without rewinding the clock", () => {
    const g = game();
    const snapshots: ReturnType<typeof structuredClone<typeof g.state>>[] = [];
    const finished: (typeof g.state)[] = [];
    g.undo();
    expect(g.canUndo).toBe(false);
    for (let i = 0; i < 18; i++) {
      g.state.board = emptyBoard();
      if (i % 3 === 0) tap(g, "hold");
      tap(g, "cw");
      tap(g, "right");
      snapshots.push(structuredClone(g.state));
      tap(g, "hardDrop");
      finished.push(structuredClone(g.state));
    }
    g.tick(1234);
    for (let i = snapshots.length - 1; i >= 0; i--) {
      expect(g.canUndo).toBe(true);
      g.undo();
      expect(g.state).toEqual({
        ...snapshots[i],
        active: spawn(snapshots[i].active!.type),
      });
      tap(g, "cw");
      tap(g, "right");
      // Replaying across a bag refill must regenerate the identical queue.
      tap(g, "hardDrop");
      expect(g.state).toEqual(finished[i]);
      g.undo();
    }
    expect(g.elapsedMs).toBe(1234);
    expect(g.canUndo).toBe(false);
    const first = structuredClone(g.state);
    g.undo();
    expect(g.state).toEqual(first);
  });

  it("undoes a T-spin to the normal spawn and lets the player retry the spin", () => {
    const g = game();
    g.state.board = field([
      "####.#####",
      "####..####",
      "####.#####",
      "..........",
      "....#.....",
    ]);
    g.state.active = { type: "T", x: 5, y: 3, rotation: 0 };
    g.state.combo = 3;
    g.state.b2b = 2;
    tap(g, "cw");
    const before = structuredClone(g.state);
    tap(g, "hardDrop");
    const after = structuredClone(g.state);
    expect(after.lastEvent?.label).toBe("T-spin Triple");
    expect(after.combo).toBe(4);
    expect(after.b2b).toBe(3);
    g.keyDown("softDrop");
    g.undo();
    expect(g.state).toEqual({ ...before, active: spawn("T") });
    g.tick(1000);
    expect(g.state.active).toEqual(spawn("T"));
    // Repeat the real entry from spawn, not the final rotated pose.
    for (let i = 0; i < 3; i++) tap(g, "right");
    tap(g, "softDrop");
    tap(g, "left");
    tap(g, "left");
    tap(g, "cw");
    tap(g, "hardDrop");
    expect(g.state).toEqual(after);
  });

  it("recovers from top-out, clears held input, preserves pause/settings, and resets history on restart", () => {
    const g = game();
    g.state.active = { ...spawn("O"), x: 8 };
    g.state.queue[0] = "T";
    g.state.board[21][3] = "X";
    const before = structuredClone(g.state);
    tap(g, "hardDrop");
    expect(g.state.status).toBe("over");
    g.undo();
    expect(g.state).toEqual({ ...before, active: spawn("O") });
    g.state.board = emptyBoard();
    tap(g, "hardDrop");
    g.keyDown("left");
    g.keyDown("softDrop");
    g.undo();
    const restored = structuredClone(g.state);
    g.tick(1000);
    expect(g.state).toEqual(restored);
    tap(g, "hardDrop");
    g.pause();
    g.configure({ ...g.settings, das: 125 });
    g.undo();
    expect(g.state.status).toBe("paused");
    expect(g.settings.das).toBe(125);
    g.resume();
    tap(g, "hardDrop");
    g.restart(22);
    expect(g.canUndo).toBe(false);
    const restarted = structuredClone(g.state);
    g.undo();
    expect(g.state).toEqual(restarted);
  });
});
