import type { GameState } from "./game";

/** What the HUD needs of a rival; scripted opponents and bots both fit. */
export type Rival = {
  height: number;
  b2b: number;
  surge: boolean;
  alive: boolean;
};

/** The player's rival in a game: the bot when there is one, else the scripted opponent. */
export const rivalOf = (state: Pick<GameState, "opponent" | "bot">): Rival | null =>
  state.bot ?? state.opponent;

/** TETR.IO warns in 1v1 when you are this many B2B behind. */
export const B2B_WARNING_GAP = 8;
/** At this opponent height a big attack is most dangerous to them. */
export const SPIKE_WINDOW_HEIGHT = 12;

/** Opponent B2B minus yours; both count from 0 (-1 means none). */
export const b2bGap = (playerB2b: number, opponent: Rival) =>
  Math.max(0, opponent.b2b) - Math.max(0, playerB2b);

export const b2bWarning = (playerB2b: number, opponent: Rival) =>
  b2bGap(playerB2b, opponent) >= B2B_WARNING_GAP;

export const spikeWindow = (opponent: Rival) =>
  opponent.alive && opponent.height >= SPIKE_WINDOW_HEIGHT;
