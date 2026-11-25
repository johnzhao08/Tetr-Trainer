import { describe, expect, it } from "vitest";
import { HEIGHT, WIDTH, deserialize, emptyBoard } from "../src/core/board";
import type { Board } from "../src/core/board";
import { bestBatchMs } from "./support/timing";
import {
  analyzeBoard,
  bandForPenalty,
  findTsdSlots,
  quadReady,
  reviewPlacement,
} from "../src/core/coach";

/** Top-down rows (10 wide, "#" filled), padded with empty rows up to 40. */
function grid(rows: string[]): Board {
  const pad = Array(HEIGHT - rows.length).fill(".".repeat(WIDTH));
  return deserialize(
    [...pad, ...rows.map((r) => r.replaceAll("#", "X"))].join("\n"),
  );
}

// Slot at x=3: the T points down into (3,0) and enters over the open right side.
const tsd = ["..#.......", "##...#####", "###.######"];

describe("analyzeBoard", () => {
  it("counts holes and covered cells", () => {
    const s = analyzeBoard(grid(["#.........", ".#........", "#.#......."]));
    expect(s.heights.slice(0, 3)).toEqual([3, 2, 1]);
    expect(s.holes).toBe(2);
    expect(s.coveredCells).toBe(2);
    expect(s.maxHeight).toBe(3);
    expect(analyzeBoard(emptyBoard()).holes).toBe(0);
  });
  it("treats walls as infinitely high when finding wells", () => {
    const left = analyzeBoard(grid([".#########", ".#########", ".#########"]));
    expect(left.wells).toEqual([{ x: 0, depth: 3 }]);
    const right = analyzeBoard(grid(["#########.", "#########."]));
    expect(right.wells).toEqual([{ x: 9, depth: 2 }]);
    expect(analyzeBoard(grid(["##.#######"])).wells).toEqual([]);
    const mid = analyzeBoard(grid(["##.#######", "##.#######"]));
    expect(mid.wells).toEqual([{ x: 2, depth: 2 }]);
  });
});

