import { describe, expect, it } from "vitest";
import { cells, emptyBoard, project, spawn } from "../src/core/board";
import type { Board, Piece, Tetromino } from "../src/core/board";
import { newCheeseState, refillCheese } from "../src/core/cheese";
import type { CheeseSpec } from "../src/core/cheese";
import { STAGES } from "../src/core/curriculum";
import { digPenalty, digText, reviewDig } from "../src/core/dig";
import type { DigFlag } from "../src/core/dig";
import { DrillSession } from "../src/core/drillSession";
import type { DrillDef } from "../src/core/drill";
import type { Placement } from "../src/core/game";
import { defaultSettings } from "../src/core/settings";

// Rows bottom first; "X" is garbage, anything else empty.
const board = (...rows: string[]): Board => {
  const b = emptyBoard();
  rows.forEach((r, y) => {
    for (let x = 0; x < 10; x++) b[y][x] = r[x] === "X" ? "X" : null;
  });
  return b;
};
const place = (
  b: Board,
  type: Tetromino,
  piece: Pick<Piece, "x" | "rotation">,
  extra: Partial<Placement> = {},
) => {
  const landing = project(b, { ...spawn(type), ...piece });
  const after = b.map((r) => [...r]);
  for (const [x, y] of cells(landing)) after[y][x] = type;
  const placement = {
    index: 0, type, landing, atMs: 0, keys: 0, optimalKeys: 0, cleared: 0,
    garbageCleared: 0, spin: null, attack: 0, b2b: 0, combo: 0, held: false,
    ...extra,
  } as Placement;
  return { after, placement };
};
const kinds = (flags: DigFlag[]) => flags.map((f) => f.kind);
const none = { hold: null, next: [] as Tetromino[] };

// Row 0 hole at column 7, row 1 (top garbage) hole at column 4.
const base = board("XXXXXXX.XX", "XXXX.XXXXX");

describe("reviewDig", () => {
  it("flags a block over the next hole, not a clean dig", () => {
    const bad = place(base, "O", { x: 4, rotation: 0 });
    expect(kinds(reviewDig(base, bad.after, bad.placement, none))).toContain(
      "next-hole-blocked",
    );
    const good = place(base, "O", { x: 0, rotation: 0 });
    expect(reviewDig(base, good.after, good.placement, none)).toEqual([]);
  });

  it("treats a stacked open hole column as the next hole", () => {
    // Column 7 is open in rows 0 and 1; an I laid flat over it blocks it.
    const b = board("XXXXXXX.XX", "XXXXXXX.XX");
    const { after, placement } = place(b, "I", { x: 5, rotation: 0 });
    expect(kinds(reviewDig(b, after, placement, none))).toContain("next-hole-blocked");
  });

  it("charges a cost line for each extra covered hole", () => {
    const b = board("XXXXXXX.XX", "XXXXXXX.XX");
    const { after, placement } = place(b, "I", { x: 5, rotation: 0 });
    expect(reviewDig(b, after, placement, none)).toContainEqual({
      kind: "cost-lines",
      count: 1,
    });
    const flat = place(b, "O", { x: 3, rotation: 0 });
    expect(kinds(reviewDig(b, flat.after, flat.placement, none))).not.toContain("cost-lines");
  });

  it("flags an I that clears no garbage while garbage exists", () => {
    const flat = place(base, "I", { x: 0, rotation: 0 });
    expect(kinds(reviewDig(base, flat.after, flat.placement, none))).toContain("wasted-i");
    const dig = place(base, "I", { x: 0, rotation: 0 }, { garbageCleared: 1 });
    expect(kinds(reviewDig(base, dig.after, dig.placement, none))).not.toContain("wasted-i");
  });

  it("flags clearing your own lines while garbage remains", () => {
    const own = place(base, "O", { x: 0, rotation: 0 }, { cleared: 1 });
    expect(kinds(reviewDig(base, own.after, own.placement, none))).toContain("own-line");
    const dug = place(base, "O", { x: 0, rotation: 0 }, { cleared: 1, garbageCleared: 1 });
    expect(kinds(reviewDig(base, dug.after, dug.placement, none))).not.toContain("own-line");
    const empty = emptyBoard();
    expect(reviewDig(empty, empty, own.placement, none)).toEqual([]);
  });

  it("hold-fit uses the held piece and the next piece", () => {
    // One garbage row with its hole at column 4: a vertical I clears it.
    const b = board("XXXX.XXXXX");
    const bad = place(b, "O", { x: 4, rotation: 0 });
    expect(kinds(reviewDig(b, bad.after, bad.placement, { hold: "I", next: [] }))).toContain("hold-fit");
    expect(reviewDig(b, bad.after, bad.placement, { hold: null, next: ["I"] })).toContainEqual({
      kind: "hold-fit",
      piece: "I",
    });
    expect(kinds(reviewDig(b, bad.after, bad.placement, none))).not.toContain("hold-fit");
  });

  it("stays fast and weights flags", () => {
    const bad = place(base, "O", { x: 4, rotation: 0 });
    const t = performance.now();
    for (let i = 0; i < 20; i++)
      reviewDig(base, bad.after, bad.placement, { hold: "T", next: ["L"] });
    expect((performance.now() - t) / 20).toBeLessThan(5);
    expect(digPenalty([{ kind: "own-line" }, { kind: "cost-lines", count: 9 }])).toBe(4);
    expect(digText({ kind: "wasted-i" })).toMatch(/I pieces/);
  });
});

