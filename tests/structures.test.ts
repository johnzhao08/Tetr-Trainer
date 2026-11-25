import { describe, expect, it } from "vitest";
import { emptyBoard } from "../src/core/board";
import type { Board } from "../src/core/board";
import { quadReady } from "../src/core/coach";
import { nextRandom } from "../src/core/rng";
import { findSpins } from "../src/core/spins";
import {
  boardFromRows,
  boardOf,
  chainSearch,
  deadBoard,
  kaidanCue,
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

  it("the donation fixture reopens the well after the spin", () => {
    const kaidan = STRUCTURES.find((s) => s.id === "kaidan")!;
    const before = boardOf(kaidan);
    expect(quadReady(before)).toBe(false);
    const donation = findSpins(before, "T").find(
      (s) => s.spin === "full" && s.lines === 2,
    )!;
    expect(donation).toBeDefined();
    expect(quadReady(donation.after)).toBe(true);
    // Rows under the donation are untouched.
    for (let y = 0; y < 4; y++) expect(donation.after[y]).toEqual(before[y]);
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

  it("strict mode counts a mini single", () => {
    const b = boardFromRows(["XXX...XXXX", "XXXX.XXXXX"]);
    expect(deadBoard(b, { strict: true })).toBe(false);
  });
});