describe("reviewPlacement flags", () => {
  it("flags a newly created hole", () => {
    const r = reviewPlacement(
      grid(["#.#......."]),
      grid(["###.......", "#.#......."]),
    );
    expect(r.flags).toContainEqual({ kind: "hole", count: 1 });
    expect(r.band).toBe("mistake");
  });
  it("does not blame holes uncovered by a clear", () => {
    const before = grid(["#########.", "#.########"]);
    const after = grid(["#.########"]);
    const r = reviewPlacement(before, after, { cleared: 1 });
    expect(analyzeBoard(before).holes).toBe(1);
    expect(r.flags.some((f) => f.kind === "hole")).toBe(false);
    expect(r.band).toBe("best");
  });
  it("keeps a newly covered hole when a clear uncovers an old one", () => {
    const before = grid(["###...####", ".###.#####"]);
    const after = grid(["....#.....", ".###.#####"]);
    // T (rotation 0, pivot 4,1) fills row 1 and clears it; the nub covers (4,0).
    const cleared = grid(["....#.....", ".###.#####"]);
    expect(analyzeBoard(before).holes).toBe(analyzeBoard(cleared).holes);
    const r = reviewPlacement(before, after, { cleared: 1 });
    expect(r.flags.filter((f) => f.kind === "hole")).toEqual([
      { kind: "hole", count: 1 },
    ]);
    expect(r.band).not.toBe("best");
  });
  it("infers the clear count when it is not passed", () => {
    const before = grid(["#.........", "###...####", ".###.#####"]);
    const after = grid(["#...#.....", ".###.#####"]);
    const r = reviewPlacement(before, after);
    expect(r.flags.filter((f) => f.kind === "hole")).toEqual([
      { kind: "hole", count: 1 },
    ]);
  });
  it("does not punish the roof of a T-spin setup", () => {
    // An L lays the overhang that turns (2,1) into a TSD slot cell.
    const before = grid(["##...#####", "###.######"]);
    const after = grid([
      "..#.......",
      "###.......",
      "##...#####",
      "###.######",
    ]);
    expect(findTsdSlots(after)).toHaveLength(1);
    const r = reviewPlacement(before, after, { cleared: 0 });
    expect(
      r.flags.some((f) => f.kind === "hole" || f.kind === "overhang"),
    ).toBe(false);
    expect(["best", "good"]).toContain(r.band);
  });
  it("counts a T-slot under construction as a spin slot, not a hole", () => {
    // Slot rows are not complete yet (no line would clear), but a T can
    // still be spun into the covered cell.
    const before = grid(["##...###..", "###.####.."]);
    const after = grid([
      "..#.......",
      "###.......",
      "##...###..",
      "###.####..",
    ]);
    const r = reviewPlacement(before, after, { cleared: 0 });
    expect(
      r.flags.some((f) => f.kind === "hole" || f.kind === "overhang"),
    ).toBe(false);
  });
  it("flags a tuck-only overhang lightly instead of as a hole", () => {
    // A J roofs (1,0) and (2,0); an I can still slide in underneath.
    const before = grid(["#........."]);
    const after = grid(["#.........", "###.......", "#........."]);
    const r = reviewPlacement(before, after, { cleared: 0 });
    expect(r.flags).toContainEqual({ kind: "overhang", count: 2 });
    expect(r.flags.some((f) => f.kind === "hole")).toBe(false);
    expect(r.band).toBe("inaccuracy");
  });
  it("still flags a sealed hole", () => {
    const before = grid(["#.########"]);
    const after = grid(["##........", "#.########"]);
    const r = reviewPlacement(before, after, { cleared: 0 });
    expect(r.flags).toContainEqual({ kind: "hole", count: 1 });
  });
  it("blames the placement that seals an existing overhang", () => {
    const base = grid(["#........."]);
    const roofed = grid(["#.........", "###.......", "#........."]);
    expect(reviewPlacement(base, roofed, { cleared: 0 }).flags).toContainEqual({
      kind: "overhang",
      count: 2,
    });
    // A vertical I in column 3 closes the only way in.
    const sealed = grid([
      "...#......",
      "#..#......",
      "####......",
      "#..#......",
    ]);
    const r = reviewPlacement(roofed, sealed, { cleared: 0 });
    expect(r.flags).toContainEqual({ kind: "hole", count: 2 });
  });
  it("blames sealing under a roof built above spawn height", () => {
    const at = (rows: Board, cells: [number, number][]) => {
      const out = rows.map((r) => [...r]);
      for (const [x, y] of cells) out[y][x] = "X";
      return out;
    };
    const roof: [number, number][] = [
      ...[0, 1, 2, 3, 4, 5].map((x) => [x, 23] as [number, number]),
      ...[5, 6, 7, 8, 9].map((x) => [x, 24] as [number, number]),
    ];
    const before = at(grid(["#.........", "###.......", "#........."]), roof);
    const after = at(
      grid(["...#......", "#..#......", "####......", "#..#......"]),
      roof,
    );
    const r = reviewPlacement(before, after, { cleared: 0 });
    expect(r.flags).toContainEqual({ kind: "hole", count: 2 });
  });
  it("still flags roof growth over an existing slot as a spike", () => {
    const grown = grid([
      "..#.......",
      "..#.......",
      "..#.......",
      "..#.......",
      ...tsd,
    ]);
    expect(findTsdSlots(grid(tsd))).toHaveLength(1);
    const r = reviewPlacement(grid(tsd), grown, { cleared: 0 });
    expect(r.flags.some((f) => f.kind === "spike")).toBe(true);
  });
  it("treats cells under a high open roof as fillable, not holes", () => {
    // Pieces can still get under the roof and stack up beneath it.
    const post = Array(10).fill("#.........");
    const roof = grid(["####......", ...post]);
    const r = reviewPlacement(grid(post), roof, { cleared: 0 });
    expect(r.flags).toContainEqual({ kind: "overhang", count: 30 });
    expect(r.flags.some((f) => f.kind === "hole")).toBe(false);
  });
  it("does not invent holes when a clear lowers the stack under a roof", () => {
    const before = grid([
      "####......",
      ...Array(14).fill("#........."),
      "#########.",
    ]);
    // A vertical I in the right column clears the bottom row only.
    const after = grid([
      "####......",
      ...Array(11).fill("#........."),
      ...Array(3).fill("#........#"),
    ]);
    const r = reviewPlacement(before, after, { cleared: 1 });
    expect(r.flags.some((f) => f.kind === "hole")).toBe(false);
  });
  it("flags a new spike even when an older, larger one exists", () => {
    const old = Array(6).fill("#.........");
    const grown = Array(4).fill(".....#....");
    const after = grid([
      ...old.slice(0, 2),
      ...old.slice(2).map((r, i) => (i < 4 ? "#....#...." : r)),
    ]);
    const r = reviewPlacement(grid(old), after);
    expect(grown).toHaveLength(4);
    expect(r.flags).toContainEqual({ kind: "spike", diff: 4 });
  });
  it("flags a spike but not next to the main well", () => {
    const r = reviewPlacement(emptyBoard(), grid(Array(5).fill("....#.....")));
    expect(r.flags).toContainEqual({ kind: "spike", diff: 5 });
    const wall = Array(4).fill("#########.");
    const grown = grid(["#.........", ...wall]);
    const r2 = reviewPlacement(grid(wall), grown);
    expect(r2.flags.some((f) => f.kind === "spike")).toBe(false);
  });
  it("flags a new 2-wide gap", () => {
    const r = reviewPlacement(emptyBoard(), grid(Array(3).fill("####..####")));
    expect(r.flags).toContainEqual({ kind: "two-wide", x: 4 });
    expect(r.band).toBe("inaccuracy");
  });
  it("flags two I-only wells", () => {
    const r = reviewPlacement(emptyBoard(), grid(Array(4).fill("#.#####.##")));
    expect(r.flags).toContainEqual({ kind: "i-dependency", count: 2 });
  });
  it("penalises only the increase in I-only wells", () => {
    const two = Array(3).fill("#.#####.##");
    const three = Array(3).fill("#.###.#.##");
    const up = reviewPlacement(grid(two), grid(three));
    expect(up.flags).toContainEqual({ kind: "i-dependency", count: 3 });
    expect(up.penalty).toBe(1);
    const same = reviewPlacement(grid(two), grid(two));
    expect(same.flags.some((f) => f.kind === "i-dependency")).toBe(false);
  });
  it("does not flag height raised below the danger line or beside a tall column", () => {
    const tall = Array(15).fill("#.........");
    const r = reviewPlacement(
      grid(tall),
      grid(["..#......."].concat(tall.slice(1))),
    );
    expect(r.flags.some((f) => f.kind === "high")).toBe(false);
    const lone = reviewPlacement(grid(tall), grid(["#........."].concat(tall)));
    expect(lone.flags.some((f) => f.kind === "high")).toBe(true);
  });
  it("flags tall stacks", () => {
    const r = reviewPlacement(emptyBoard(), grid(Array(14).fill("#.........")));
    expect(r.flags).toContainEqual({ kind: "high", height: 14 });
  });
  it("flags a lost TSD slot unless a T-spin cleared lines", () => {
    const before = grid(tsd);
    const after = grid(["..#.......", "##.#.#####", "###.######"]);
    expect(reviewPlacement(before, after).flags).toContainEqual({
      kind: "lost-tsd",
    });
    const spun = reviewPlacement(before, after, { cleared: 2, spin: true });
    expect(spun.flags.some((f) => f.kind === "lost-tsd")).toBe(false);
  });
});

