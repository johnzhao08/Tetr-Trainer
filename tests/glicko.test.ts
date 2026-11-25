import { describe, expect, it } from "vitest";
import {
  newGlicko,
  PUZZLE_RD_CAP,
  update,
  updateBoth,
} from "../src/core/glicko";

describe("glicko-2", () => {
  it("matches Glickman's worked example", () => {
    const next = update({ rating: 1500, rd: 200, vol: 0.06 }, [
      { opponent: { rating: 1400, rd: 30 }, score: 1 },
      { opponent: { rating: 1550, rd: 100 }, score: 0 },
      { opponent: { rating: 1700, rd: 300 }, score: 0 },
    ]);
    expect(next.rating).toBeCloseTo(1464.06, 1);
    expect(next.rd).toBeCloseTo(151.52, 1);
    expect(next.vol).toBeCloseTo(0.05999, 4);
  });

  it("only grows RD (capped) with no results", () => {
    const next = update({ rating: 1600, rd: 100, vol: 0.06 }, []);
    expect(next.rating).toBe(1600);
    expect(next.rd).toBeGreaterThan(100);
    expect(update({ rating: 1500, rd: 350, vol: 0.06 }, []).rd).toBe(350);
  });

  it("moves in the direction of the result", () => {
    const opp = { rating: 1500, rd: 100 };
    const p = newGlicko();
    expect(update(p, [{ opponent: opp, score: 1 }]).rating).toBeGreaterThan(1500);
    expect(update(p, [{ opponent: opp, score: 0 }]).rating).toBeLessThan(1500);
    expect(update(p, [{ opponent: opp, score: 0.5 }]).rating).toBeCloseTo(1500, 5);
  });

  it("updates both sides, with puzzles damped after rating", () => {
    const player = { rating: 1500, rd: 200, vol: 0.06 };
    const item = { rating: 1500, rd: 350, vol: 0.06 };
    const a = updateBoth(player, item, 1);
    expect(a.player.rating).toBeGreaterThan(1500);
    expect(a.item.rating).toBeLessThan(1500);
    expect(a.item.rd).toBeLessThanOrEqual(PUZZLE_RD_CAP);

    const settled = { rating: 1500, rd: PUZZLE_RD_CAP, vol: 0.06 };
    const b = updateBoth(player, settled, 1);
    const fresh = updateBoth(player, item, 1);
    expect(1500 - b.item.rating).toBeLessThan(1500 - fresh.item.rating);
    expect(b.item.rd).toBeLessThanOrEqual(PUZZLE_RD_CAP);
  });
});
