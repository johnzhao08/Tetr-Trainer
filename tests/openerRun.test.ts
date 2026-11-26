import { describe, expect, it } from "vitest";
import type { Tetromino } from "../src/core/board";
import { CONTINUATION_PIECES, OpenerRun } from "../src/core/openerRun";
import { buildPlan, mirroredOpener, openerById, openerFor, perfectClearRoute, supportedBags } from "../src/core/openers";
import type { OpenerDef } from "../src/core/openers";
import { rowsToCells } from "../src/core/position";
import { defaultSettings, type Action } from "../src/core/settings";
import { findPlacements, findSpins, pathToInputs } from "../src/core/spins";
import type { Placement } from "../src/core/spins";
import { planGuide } from "./support/guidePlan";

const tki = openerById("tki-opener")!;
const dt = openerById("dt-cannon")!;
const pco = openerById("pc-opener")!;
const settings = { ...defaultSettings(), instantSoftDrop: false };
const instantSettings = { ...defaultSettings(), instantSoftDrop: true };

/** Plays a placement with the keys of the given handling; they must be exact. */
function play(run: OpenerRun, type: Tetromino, p: Placement, s = settings) {
  const { inputs, exact } = pathToInputs(run.state.board, type, p.path, s);
  expect(exact).toBe(true);
  for (const a of [...inputs, "hardDrop" as const]) tap(run, a);
}

/** Drops the piece in play onto its cells in the guide; false if it has none. */
function dropOnGuide(run: OpenerRun, s = settings): boolean {
  const type = run.state.active!.type;
  const want = new Set(
    rowsToCells(run.def.guide)
      .filter((c) => c.char === type)
      .map((c) => `${c.x},${c.y}`),
  );
  const board = run.state.board;
  const hit = findPlacements(board, type, s).find(
    (p) =>
      p.lines === 0 &&
      p.after.every((row, y) =>
        row.every((c, x) => c === board[y][x] || want.has(`${x},${y}`)),
      ) &&
      want.size > 0,
  );
  if (!hit) return false;
  play(run, type, hit, s);
  return true;
}

const tap = (r: OpenerRun, a: Action) => {
  r.keyDown(a);
  r.keyUp(a);
};
const run = (def: OpenerDef, bag: string, s = settings, seed = 7) =>
  new OpenerRun(seed, s, def, bag);
/** Plays the plan that builds the first bag; the run stays in the build stage. */
function buildFirstBag(def: OpenerDef, bag: string, s: typeof settings) {
  const r = run(def, bag, s);
  const plan = buildPlan(def, def.guide, r.state.board, null, [...bag] as Tetromino[], s.instantSoftDrop)!;
  for (const move of plan) {
    if (move === "hold") tap(r, "hold");
    else expect(dropOnGuide(r, s), bag).toBe(true);
    expect(r.stage, bag).toBe("build");
  }
  return r;
}
const modes = [
  { name: "stepwise", s: settings },
  { name: "instant", s: instantSettings },
];

describe("sampled first bags", () => {
  it("plays sampled supported bags through the engine to the spin", () => {
    for (const { s } of modes)
      for (const def of [tki, mirroredOpener(tki)])
        for (const bag of supportedBags(def, s.instantSoftDrop).filter((_, i) => i % 211 === 0)) {
          const r = buildFirstBag(def, bag, s);
          expect(r.state.pieces, bag).toBe(6);
          const spin = findSpins(r.state.board, "T", s).find((m) => m.lines === 2 && m.spin === "full");
          expect(spin, bag).toBeDefined();
          expect(pathToInputs(r.state.board, "T", spin!.path, s).exact, bag).toBe(true);
        }
  });
});

