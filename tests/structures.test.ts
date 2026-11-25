import { describe, expect, it } from "vitest";
import { cells as cellsOf, emptyBoard } from "../src/core/board";
import type { Board } from "../src/core/board";
import { quadReady } from "../src/core/coach";
import { nextRandom } from "../src/core/rng";
import { bestBatchMs } from "./support/timing";
import { findPlacements, findSpins } from "../src/core/spins";
import {
  boardFromRows,
  boardOf,
  chainSearch,
  CUE_TEMPLATES,
  deadBoard,
  kaidanCue,
  KAIDAN_PARITY,
  mirrorBoard,
  STRUCTURES,
  stmbCue,
} from "../src/core/structures";

/** A hole-sparse stack: a flat base with a mostly flat random surface. */
function realistic(seed: number): Board {
  const rng = { rng: seed };
  const board = emptyBoard();
  const base = 3 + Math.floor(nextRandom(rng) * 6);
  for (let x = 0; x < 10; x++) {
    const r = nextRandom(rng);
    const h =
      base + (r < 0.6 ? 0 : r < 0.8 ? 1 : r < 0.9 ? -1 : r < 0.95 ? 2 : -2);
    for (let y = 0; y < h; y++)
      if (y > h - 3 || nextRandom(rng) > 0.05) board[y][x] = "X";
  }
  return board;
}

describe("structures", () => {
  it("has unique ids and 10-wide fixtures", () => {
    expect(new Set(STRUCTURES.map((s) => s.id)).size).toBe(STRUCTURES.length);
    for (const s of STRUCTURES)
      expect(s.fixture.every((r) => r.length === 10)).toBe(true);
  });

  it.each(STRUCTURES.map((s) => [s.id, s] as const))(
    "%s: the search proves its chain",
    (_id, s) => {
      const chains = chainSearch(boardOf(s), s.chain.length);
      expect(
        chains.some((c) => JSON.stringify(c.spins) === JSON.stringify(s.chain)),
      ).toBe(true);
      // Every move in a found chain is a real spin that clears lines.
      for (const c of chains)
        expect(c.moves.every((m) => m.lines > 0)).toBe(true);
    },
  );

  it.each(STRUCTURES.map((s) => [s.id, s] as const))(
    "%s: the cue fires on the fixture and its mirror",
    (_id, s) => {
      expect(s.cue(boardOf(s))).toBe(true);
      expect(s.cue(mirrorBoard(boardOf(s)))).toBe(true);
    },
  );

  it("cues stay quiet on an empty board", () => {
    for (const s of STRUCTURES) expect(s.cue(emptyBoard())).toBe(false);
    expect(stmbCue(emptyBoard())).toBe(false);
  });

  it("cues rarely fire on realistic random boards", () => {
    const N = 200;
    const hits: Record<string, number> = {};
    let any = 0;
    for (let i = 0; i < N; i++) {
      const b = realistic(1000 + i);
      let fired = false;
      for (const s of STRUCTURES)
        if (s.cue(b)) {
          hits[s.id] = (hits[s.id] ?? 0) + 1;
          fired = true;
        }
      if (stmbCue(b)) {
        hits.stmb = (hits.stmb ?? 0) + 1;
        fired = true;
      }
      if (fired) any++;
    }
    console.log("cue false positives", JSON.stringify(hits), `any ${any}/${N}`);
    for (const n of Object.values(hits)) expect(n / N).toBeLessThan(0.1);
  });

  it("the donation fixture's TSD clears the cover and reopens the well", () => {
    const kaidan = STRUCTURES.find((s) => s.id === "kaidan")!;
    const before = boardOf(kaidan);
    const donation = findSpins(before, "T").find(
      (s) => s.spin === "full" && s.lines === 2,
    )!;
    expect(donation).toBeDefined();
    // The well column is empty again, and the rows under it are untouched.
    expect(donation.after.every((row) => row[9] === null)).toBe(true);
    for (let y = 0; y < 2; y++) expect(donation.after[y]).toEqual(before[y]);
  });

  it("the sourced parity Kaidan spins a TSD and the well is quad-ready", () => {
    const before = boardFromRows(KAIDAN_PARITY);
    expect(quadReady(before)).toBe(false);
    const donation = findSpins(before, "T").find(
      (s) => s.spin === "full" && s.lines === 2,
    )!;
    expect(donation.piece).toMatchObject({ x: 4, y: 5, rotation: 2 });
    expect(quadReady(donation.after)).toBe(true);
  });

  it("stmb cue needs equal walls and a flat gap two rows deep", () => {
    const cave = boardFromRows(Array(3).fill("XXX...XXXX"));
    expect(stmbCue(cave)).toBe(true);
    expect(stmbCue(mirrorBoard(cave))).toBe(true);
    expect(stmbCue(boardFromRows(Array(1).fill("XXX...XXXX")))).toBe(false);
    expect(
      stmbCue(
        boardFromRows([
          "XXX...XXXX",
          "XXXXXXXXXX".replace("X", "."),
          "XXX...XXXX",
        ]),
      ),
    ).toBe(false);
    expect(kaidanCue(emptyBoard())).toBe(false);
  });
});