const cheeseDef = (cheese: CheeseSpec): DrillDef => ({
  id: "t", title: "t", summary: "t", why: "t", how: [],
  options: { cheese },
  end: { garbage: true }, primary: "digEfficiency", metrics: ["digEfficiency"],
});

describe("dig metrics", () => {
  it("computes early doubles and efficiency", () => {
    const s = new DrillSession(
      cheeseDef({ rows: 5, total: 7, messiness: 0.5 }),
      7,
      defaultSettings(),
    );
    for (const [index, garbageCleared] of [[0, 2], [1, 1], [25, 3]])
      s.game.log.push({ index, garbageCleared } as Placement);
    s.game.state.pieces = 10;
    s.game.state.stats.attack = 2;
    s.game.state.stats.garbageCleared = 6;
    const m = s.metrics();
    expect(m.earlyDoubles).toBe(1);
    expect(m.digEfficiency).toBeCloseTo((2 + 6) / (10 * 0.4));
  });
});

describe("cheese options", () => {
  const deal = (spec: CheeseSpec, seed = 3) => {
    const state = newCheeseState(seed);
    return { board: refillCheese(emptyBoard(), state, spec).board, state };
  };
  const holes = (b: Board, n: number) =>
    b.slice(0, n).map((row) => row.flatMap((c, x) => (c === null ? [x] : [])));

  it("deals two holes per row deterministically", () => {
    const spec = { rows: 8, total: 8, messiness: 1, holes: 2 } as const;
    expect(deal(spec).board).toEqual(deal(spec).board);
    for (const h of holes(deal(spec).board, 8)) expect(h).toHaveLength(2);
  });

  it("keeps clean holes in runs of 3 to 6 rows", () => {
    const { board: b } = deal({ rows: 30, total: 30, messiness: 0, clean: true });
    const cols = holes(b, 30).map((h) => h[0]);
    const runs: number[] = [];
    let run = 1;
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] === cols[i - 1]) run++;
      else {
        runs.push(run);
        run = 1;
      }
    }
    expect(runs.length).toBeGreaterThan(2);
    for (const r of runs) expect(r).toBeLessThanOrEqual(6);
    // Rows are dealt bottom first, so only the last (top) run may be cut short.
    for (const r of runs.slice(1)) expect(r).toBeGreaterThanOrEqual(3);
  });

  it("leaves the default spec on one hole", () => {
    expect(deal({ rows: 6, total: 6, messiness: 0.5 }).state.hole2).toBe(-1);
  });

  it("undo restores two-hole clean cheese exactly", () => {
    const s = new DrillSession(
      cheeseDef({ rows: 5, total: 9, messiness: 0, holes: 2, clean: true }),
      5,
      defaultSettings(),
    );
    const snap = () => structuredClone([s.game.state.board, s.game.state.cheese]);
    const first = snap();
    s.keyDown("hardDrop");
    s.undo();
    expect(snap()).toEqual(first);
  });
});

describe("curriculum", () => {
  it("has the new dig drills with unique ids", () => {
    const ids = STAGES.flatMap((st) => st.drills.map((d) => d.id));
    expect(ids).toContain("cheese-clean");
    expect(ids).toContain("cheese-2hole");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
