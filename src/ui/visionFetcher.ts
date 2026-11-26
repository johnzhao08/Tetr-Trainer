import type { Fetcher } from "../core/visionFeed";
import type { VisionKind, VisionQuestion } from "../core/vision";
import { answerAsk } from "./visionWorker";
import type { WorkerAsk, WorkerReply } from "./visionWorker";

/** Same generator on the main thread, one task later so the page can paint first. */
const inlineFetcher = (): Fetcher => {
  const timers = new Map<ReturnType<typeof setTimeout>, () => void>();
  return {
    fetch: (seed, kind) =>
      new Promise((done) => {
        const t = setTimeout(() => {
          timers.delete(t);
          done(answerAsk({ id: 0, seed, kind }).question);
        }, 0);
        timers.set(t, () => done(null));
      }),
    dispose() {
      for (const [t, settle] of timers) {
        clearTimeout(t);
        settle();
      }
      timers.clear();
    },
  };
};

/** A Web Worker keeps the page responsive (a question can take a second); inline if it cannot start. */
export function createFetcher(
  makeWorker: () => Worker = () =>
    new Worker(new URL("./visionWorker.ts", import.meta.url), { type: "module" }),
): Fetcher {
  let worker: Worker;
  try {
    if (typeof Worker === "undefined") return inlineFetcher();
    worker = makeWorker();
  } catch {
    return inlineFetcher();
  }
  type Ask = { seed: number; kind: VisionKind; done: (q: VisionQuestion | null) => void };
  const pending = new Map<number, Ask>();
  let nextId = 0;
  let inline: Fetcher | null = null;
  let disposed = false;
  // The worker died (its script failed to load, or it crashed): answer every
  // open request, and all later ones, on the main thread with the same ask.
  const fallBack = () => {
    if (disposed || inline) return;
    worker.terminate();
    inline = inlineFetcher();
    const open = [...pending.values()];
    pending.clear();
    for (const a of open) void inline.fetch(a.seed, a.kind).then(a.done);
  };
  worker.onmessage = (e: MessageEvent<WorkerReply>) => {
    pending.get(e.data.id)?.done(e.data.question);
    pending.delete(e.data.id);
  };
  worker.onerror = fallBack;
  return {
    fetch: (seed: number, kind: VisionKind) => {
      if (inline) return inline.fetch(seed, kind);
      return new Promise((done) => {
        const id = nextId++;
        pending.set(id, { seed, kind, done });
        worker.postMessage({ id, seed, kind } satisfies WorkerAsk);
      });
    },
    dispose() {
      disposed = true;
      worker.terminate();
      inline?.dispose();
      for (const a of pending.values()) a.done(null);
      pending.clear();
    },
  };
}
