import { describe, expect, it } from "vitest";
import { HEIGHT, WIDTH, deserialize, emptyBoard } from "../src/core/board";
import type { Board } from "../src/core/board";
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
  it("reviews 200 placements on a messy board under 400 ms", () => {
    let seed = 7;
    const rnd = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const rows = Array.from({ length: 15 }, () =>
      [...Array(WIDTH)].map(() => (rnd() < 0.6 ? "#" : ".")).join(""),
    );
    const before = grid(rows);
    const after = grid(["#.#.#.#.#.", ...rows.slice(0, 14)]);
    const t = performance.now();
    for (let i = 0; i < 200; i++) reviewPlacement(before, after);
    expect(performance.now() - t).toBeLessThan(400);
  });
});
