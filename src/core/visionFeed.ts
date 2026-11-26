import { VISION_KINDS } from "./vision";
import type { VisionKind, VisionQuestion } from "./vision";

export type VisionMode = "streak" | "storm" | `practice:${VisionKind}`;
/** Salts tried for one slot before the question pool counts as used up. */
export const MAX_SALTS = 200;

export const modeKind = (mode: VisionMode): VisionKind | null =>
  mode.startsWith("practice:") ? (mode.slice(9) as VisionKind) : null;

/** What the player sees: kind, board and options. Two equal keys look alike. */
export function contentKey(q: VisionQuestion): string {
  if (!q.board) return q.id;
  const options = "options" in q ? q.options : "queue" in q ? [q.queue, q.hold] : null;
  return JSON.stringify([q.kind, q.board, options]);
}

/**
 * The seed and kind of each question slot, and the rule that a run never shows
 * the same question twice. Slots advance by a different stride than the
 * generator's own retries (`seed + attempt * 0x9e3779b1`).
 */
class Slots {
  private ids = new Set<string>();
  private looks = new Set<string>();
  constructor(private readonly mode: VisionMode, private readonly seed: number) {}

  kind(index: number): VisionKind {
    return modeKind(this.mode) ?? VISION_KINDS[(this.seed + index) % VISION_KINDS.length];
  }
  seedFor(index: number, salt: number): number {
    const slot = Math.imul(index + 1, 0x85ebca6b) + Math.imul(salt, 0xc2b2ae35);
    return (this.seed + slot) >>> 0;
  }
  /** True the first time a question looks like this; later copies are refused. */
  accept(q: VisionQuestion): boolean {
    const look = contentKey(q);
    if (this.ids.has(q.id) || this.looks.has(look)) return false;
    this.ids.add(q.id);
    this.looks.add(look);
    return true;
  }
}

/**
 * Where a run gets its questions. `get(i)` is the question for slot i, null
 * once the pool is used up, or undefined while it is still being built.
 */
export interface Feed {
  get(index: number): VisionQuestion | null | undefined;
  /** Hint that slot `index` will be needed soon, so it can be built early. */
  want(index: number): void;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

export type Generate = (seed: number, kind: VisionKind) => VisionQuestion;

/** Builds questions on demand, on the calling thread. */
export class SyncFeed implements Feed {
  private slots: Slots;
  private done: (VisionQuestion | null)[] = [];
  constructor(mode: VisionMode, seed: number, private readonly generate: Generate) {
    this.slots = new Slots(mode, seed);
  }
  get(index: number) {
    while (this.done.length <= index) {
      if (this.done[this.done.length - 1] === null) return null;
      this.done.push(this.build(this.done.length));
    }
    return this.done[index];
  }
  want() {}
  subscribe() {
    return () => {};
  }
  dispose() {}

  private build(index: number): VisionQuestion | null {
    for (let salt = 0; salt < MAX_SALTS; salt++) {
      let q: VisionQuestion;
      try {
        q = this.generate(this.slots.seedFor(index, salt), this.slots.kind(index));
      } catch {
        // No candidate near this salt verified; try the next salt.
        continue;
      }
      if (this.slots.accept(q)) return q;
    }
    return null;
  }
}

/** Builds one question somewhere else; null when none verified for the seed. */
export type Fetcher = {
  fetch(seed: number, kind: VisionKind): Promise<VisionQuestion | null>;
  dispose(): void;
};

/**
 * Builds questions in order through a `Fetcher`, keeping `ahead` slots built
 * beyond the one asked for, so the next question is ready while the player
 * answers this one. Slots resolve one after another, so the same seed always
 * gives the same run.
 */
export class AsyncFeed implements Feed {
  private slots: Slots;
  private done: (VisionQuestion | null)[] = [];
  private wanted = -1;
  private pumping = false;
  private disposed = false;
  private listeners = new Set<() => void>();
  constructor(mode: VisionMode, seed: number, private readonly fetcher: Fetcher, private readonly ahead = 1) {
    this.slots = new Slots(mode, seed);
  }
  get(index: number) {
    this.want(index);
    if (index < this.done.length) return this.done[index];
    return this.done[this.done.length - 1] === null ? null : undefined;
  }
  want(index: number) {
    if (index <= this.wanted) return;
    this.wanted = index;
    void this.pump();
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
  dispose() {
    this.disposed = true;
    this.listeners.clear();
    this.fetcher.dispose();
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (
        !this.disposed &&
        this.done.length <= this.wanted + this.ahead &&
        this.done[this.done.length - 1] !== null
      ) {
        const q = await this.build(this.done.length);
        if (this.disposed) return;
        this.done.push(q);
        for (const l of [...this.listeners]) l();
      }
    } finally {
      this.pumping = false;
    }
  }

  private async build(index: number): Promise<VisionQuestion | null> {
    for (let salt = 0; salt < MAX_SALTS && !this.disposed; salt++) {
      let q: VisionQuestion | null;
      try {
        q = await this.fetcher.fetch(this.slots.seedFor(index, salt), this.slots.kind(index));
      } catch {
        continue;
      }
      if (q && this.slots.accept(q)) return q;
    }
    return null;
  }
}
