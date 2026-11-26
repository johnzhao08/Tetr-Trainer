import { describe, expect, it } from "vitest";
import type { VisionKind, VisionQuestion } from "../src/core/vision";
import { AsyncFeed, contentKey, SyncFeed } from "../src/core/visionFeed";
import { PRACTICE_QUESTIONS, VisionRun } from "../src/core/visionRun";

const fake = (seed: number, kind: VisionKind) =>
  ({ id: `${kind}-${seed}`, kind, seed, board: [[seed % 5]] }) as unknown as VisionQuestion;
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

/** A fetcher the test releases by hand, one request at a time. */
function manual() {
  type Ask = { seed: number; kind: VisionKind; done: (q: VisionQuestion | null) => void };
  const waiting: Ask[] = [];
  const fetcher = {
    disposed: false,
    fetch: (seed: number, kind: VisionKind) =>
      new Promise<VisionQuestion | null>((done) => waiting.push({ seed, kind, done })),
    dispose() {
      this.disposed = true;
    },
  };
  const release = async (i: number) => {
    waiting[i].done(fake(waiting[i].seed, waiting[i].kind));
    await settle();
  };
  return { fetcher, waiting, release };
}

describe("run content", () => {
  it("never repeats what the player sees (structure, seed 39)", () => {
    const run = new VisionRun("practice:structure", 39, 0);
    const looks = [contentKey(run.question)];
    let t = 0;
    while (looks.length < PRACTICE_QUESTIONS) {
      run.answer(true, (t += 10));
      run.next();
      run.show((t += 5));
      looks.push(contentKey(run.question));
    }
    expect(new Set(looks).size).toBe(PRACTICE_QUESTIONS);
  });
});

describe("AsyncFeed", () => {
  it("is pending, then ready, and tells listeners", async () => {
    const { fetcher, release } = manual();
    const feed = new AsyncFeed("streak", 1, fetcher);
    let pings = 0;
    feed.subscribe(() => pings++);
    expect(feed.get(0)).toBeUndefined();
    await release(0);
    expect(feed.get(0)).toBeTruthy();
    expect(pings).toBe(1);
  });

  it("keeps one slot ahead and no more", async () => {
    const { fetcher, waiting, release } = manual();
    const feed = new AsyncFeed("practice:noSlot", 3, fetcher);
    feed.get(0);
    await release(0);
    await release(1);
    expect(waiting.length).toBe(2);
    feed.get(1);
    await settle();
    expect(waiting.length).toBe(3);
  });

  it("matches the sync feed for the same seed", async () => {
    const sync = new SyncFeed("storm", 9, fake);
    const feed = new AsyncFeed("storm", 9, { fetch: async (s, k) => fake(s, k), dispose() {} });
    feed.get(4);
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 5; i++) expect(feed.get(i)).toEqual(sync.get(i));
  });

  it("skips failed and repeated candidates, then reports the pool used up", async () => {
    let calls = 0;
    const same = { id: "same", kind: "noSlot", seed: 0, board: [[1]] } as unknown as VisionQuestion;
    const feed = new AsyncFeed("practice:noSlot", 5, {
      fetch: async () => (calls++ < 2 ? null : same),
      dispose() {},
    });
    feed.get(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(feed.get(0)?.id).toBe("same");
    expect(feed.get(1)).toBeNull();
  });

  it("stops and frees the fetcher on dispose", async () => {
    const { fetcher, waiting, release } = manual();
    const feed = new AsyncFeed("streak", 1, fetcher);
    feed.get(0);
    feed.dispose();
    await release(0);
    expect(fetcher.disposed).toBe(true);
    expect(waiting.length).toBe(1);
  });
});

describe("VisionRun on an async feed", () => {
  const start = () => {
    const m = manual();
    const feed = new AsyncFeed("streak", 2, m.fetcher);
    const run = new VisionRun("streak", 2, null, feed);
    feed.subscribe(() => run.poll());
    return { ...m, run };
  };

  it("prefetches while answering and does not charge for waiting", async () => {
    const { run, release } = start();
    expect(run.loading).toBe(true);
    await release(0);
    expect(run.loading).toBe(false);
    run.show(100);
    expect(run.asking).toBe(true);
    await release(1);
    const first = run.question.id;
    run.answer(true, 300);
    run.next();
    expect(run.loading).toBe(false);
    expect(run.question.id).not.toBe(first);
    run.show(400);
    expect(run.record("x", 1).durationMs).toBe(200);
  });

  it("shows Preparing when Next comes early, then moves on", async () => {
    const { run, release } = start();
    await release(0);
    run.show(0);
    run.answer(true, 50);
    run.next();
    expect(run.loading).toBe(true);
    run.show(60);
    expect(run.asking).toBe(false);
    await release(1);
    expect(run.loading).toBe(false);
    run.show(500);
    expect(run.asking).toBe(true);
  });

  it("ends the run when the pool runs dry", async () => {
    const feed = new AsyncFeed("streak", 2, { fetch: async () => null, dispose() {} });
    const run = new VisionRun("streak", 2, null, feed);
    feed.subscribe(() => run.poll());
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    expect(run.over && run.exhausted && !run.loading).toBe(true);
  });
});
