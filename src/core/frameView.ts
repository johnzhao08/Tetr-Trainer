import type { Controller } from "./controller";
import { pendingLines } from "./incoming";

type Source = Pick<Controller, "state" | "elapsedMs" | "phase">;

/** What the screen shows that changes between animation frames. */
export type FrameView = {
  active: Source["state"]["active"];
  phase: Source["phase"];
  pending: number;
  second: number;
};

export const frameView = (game: Source): FrameView => ({
  active: game.state.active,
  phase: game.phase,
  // Opponent attacks change the garbage meter without moving the piece.
  pending: pendingLines(game.state.incoming),
  second: Math.floor(game.elapsedMs / 1000),
});

export const frameChanged = (a: FrameView, b: FrameView) =>
  a.active !== b.active ||
  a.phase !== b.phase ||
  a.pending !== b.pending ||
  a.second !== b.second;