describe("fail-fast", () => {
  it("does not fire while the build follows the guide", () => {
    const r = run(tki, "ILZOSJT");
    for (let i = 0; i < 6; i++) expect(dropOnGuide(r)).toBe(true);
    expect(r.stage).toBe("build");
    expect(r.reason).toBeNull();
  });

  it("ends the attempt on an off-guide placement with a clear reason", () => {
    const r = run(tki, "ILZOSJT");
    expect(dropOnGuide(r)).toBe(true); // I
    tap(r, "hardDrop"); // L straight down the middle
    expect(r.stage).toBe("failed");
    expect(r.reason).toMatch(/This placement doesn't fit TKI/);
    expect(r.built).toBe(false);
    expect(r.goalsMet).toBe(0);
  });

  it("ends the attempt when the spin can no longer be finished", () => {
    // Holding the T away and sending it down early costs the slot.
    const r = run(tki, "TILZOSJ");
    tap(r, "hardDrop");
    expect(r.stage).toBe("failed");
  });

  it("fails TKI when the T clears a single with no T left", () => {
    let checked = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = run(tki, "ILZOSJT", settings, seed);
      for (let i = 0; i < 6; i++) expect(dropOnGuide(r)).toBe(true);
      const single = findPlacements(r.state.board, "T").find((p) => p.lines === 1)!;
      expect(single).toBeDefined();
      // An empty hold also reaches the piece after the next one.
      const next = r.state.hold === null ? r.state.queue.slice(0, 2) : r.state.queue.slice(0, 1);
      play(r, "T", single);
      expect(r.state.lines).toBe(1);
      if (next.includes("T")) expect(r.stage).toBe("build");
      else {
        expect(r.stage, `seed ${seed}`).toBe("failed");
        expect(r.reason).toMatch(/no T is left/);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("continuation", () => {
  it("scores two bags with APP and coach bands after the opener spin", () => {
    const r = run(tki, "ILZOSJT");
    for (let i = 0; i < 6; i++) dropOnGuide(r);
    const tsd = findSpins(r.state.board, "T").find((m) => m.lines === 2 && m.spin === "full")!;
    const keys = pathToInputs(r.state.board, "T", tsd.path, settings).inputs;
    for (const a of [...keys, "hardDrop" as const]) tap(r, a);
    expect(r.stage).toBe("continue");
    expect(r.built).toBe(true);
    expect(r.buildMs).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < CONTINUATION_PIECES; i++) {
      expect(r.stage).toBe("continue");
      const side = i % 2 ? "right" : "left";
      for (let n = 0; n < 1 + (i % 4); n++) tap(r, side);
      tap(r, "hardDrop");
    }
    expect(r.stage).toBe("done");
    expect(r.continuationPieces).toBe(CONTINUATION_PIECES);
    expect(r.app).toBeCloseTo(r.attack / CONTINUATION_PIECES);
  });
});

describe("PCO second bag", () => {
  it("accepts every winning route and finishes the perfect clear", () => {
    for (const { s } of modes)
      for (const mirror of [false, true]) {
        const def = openerFor(pco, mirror);
        for (const bag of [def.canonical[0], ...supportedBags(def, s.instantSoftDrop).filter((_, i) => i % 400 === 0)]) {
          const r = buildFirstBag(def, bag, s);
          const up = [r.state.active!.type, ...r.state.queue];
          const route = perfectClearRoute(r.state.board, r.state.hold, up, 4, s.instantSoftDrop);
          expect(route, `${bag} ${mirror}`).not.toBeNull();
          for (const step of route!) {
            expect(r.stage, bag).toBe("build");
            if (step.swap) tap(r, "hold");
            expect(r.state.active!.type).toBe(step.piece);
            play(r, step.piece, step.placement, s);
          }
          expect(r.stage, `${bag} ${mirror} ${r.reason}`).toBe("continue");
        }
      }
  }, 60_000);

  it("fails once the perfect clear is out of reach", () => {
    const r = buildFirstBag(pco, "IJOLZTS", settings);
    tap(r, "hardDrop"); // T straight down the middle blocks the clear
    expect(r.stage).toBe("failed");
    expect(r.reason).toMatch(/perfect clear is out of reach/);
  });
});

describe("DT Cannon canonical runs", () => {
  const planBuild = planGuide;

  it("builds the board, then the double and the triple, both orientations", () => {
    for (const { s } of modes)
      for (const mirror of [false, true]) {
        const def = openerFor(dt, mirror);
        const bag = def.canonical[0];
        const r = run(def, bag, s);
        const queue = [...bag, ...def.tail.slice(0, 6)] as Tetromino[];
        const plan = planBuild(def, queue, s.instantSoftDrop)!;
        expect(plan, `${mirror}`).not.toBeNull();
        queue.forEach((t, i) => {
          expect(r.state.active!.type).toBe(t);
          play(r, t, plan[i], s);
          expect(r.stage, `${mirror} piece ${i}: ${r.reason}`).toBe("build");
        });
        for (const lines of [2, 3]) {
          const spin = findSpins(r.state.board, "T", s).find((m) => m.spin === "full" && m.lines === lines);
          expect(spin, `${mirror} T-spin ${lines}`).toBeDefined();
          expect(r.state.active!.type).toBe("T");
          play(r, "T", spin as unknown as Placement, s);
          expect(r.stage, `${mirror} after ${lines}: ${r.reason}`).toBe(lines === 2 ? "build" : "continue");
          expect(r.goalsMet).toBe(lines - 1);
        }
        expect(r.built).toBe(true);
      }
  });
});