const TEMPLATE_IDS = Object.keys(CUE_TEMPLATES);
const byId = (id: string) => STRUCTURES.find((s) => s.id === id)!;
const proves = (rows: string[], s: (typeof STRUCTURES)[number]) =>
  chainSearch(boardFromRows(rows), s.chain.length).some(
    (c) => JSON.stringify(c.spins) === JSON.stringify(s.chain),
  );
const flip = (rows: string[], i: number, j: number) => {
  const next = [...rows];
  next[i] = rows[i].slice(0, j) + (rows[i][j] === "." ? "X" : ".") + rows[i].slice(j + 1);
  return next;
};
/** A spin chain of the same kinds exists, line counts aside. */
function sameSpins(b: Board, kinds: string[]): boolean {
  if (!kinds.length) return true;
  return findSpins(b, "T", { includeZero: true }).some(
    (m) => m.spin === kinds[0] && sameSpins(m.after, kinds.slice(1)),
  );
}

describe("cue templates", () => {
  it.each(TEMPLATE_IDS)("%s: only cells the spins depend on are fixed", (id) => {
    const s = byId(id);
    const kinds = s.chain.map((c) => c.spin);
    // Two empty rows above the fixture, so a roof cell can show up.
    const rows = ["..........", "..........", ...s.fixture];
    // Only the columns the winning spins touch, plus two each side for the
    // corners and the approach, can belong to the cue.
    const xs = chainSearch(boardFromRows(s.fixture), s.chain.length)
      .find((c) => JSON.stringify(c.spins) === JSON.stringify(s.chain))!
      .moves.flatMap((m) => cellsOf(m.piece).map(([x]) => x));
    const [lo, hi] = [Math.max(0, Math.min(...xs) - 2), Math.min(9, Math.max(...xs) + 2)];
    const fixed = rows.map((r, i) =>
      [...r].map(
        (_, j) => j >= lo && j <= hi && !sameSpins(boardFromRows(flip(rows, i, j)), kinds),
      ),
    );
    const hit = (f: (i: number, j: number) => boolean) =>
      rows.flatMap((_, i) => [...Array(10).keys()].filter((j) => f(i, j)).map((j) => [i, j]));
    const cells = hit((i, j) => fixed[i][j]);
    const [r0, r1] = [Math.min(...cells.map((c) => c[0])), Math.max(...cells.map((c) => c[0]))];
    const [c0, c1] = [Math.min(...cells.map((c) => c[1])), Math.max(...cells.map((c) => c[1]))];
    const derived = rows
      .slice(r0, r1 + 1)
      .map((row, k) =>
        [...row].map((ch, j) => (fixed[r0 + k][j] ? ch : "?")).join("").slice(c0, c1 + 1),
      );
    expect(CUE_TEMPLATES[id]).toEqual(derived);
    // Most of the fixture is left free.
    const fixedCount = cells.length;
    expect(fixedCount).toBeLessThan(0.6 * rows.length * 10);
  });

  it.each(TEMPLATE_IDS)("%s: the cue survives unrelated changes", (id) => {
    const s = byId(id);
    const rng = { rng: 77 };
    // Cells the template leaves free and whose single flip keeps the proof.
    const free: [number, number][] = [];
    s.fixture.forEach((row, i) =>
      [...row].forEach((_, j) => {
        if (proves(flip(s.fixture, i, j), s) && s.cue(boardFromRows(flip(s.fixture, i, j))))
          free.push([i, j]);
      }),
    );
    expect(free.length).toBeGreaterThan(0);
    let tried = 0;
    for (let n = 0; n < 40; n++) {
      let rows = s.fixture;
      const k = 1 + Math.floor(nextRandom(rng) * 4);
      for (let c = 0; c < k; c++) {
        const [i, j] = free[Math.floor(nextRandom(rng) * free.length)];
        rows = flip(rows, i, j);
      }
      if (!proves(rows, s)) continue;
      tried++;
      expect(s.cue(boardFromRows(rows))).toBe(true);
      expect(s.cue(mirrorBoard(boardFromRows(rows)))).toBe(true);
    }
    expect(tried).toBeGreaterThan(0);
  });

  it.each(TEMPLATE_IDS)("%s: the cue finds the structure at any height", (id) => {
    const s = byId(id);
    // The STSD needs a solid floor under its 3-wide space.
    const unders =
      id === "stsd"
        ? [["XXXXXXXXX."], ["XXXXXXXX.X", "XXXXXXXXX."], ["XXXXXXX.XX", "XXXXXXXXX.", "XXXXXXXX.X"]]
        : [["X........X"], ["XXXXXXXX.X", "XXXXXXXXX."], ["XX.XXXX.XX", "X.XXXXXXXX", "XXXXXXX.XX"]];
    for (const under of unders) {
      const rows = [...s.fixture, ...under];
      expect(proves(rows, s)).toBe(true);
      expect(s.cue(boardFromRows(rows))).toBe(true);
      expect(s.cue(mirrorBoard(boardFromRows(rows)))).toBe(true);
    }
  });

  it("the Triple Double cue ignores a block beside the top row's slot", () => {
    const td = byId("triple-double");
    const rows = flip(td.fixture, 0, 9);
    expect(proves(rows, td)).toBe(true);
    expect(td.cue(boardFromRows(rows))).toBe(true);
  });

  it("a broken notch no longer cues", () => {
    const td = byId("triple-double");
    const rows = flip(td.fixture, 3, 4);
    expect(td.cue(boardFromRows(rows))).toBe(false);
  });
});

