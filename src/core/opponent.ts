import { nextRandom } from "./rng";

export type OpponentConfig = {
  seed: number;
  /** Attack per minute over the long run. */
  apm: number;
  /** Spike sizes (for example 5 to 8) drawn occasionally; none when omitted. */
  burst?: number[];
};
export type OpponentState = {
  rng: number;
  /** Milliseconds until the next attack. */
  wait: number;
  /** Size of the next attack. */
  size: number;
};

const SPIKE_CHANCE = 0.1;
// Cumulative weights for sizes 1 to 4.
const SIZES = [0.35, 0.65, 0.85, 1];

/**
 * Scripted attacker. Each attack of n lines is followed by n * 60000 / apm ms,
 * so the long-run rate is exactly apm. All state lives in `state` so a Game
 * can snapshot and restore it.
 */
export class Opponent {
  state: OpponentState;
  constructor(
    seed: number,
    private readonly config: { apm: number; burst?: number[] },
  ) {
    this.state = { rng: seed >>> 0, wait: 0, size: 0 };
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
    s.wait =
      this.config.apm > 0 ? (s.size * 60000) / this.config.apm : Infinity;
  }
  /** Attacks that land during the next `ms` milliseconds, in order. */
  advance(ms: number): number[] {
    const s = this.state;
    const out: number[] = [];
    while (ms >= s.wait) {
      ms -= s.wait;
      out.push(s.size);
      this.draw();
    }
    s.wait -= ms;
    return out;
  }
}