describe("T-spin double and quad detection", () => {
  it("finds a classic reachable slot", () => {
    expect(findTsdSlots(grid(tsd))).toEqual([
      { type: "T", x: 3, y: 1, rotation: 2 },
    ]);
  });
  it("ignores a slot sealed off from spawn", () => {
    expect(findTsdSlots(grid(["..#####...", ...tsd]))).toEqual([]);
  });
  it("returns nothing when the spawn position is blocked", () => {
    const board = grid(tsd);
    board[22][4] = "X";
    expect(findTsdSlots(board)).toEqual([]);
  });
  it("finds a slot at spawn height", () => {
    const base = Array(20).fill("#########.");
    const high = grid(["...#......", "###...####", "####.#####", ...base]);
    expect(findTsdSlots(high)).toEqual([
      { type: "T", x: 4, y: 21, rotation: 2 },
    ]);
  });
  it("ignores a slot a plain drop can reach", () => {
    const open = grid(["##...#####", "###.######"]);
    expect(findTsdSlots(open)).toEqual([]);
  });
  it("detects quad readiness", () => {
    expect(quadReady(grid(Array(4).fill("#########.")))).toBe(true);
    expect(quadReady(grid(Array(4).fill("####.#####")))).toBe(true);
    const gap = ["#########.", "#########.", "######.##.", "#########."];
    expect(quadReady(grid(gap))).toBe(false);
    expect(quadReady(grid(Array(3).fill("#########.")))).toBe(false);
  });
});

