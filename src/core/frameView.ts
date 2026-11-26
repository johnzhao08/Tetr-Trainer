import type { Controller } from "./controller";
import { pendingLines } from "./incoming";

type Source = Pick<Controller, "state" | "elapsedMs" | "phase">;

/** What the screen shows that changes between animation frames. */
export type FrameView = {
  active: Source["state"]["active"];
  phase: Source["phase"];
  pending: number;
  second: number;
  /** The bot's placement count and life: its board changes only then. */
  botPieces: number;
  botAlive: boolean;
};

export const frameView = (game: Source): FrameView => ({
  active: game.state.active,
  phase: game.phase,
  // Opponent attacks change the garbage meter without moving the piece.
  pending: pendingLines(game.state.incoming),
  second: Math.floor(game.elapsedMs / 1000),
  botPieces: game.state.bot?.pieces ?? 0,
  botAlive: game.state.bot?.alive ?? true,
});

/**
 * Longest stretch of game time simulated in one animation frame. A late frame
 * (a stall, a throttled tab) would otherwise run every overdue bot decision
 * at once; the rest waits in a backlog and is worked off over the next frames,
 * in order, so the simulation is the same, only spread out.
 */
export const MAX_STEP_MS = 100;

/** Splits `backlog` ms into this frame's step and what is left for later. */
export const takeStep = (backlog: number, max = MAX_STEP_MS) => {
  const step = Math.min(backlog, max);
  return { step, rest: backlog - step };
};

/**
 * Game time owed to the simulation. `budget` is what this rendered frame may
 * still simulate, shared by the frame callback and every input event in it,
 * so a press and release between frames cannot each drain a full step.
 */
export type Pacer = { previous: number; backlog: number; budget: number };

export const newPacer = (now: number, max = MAX_STEP_MS): Pacer => ({
  previous: now,
  backlog: 0,
  budget: max,
});

/** A new rendered frame: refill the budget. */
export const startFrame = (p: Pacer, max = MAX_STEP_MS) => {
  p.budget = max;
};

/** Drops the backlog and the clock, for a restart, pause or refocus. */
export const resetPacer = (p: Pacer, now: number) => {
  p.previous = now;
  p.backlog = 0;
};

/**
 * A manual pause or resume: time spent paused is never owed to the
 * simulation, so a stalled page cannot spend it on gravity or bot moves after
 * resuming.
 */
export const settlePause = (p: Pacer, now: number) => resetPacer(p, now);

/**
 * Takes the real time since the last call and returns how many ms of game
 * time to tick now, never more than the frame's remaining budget. Time cannot
 * run backwards.
 */
export const paceStep = (p: Pacer, now: number): number => {
  p.backlog += Math.max(0, now - p.previous);
  p.previous = Math.max(p.previous, now);
  const { step, rest } = takeStep(p.backlog, p.budget);
  p.backlog = rest;
  p.budget -= step;
  return step;
};

export const frameChanged = (a: FrameView, b: FrameView) =>
  a.active !== b.active ||
  a.phase !== b.phase ||
  a.pending !== b.pending ||
  a.second !== b.second ||
  a.botPieces !== b.botPieces ||
  a.botAlive !== b.botAlive;
