import type { OpponentState } from "./opponent";

/** TETR.IO warns in 1v1 when you are this many B2B behind. */
export const B2B_WARNING_GAP = 8;
/** At this opponent height a big attack is most dangerous to them. */
export const SPIKE_WINDOW_HEIGHT = 12;

/** Opponent B2B minus yours; both count from 0 (-1 means none). */
export const b2bGap = (playerB2b: number, opponent: OpponentState) =>
  Math.max(0, opponent.b2b) - Math.max(0, playerB2b);

export const b2bWarning = (playerB2b: number, opponent: OpponentState) =>
  b2bGap(playerB2b, opponent) >= B2B_WARNING_GAP;

export const spikeWindow = (opponent: OpponentState) =>
  opponent.alive && opponent.height >= SPIKE_WINDOW_HEIGHT;