describe("bands", () => {
  it("maps penalties to bands", () => {
    expect(bandForPenalty(0, true)).toBe("best");
    expect(bandForPenalty(0, false)).toBe("good");
    expect(bandForPenalty(1)).toBe("inaccuracy");
    expect(bandForPenalty(2)).toBe("inaccuracy");
    expect(bandForPenalty(3)).toBe("mistake");
    expect(bandForPenalty(4)).toBe("mistake");
    expect(bandForPenalty(5)).toBe("blunder");
    expect(bandForPenalty(12)).toBe("blunder");
  });
  it("rates a quiet placement good and a TSD-keeping one best", () => {
    const quiet = reviewPlacement(emptyBoard(), grid(["#........."]));
    expect(quiet.band).toBe("good");
    const board = grid(tsd);
    expect(reviewPlacement(board, board).band).toBe("best");
  });
});

describe("performance", () => {
  it("reviews 400 placements on messy boards within the 2 ms budget", () => {
    let seed = 7;
    const rnd = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const rows = Array.from({ length: 15 }, () =>
      [...Array(WIDTH)].map(() => (rnd() < 0.6 ? "#" : ".")).join(""),
    );
    // A reachable slot (before) and a sealed but geometrically valid one
    // (after) force the reachability search to run on both boards.
    const before = grid([
      ...Array(15 - tsd.length).fill(".".repeat(WIDTH)),
      ...tsd,
    ]);
    const after = grid(["..#####...", ...tsd]);
    expect(findTsdSlots(before)).toHaveLength(1);
    expect(findTsdSlots(after)).toHaveLength(0);
    const messy = grid(rows);
    // Warm up the JIT so the budget measures steady-state cost.
    for (let i = 0; i < 20; i++) reviewPlacement(before, after);
    const ms = bestBatchMs(() => {
      for (let i = 0; i < 200; i++) {
        reviewPlacement(before, after);
        reviewPlacement(messy, messy);
      }
    });
    // 400 reviews at the 2 ms per-placement budget.
    expect(ms).toBeLessThan(800);
  });
  it("stays in budget with a persistent roof just below the search cutoff", () => {
    const post = Array(14).fill("#.........");
    const before = grid(["####......", ...post]);
    // A vertical I far right; the roof and its covered cells persist.
    const after = grid([
      "####......",
      ...post.slice(0, 10),
      ...post.slice(10).map((r) => r.slice(0, 9) + "#"),
    ]);
    for (let i = 0; i < 20; i++) reviewPlacement(before, after);
    const ms = bestBatchMs(() => {
      for (let i = 0; i < 200; i++) reviewPlacement(before, after);
    });
    expect(ms).toBeLessThan(400);
  });
  it("stays in budget when the stack nears spawn height", () => {
    const tall = (rows: string[]) =>
      grid([
        ...Array(19 - rows.length).fill(".........#"),
        ...rows.map((r) => r.slice(0, 9) + "#"),
      ]);
    const before = tall(["#........."]);
    const after = tall(["#.........", "###.......", "#........."]);
    for (let i = 0; i < 20; i++) reviewPlacement(before, after);
    const ms = bestBatchMs(() => {
      for (let i = 0; i < 200; i++) reviewPlacement(before, after);
    });
    expect(ms).toBeLessThan(400);
  });
});

describe("donation cover", () => {
  // Kaidan: a vertical S over the well in column 9 is the donation cover; the
  // T-spin double that follows clears the cover rows and reopens the well.
  const kaidan = [
    "......#...",
    "######...#",
    "#######.##",
    "#########.",
    "#########.",
    "#########.",
    "#########.",
  ];
  const before = grid([
    "......#...",
    "######....",
    "#######...",
    "#######...",
    "#########.",
    "#########.",
    "#########.",
  ]);
  it("credits a cover that a reachable T-spin clears", () => {
    const r = reviewPlacement(before, grid(kaidan));
    expect(r.donation).toBeGreaterThan(0);
    expect(r.flags.some((f) => f.kind === "hole" || f.kind === "overhang")).toBe(false);
    expect(["best", "good"]).toContain(r.band);
  });
  it("still flags a sealed hole when no spin clears the cover", () => {
    const well = ["#########.", "#########.", "#########."];
    const r = reviewPlacement(
      grid(well),
      grid(["........##", "........##", ...well]),
    );
    expect(r.donation).toBe(0);
    expect(r.flags.some((f) => f.kind === "hole")).toBe(true);
  });
  it("reviews a donation in under 2 ms", () => {
    const after = grid(kaidan);
    for (let i = 0; i < 20; i++) reviewPlacement(before, after);
    const t = performance.now();
    for (let i = 0; i < 100; i++) reviewPlacement(before, after);
    expect((performance.now() - t) / 100).toBeLessThan(2);
  });
});
