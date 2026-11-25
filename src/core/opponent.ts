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
  /**
   * Whether the player's sent lines reach it. Only versus modes set this;
   * attacker drills keep sustained pressure on the player.
   */
  receives?: boolean;
  /** Board and chain it begins with (scripted scenarios); default is a fresh game. */
  start?: { stack?: number; dirt?: number; b2b?: number };
};
/** Garbage from the player that has not landed yet. */
export type Packet = {
  lines: number;
  /** Opponent clock time (ms) when it may land. */
  readyAt: number;
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
  /** The opponent's own clock in milliseconds. */
  clock: number;
  /** Player garbage in flight, oldest first, each with its own travel time. */
  queue: Packet[];
  /** Earliest clock time the next landing may happen (landing cadence). */
  nextLand: number;
  /** Whether its B2B breaks can release a Surge (for the HUD). */
  surge: boolean;
  /** False once its height reaches TOP_OUT_HEIGHT. */
  alive: boolean;
};

export const TOP_OUT_HEIGHT = 20;
export const STACK_MIN = 2;
export const STACK_MAX = 10;
const LAND_DELAY_MS = 333;
const LAND_EVERY_MS = 600;
const LAND_CAP = 8;
const EPS = 1e-9;
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
      clock: 0,
      queue: [],
      nextLand: 0,
      surge: config.surge === true,
      alive: true,
    };
    Object.assign(this.state, config.start);
    this.refresh();
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
    if (!this.config.receives || !s.alive || lines <= 0) return;
    s.queue.push({ lines, readyAt: s.clock + LAND_DELAY_MS });
  }
  /** Milliseconds until the next landing, Infinity when nothing is queued. */
  private untilLand() {
    const s = this.state;
    if (s.queue.length === 0) return Infinity;
    return Math.max(0, Math.max(s.queue[0].readyAt, s.nextLand) - s.clock);
  }
  private land() {
    const s = this.state;
    let room = LAND_CAP;
    while (room > 0 && s.queue.length && s.queue[0].readyAt <= s.clock + EPS) {
      const n = Math.min(room, s.queue[0].lines);
      s.queue[0].lines -= n;
      room -= n;
      s.dirt += n;
      if (s.queue[0].lines === 0) s.queue.shift();
    }
    s.nextLand = s.clock + LAND_EVERY_MS;
  }
  private attack(out: number[], scale: number) {
    const s = this.state;
    // The attack is scaled and floored first, then cancels its own pending
    // garbage, oldest packet first, exactly like the player's path.
    const gross = Math.floor(s.size * scale);
    let cancelled = 0;
    while (cancelled < gross && s.queue.length) {
      const n = Math.min(gross - cancelled, s.queue[0].lines);
      s.queue[0].lines -= n;
      cancelled += n;
      if (s.queue[0].lines === 0) s.queue.shift();
    }
    if (gross > cancelled) out.push(gross - cancelled);
    const dug = Math.min(s.dirt, s.cleared);
    s.dirt -= dug;
    s.stack = Math.max(STACK_MIN, s.stack - (s.cleared - dug));
    s.b2b = s.keep ? s.b2b + 1 : -1;
    this.draw();
  }
  /**
   * Attacks that land during the next `ms` milliseconds, in order. `scale`
   * multiplies each attack (floored) before it cancels pending garbage.
   */
  advance(ms: number, scale = 1): number[] {
    const s = this.state;
    const out: number[] = [];
    while (ms > 0 && s.alive) {
      const step = Math.min(ms, s.wait, this.untilLand());
      ms -= step;
      s.wait -= step;
      s.clock += step;
      s.stack = Math.min(
        STACK_MAX,
        s.stack + ((this.config.pps ?? 2) * ROWS_PER_PIECE * step) / 1000,
      );
      if (s.wait <= 0) this.attack(out, scale);
      if (this.untilLand() <= EPS) this.land();
      this.refresh();
    }
    return out;
  }
}

/** Lines of player garbage still in flight. */
export const opponentPending = (state: OpponentState) =>
  state.queue.reduce((sum, p) => sum + p.lines, 0);