describe("kaidanCue", () => {
  const kaidan = byId("kaidan");
  it("finds the pocket under the cover at any height", () => {
    for (const under of [["X........X"], ["X........X", "XXXXXXX.XX"], ["XX.XXXXXXX"]]) {
      const rows = [...kaidan.fixture, ...under];
      const board = boardFromRows(rows);
      expect(findSpins(board, "T").some((m) => m.spin === "full" && m.lines === 2)).toBe(true);
      expect(kaidanCue(board)).toBe(true);
      expect(kaidanCue(mirrorBoard(board))).toBe(true);
    }
  });

  it("needs a pocket two deep and a stair", () => {
    const shallow = [...kaidan.fixture];
    shallow[shallow.length - 1] = "XXXXXXXXXX";
    expect(kaidanCue(boardFromRows(shallow))).toBe(false);
    const flat = kaidan.fixture.map((r) => r.replace(/\./g, (_, i) => (i < 8 ? "X" : ".")));
    expect(kaidanCue(boardFromRows(flat))).toBe(false);
  });
});

describe("deadBoard", () => {
  it("an empty board is dead", () => {
    expect(deadBoard(emptyBoard())).toBe(true);
  });

  it("boards with a spin or a quad ready are live", () => {
    for (const s of STRUCTURES) expect(deadBoard(boardOf(s))).toBe(false);
    const quad = boardFromRows(Array(4).fill("XXXXXXXXX."));
    expect(quadReady(quad)).toBe(true);
    expect(deadBoard(quad)).toBe(false);
  });

  it("a TSD slot one placement away is live", () => {
    const nearly = boardFromRows(["XXX...XXXX", "XXXX.XXXXX"]);
    expect(findSpins(nearly, "T").some((s) => s.spin === "full")).toBe(false);
    expect(deadBoard(nearly)).toBe(false);
  });

  it("four rows of eight are live: a vertical I makes a quad", () => {
    const rows = Array(4).fill("XXXXXXXX..");
    const board = boardFromRows(rows);
    expect(quadReady(board)).toBe(false);
    expect(deadBoard(board)).toBe(false);
    // Not live at once, only through a setup placement.
    expect(deadBoard(board, { horizon: 0 })).toBe(true);
    const verticalI = findPlacements(board, "I").some(
      (p) => p.piece.rotation % 2 === 1 && quadReady(p.after),
    );
    expect(verticalI).toBe(true);
  });

  it("looks at a T-spin made live by a setup placement, too", () => {
    const board = boardFromRows(["XXX...XXXX", "XXXX.XXXXX"]);
    expect(deadBoard(board, { horizon: 0 })).toBe(true);
    expect(deadBoard(board, { horizon: 1 })).toBe(false);
  });

  it("finds floor-level T-spins after a setup placement (strict)", () => {
    const board = boardFromRows(["XXXXX.X..."]);
    expect(deadBoard(board, { strict: true, horizon: 1 })).toBe(false);
  });

  it("matches the full spin search on small floor-level boards (strict)", () => {
    const hasSpinClear = (b: Board) =>
      findSpins(b, "T").some((s) => s.lines >= 1);
    for (let i = 0; i < 30; i++) {
      const rng = { rng: 9100 + i };
      const rows = Array.from({ length: 1 + (i % 2) }, () =>
        Array.from({ length: 10 }, () => (nextRandom(rng) < 0.7 ? "X" : ".")).join(""),
      );
      const b = boardFromRows(rows);
      const brute =
        !(quadReady(b) || hasSpinClear(b)) &&
        !["I", "O", "T", "S", "Z", "J", "L"].some((type) =>
          findPlacements(b, type as "T").some(
            (p) => quadReady(p.after) || hasSpinClear(p.after),
          ),
        );
      expect(deadBoard(b, { strict: true, horizon: 1 }), rows.join("/")).toBe(brute);
    }
  });

  it("agrees with an exhaustive one-placement search", () => {
    const live = (b: Board) =>
      quadReady(b) ||
      findSpins(b, "T").some((s) => s.spin === "full" && s.lines >= 2);
    for (let i = 0; i < 30; i++) {
      const b = realistic(3000 + i);
      const brute =
        !live(b) &&
        !["I", "O", "T", "S", "Z", "J", "L"].some((type) =>
          findPlacements(b, type as "T").some((p) => live(p.after)),
        );
      expect(deadBoard(b, { horizon: 1 })).toBe(brute);
    }
  });

  it("is fast enough to label questions", () => {
    const boards = Array.from({ length: 12 }, (_, i) => realistic(4000 + i));
    deadBoard(boards[0]); // warm up
    const times = boards.map((b) => bestBatchMs(() => deadBoard(b)));
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    process.stderr.write(
      `deadBoard (horizon 2) median ${median.toFixed(1)} ms, max ${times.at(-1)!.toFixed(1)} ms\n`,
    );
    expect(median).toBeLessThan(150);
  });

  it("strict mode counts a mini single", () => {
    const b = boardFromRows(["XXX...XXXX", "XXXX.XXXXX"]);
    expect(deadBoard(b, { strict: true })).toBe(false);
  });
});
