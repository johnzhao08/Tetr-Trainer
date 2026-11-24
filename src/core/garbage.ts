import { WIDTH, type Cell } from "./board";

export type GarbageSpec = {
  /** Garbage rows kept on the board while any remain to be dealt. */
  rows: number;
  /** Total garbage lines in the race. */
  total: number;
  /** Chance (0-1) that a row's hole moves away from the row below. */
  messiness: number;
};

/** Deterministic single-hole garbage, bottom row first. */
export class GarbageSource {
  private state: number;
  private hole: number;
  dealt = 0;

  constructor(
    seed: number,
    readonly spec: GarbageSpec,
  ) {
    this.state = seed >>> 0 || 1;
    this.hole = this.next() % WIDTH;
  }

  private next() {
    // xorshift32
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  get remaining() {
    return this.spec.total - this.dealt;
  }

  /** The next garbage row, or null when the race has no more. */
  row(): Cell[] | null {
    if (this.remaining <= 0) return null;
    if (this.dealt > 0 && this.next() / 2 ** 32 < this.spec.messiness)
      // Pick a different column so a messy row always changes.
      this.hole = (this.hole + 1 + (this.next() % (WIDTH - 1))) % WIDTH;
    this.dealt++;
    return Array.from({ length: WIDTH }, (_, x) => (x === this.hole ? null : "X"));
  }
}

export const hasGarbage = (row: readonly Cell[]) => row.includes("X");
