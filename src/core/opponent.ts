import { nextRandom } from "./rng";

export type OpponentConfig = {
  seed: number;
  /** Attack per minute over the long run. */
  apm: number;
  /** Spike sizes (for example 5 to 8) drawn occasionally; none when omitted. */
  burst?: number[];
  /** Its piece rate; sets how fast its stack grows. Default 2. */
  pps?: number;
  /** When true, a B2B chain of 4 or more sometimes breaks with a Surge. */
  surge?: boolean;
};
export type OpponentState = {
  rng: number;
  /** Milliseconds until the next attack. */
  wait: number;
  /** Size of the next attack, Surge included. */
  size: number;
  /** Lines the next attack clears from its own board. */
  cleared: number;
  /** Whether the next attack keeps its B2B (otherwise it breaks it). */
  keep: boolean;
  /** Rows of its own stack (capped at STACK_MAX) and of landed garbage. */
  stack: number;
  dirt: number;
  /** Rows on its board, rounded: stack plus garbage. */
  height: number;
  /** B2B count, -1 when none (same convention as the player's). */
  b2b: number;
  /** Garbage from the player that has not landed yet. */
  pending: number;
  /** Milliseconds until pending garbage lands. */
  landIn: number;
  /** False once its height reaches TOP_OUT_HEIGHT. */
  alive: boolean;
};

export const TOP_OUT_HEIGHT = 20;
const STACK_MIN = 2;
const STACK_MAX = 10;
const LAND_DELAY_MS = 333;
const LAND_EVERY_MS = 600;
const LAND_CAP = 8;
// Rows its stack grows per piece (4 cells over a 10-wide board).
const ROWS_PER_PIECE = 0.4;
const SURGE_AT = 4;
const SPIKE_CHANCE = 0.1;
const KEEP_CHANCE = 0.85;
// Cumulative weights for sizes 1 to 4.
const SIZES = [0.35, 0.65, 0.85, 1];

/**
 * Simulated rival. Attacks arrive on a schedule (each attack of n lines is
 * followed by n * 60000 / apm ms, so the long-run rate is exactly apm), but it
 * also has a board: its stack grows with its pps and each attack clears lines
 * (garbage first, which is how it digs). Attacks that keep its B2B build a
 * chain; a break at 4 or more can release a Surge. It cancels its own pending
 * garbage before sending, receives the player's sent lines, and tops out at
 * TOP_OUT_HEIGHT. All state lives in `state` so a Game can snapshot and
 * restore it.
 */
export class Opponent {
  state: OpponentState;
  constructor(
    seed: number,
    private readonly config: Omit<OpponentConfig, "seed">,
  ) {
    this.state = {
      rng: seed >>> 0,
      wait: 0,
      size: 0,
      cleared: 1,
      keep: true,
      stack: STACK_MIN,
      dirt: 0,
      height: STACK_MIN,
      b2b: -1,
      pending: 0,
      landIn: 0,
      alive: true,
    };
    this.draw();
  }
  private draw() {
    const s = this.state;
    const burst = this.config.burst;
    if (burst?.length && nextRandom(s) < SPIKE_CHANCE)
      s.size = burst[Math.floor(nextRandom(s) * burst.length)];
    else {
      const r = nextRandom(s);
      s.size = SIZES.findIndex((cut) => r < cut) + 1;
    }
    s.cleared = Math.min(4, s.size);
    s.keep = nextRandom(s) < KEEP_CHANCE;
    if (!s.keep && this.config.surge && s.b2b >= SURGE_AT) s.size += s.b2b;
    s.wait =
      this.config.apm > 0 ? (s.size * 60000) / this.config.apm : Infinity;
  }
  private refresh() {
    const s = this.state;
    s.height = Math.round(s.stack + s.dirt);
    if (s.height >= TOP_OUT_HEIGHT) s.alive = false;
  }
  /** Queue lines the player sent; they land after a short delay. */
  receive(lines: number) {
    const s = this.state;
    if (!s.alive || lines <= 0) return;
    if (s.pending === 0) s.landIn = LAND_DELAY_MS;
    s.pending += lines;
  }
  private attack(out: number[]) {
    const s = this.state;
    // Its own pending garbage is cancelled first.
    const cancelled = Math.min(s.pending, s.size);
    s.pending -= cancelled;
    if (s.size > cancelled) out.push(s.size - cancelled);
    const dug = Math.min(s.dirt, s.cleared);
    s.dirt -= dug;
    s.stack = Math.max(STACK_MIN, s.stack - (s.cleared - dug));
    s.b2b = s.keep ? s.b2b + 1 : -1;
    this.draw();
  }
  /** Attacks that land during the next `ms` milliseconds, in order. */
  advance(ms: number): number[] {
    const s = this.state;
    const out: number[] = [];
    while (ms > 0 && s.alive) {
      const toLand = s.pending > 0 ? s.landIn : Infinity;
      const step = Math.min(ms, s.wait, toLand);
      ms -= step;
      s.wait -= step;
      if (s.pending > 0) s.landIn -= step;
      s.stack = Math.min(
        STACK_MAX,
        s.stack + ((this.config.pps ?? 2) * ROWS_PER_PIECE * step) / 1000,
      );
      if (s.wait <= 0) this.attack(out);
      if (s.pending > 0 && s.landIn <= 0) {
        const n = Math.min(s.pending, LAND_CAP);
        s.pending -= n;
        s.dirt += n;
        s.landIn = LAND_EVERY_MS;
      }
      this.refresh();
    }
    return out;
  }
}
