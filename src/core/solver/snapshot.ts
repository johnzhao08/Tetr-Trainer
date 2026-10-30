import type { GameState } from "../game";
import type { SolverPosition } from "./search";

// Locks/restart/undo replace the board; hold changes hold/canHold. Pose-only
// input, clocks and pause retain the last analysis snapshot by design.
export function solverSnapshot(
  state: GameState,
  previous?: SolverPosition,
): SolverPosition {
  if (
    previous &&
    previous.board === state.board &&
    previous.hold === state.hold &&
    previous.canHold === state.canHold
  )
    return previous;
  return {
    board: state.board,
    active: state.active ? { ...state.active } : null,
    hold: state.hold,
    canHold: state.canHold,
    visibleQueue: state.queue.slice(0, 5),
  };
}
