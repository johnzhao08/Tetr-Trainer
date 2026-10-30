import type { PlannedMove } from "../core/solver/search";

// Keep the composite in pre-clear stack coordinates. Playback uses real poses.
export function overlayPlacements(
  moves: readonly Pick<PlannedMove, "piece" | "cleared">[],
) {
  let clearedRows = 0;
  return moves.map(({ piece, cleared }) => {
    const displayed = { ...piece, y: piece.y + clearedRows };
    clearedRows += cleared;
    return displayed;
  });
}
