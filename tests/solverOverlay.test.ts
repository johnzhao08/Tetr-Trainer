import { describe, expect, it } from "vitest";
import { overlayPlacements } from "../src/ui/solverOverlay";
import type { Piece } from "../src/core/board";

const piece: Piece = { type: "T", x: 4, y: 8, rotation: 0 };
describe("solver overlay", () => {
  it("lifts later placements by cumulative clears without changing playback poses", () => {
    const moves = [4, 0, 2, 0].map((cleared) => ({
      piece: { ...piece },
      cleared,
    }));
    expect(overlayPlacements(moves).map((p) => p.y)).toEqual([8, 12, 12, 14]);
    expect(moves.map((m) => m.piece.y)).toEqual([8, 8, 8, 8]);
  });
  it("preserves placements when no rows clear", () => {
    expect(
      overlayPlacements([
        { piece, cleared: 0 },
        { piece, cleared: 0 },
      ]),
    ).toEqual([piece, piece]);
  });
});
