import { describe, expect, it } from "vitest";
import { emptyBoard } from "../src/core/board";
import type { Tetromino } from "../src/core/board";
import { builtSpinsWork, mirroredOpener, OPENERS, openerById, openerFor, solveBags, supportedBags, trackProblem } from "../src/core/openers";
import type { OpenerDef } from "../src/core/openers";
import { rowsToCells } from "../src/core/position";
import { planGuide } from "./support/guidePlan";
import { lockings, perfectClear } from "./support/search";

const tki = openerById("tki-opener")!;
const dt = openerById("dt-cannon")!;
const pco = openerById("pc-opener")!;

describe("supported first bags", () => {
  it("includes the canonical orders and only real permutations", () => {
    for (const def of OPENERS)
      for (const instant of [false, true]) {
        const bags = supportedBags(def, instant);
        for (const c of def.canonical) expect(bags).toContain(c);
        for (const b of bags) expect(new Set(b).size).toBe(7);
      }
  });

  it("finds TKI bags beyond the canonical one, and rejects a bag that blocks", () => {
    for (const instant of [false, true]) {
      const bags = supportedBags(tki, instant);
      expect(bags.length).toBeGreaterThan(10);
      expect(bags.length).toBeLessThan(5040);
      expect(bags).not.toContain("ZSLOJTI"); // the Z and S rest on the I
    }
  });

  it("drops PCO bags that need a tuck instant soft drop cannot make", () => {
    const stepwise = supportedBags(pco, false);
    const instant = supportedBags(pco, true);
    expect(instant.length).toBeGreaterThan(100);
    expect(stepwise).toContain("IJLOTSZ");
    expect(instant).not.toContain("IJLOTSZ");
    for (const b of instant) expect(stepwise).toContain(b);
  });

  it("matches the committed tables to the solver and answers membership fast", () => {
    for (const def of OPENERS)
      for (const mirror of def.mirror ? [false, true] : [false])
        for (const instant of [false, true]) {
          const d = openerFor(def, mirror);
          expect([...supportedBags(d, instant)].sort(), d.id).toEqual([...solveBags(d, instant)].sort());
        }
  }, 60_000);
});

describe("mirror", () => {
  it("only enables mirrors whose spins and bags work in the engine", () => {
    for (const def of OPENERS) {
      const m = mirroredOpener(def);
      let works: boolean;
      if (def.built) {
        works = builtSpinsWork(m) === true && builtSpinsWork(def) === true;
        if (def.solve) works &&= supportedBags(m, true).includes(m.canonical[0]);
      } else if (def.solve === null) {
        // DT Cannon: build both canonical bags on the sourced guide, spins chain.
        const queue = [...m.canonical[0], ...m.tail.slice(0, 6)] as Tetromino[];
        works = [false, true].every((instant) => planGuide(m, queue, instant) !== null);
      } else {
        // PCO: build the mirrored first bag, then the mirrored second bag clears.
        const want = new Map(rowsToCells(m.guide).map((c) => [`${c.x},${c.y}`, c.char]));
        let board = emptyBoard();
        works = true;
        for (const type of [...m.canonical[0]].filter((t) => t !== "I")) {
          const next = lockings(board, type as Tetromino).find(
            (o) =>
              o.cleared === 0 &&
              o.board.every((row, y) =>
                row.every((c, x) => c === board[y][x] || want.get(`${x},${y}`) === type),
              ),
          );
          if (!next) works = false;
          else board = next.board;
        }
        works &&= works && perfectClear(board, m.tail, "I", 4) !== null;
      }
      expect(def.mirror, def.name).toBe(works);
    }
  });

  it("swaps pieces and columns in the guide", () => {
    const m = mirroredOpener(tki);
    expect(m.guide[0]).toBe("..L.......");
    expect(m.guide[3]).toBe("OOZIIII*JJ");
    expect(m.canonical[0]).toBe("IJSOZLT");
    expect(mirroredOpener(m).guide).toEqual(tki.guide);
  });
});

describe("DT Cannon guide", () => {
  const queue = [...dt.canonical[0], ...dt.tail.slice(0, 6)] as Tetromino[];
  it("keeps sourced cells fixed and does not encode one filler arrangement", () => {
    // Only the cells right of the last piece in the third row are freed.
    expect(dt.guide.slice(0, 3)).toEqual(["..OO......", "..OO......", "...LGGGGGG"]);
    expect(dt.guide[5]).toBe("J***TSSZZG");
    expect(dt.built).toBeNull();
  });
  it("accepts a build on the sourced cells and rejects the slot being filled", () => {
    const plan = planGuide(dt, queue, false)!;
    expect(plan).not.toBeNull();
    const board = plan[plan.length - 1].after;
    expect(trackProblem(dt, board, null, ["T", "T"])).toBeNull();
    const blocked = board.map((r) => [...r]);
    blocked[2][2] = "I"; // a `*` slot cell
    expect(trackProblem(dt, blocked, null, ["T", "T"])).toMatch(/not part of the opener/);
  });
});

describe("fail-fast", () => {
  it("accepts a variant guide and reports a stuck build", () => {
    const simple: OpenerDef = {
      ...tki,
      name: "Test",
      guide: ["OO........"],
      variants: [["........OO"]],
      solve: null,
      goals: [],
    };
    const board = emptyBoard();
    expect(trackProblem(simple, board, null, ["O"])).toBeNull();
    board[0][8] = board[0][9] = "O";
    expect(trackProblem(simple, board, null, ["O"])).toBeNull();
    board[0][0] = "O";
    expect(trackProblem(simple, board, null, ["O"])).toMatch(/not part of the opener/);
    expect(trackProblem(tki, emptyBoard(), null, ["T", "T"], { instantSoftDrop: true })).toMatch(
      /T-slot can't be finished/,
    );
  });
});

describe("goal tracking", () => {
  it("fails DT between the double and the triple when no T is left", () => {
    const board = emptyBoard();
    const ctx = { instantSoftDrop: true, placed: 14, goalIndex: 1, cleared: true };
    expect(trackProblem(dt, board, null, [..."IJLOSZII"] as Tetromino[], ctx)).toMatch(/no T is left/);
    expect(trackProblem(dt, board, null, [..."IJLOSZIT"] as Tetromino[], ctx)).toBeNull();
    expect(trackProblem(dt, board, null, [..."IJLOSZT"] as Tetromino[], ctx)).toBeNull();
    expect(trackProblem(dt, board, "T", [..."IJLOSZI"] as Tetromino[], ctx)).toBeNull();
    // One lock left, empty hold: holding J draws the T without a lock.
    const last = { ...ctx, placed: 20 };
    expect(trackProblem(dt, board, null, [..."JT"] as Tetromino[], last)).toBeNull();
    expect(trackProblem(dt, board, "J", [..."JT"] as Tetromino[], last)).toMatch(/no T is left/);
    // Out of the piece budget with goals still to meet.
    expect(trackProblem(dt, board, "T", ["T"], { ...ctx, placed: 21 })).toMatch(/not enough pieces/);
  });
});
