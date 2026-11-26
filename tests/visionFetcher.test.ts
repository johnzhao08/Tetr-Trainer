import { afterEach, describe, expect, it, vi } from "vitest";
import { generateQuestion } from "../src/core/vision";
import { createFetcher } from "../src/ui/visionFetcher";
import type { WorkerAsk, WorkerReply } from "../src/ui/visionWorker";

/** Just enough Worker to drive the fetcher. */
class FakeWorker {
  onmessage: ((e: MessageEvent<WorkerReply>) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  asks: WorkerAsk[] = [];
  postMessage = (ask: WorkerAsk) => this.asks.push(ask);
  terminate = () => (this.terminated = true);
}
const withWorker = () => ((globalThis as { Worker?: unknown }).Worker = FakeWorker);
afterEach(() => delete (globalThis as { Worker?: unknown }).Worker);

describe("vision fetcher", () => {
  it("runs on the main thread without Worker, with the same question", async () => {
    const same = generateQuestion(12, "noSlot");
    expect(await createFetcher().fetch(12, "noSlot")).toEqual(same);
    withWorker();
    expect(await createFetcher(() => { throw new Error("blocked"); }).fetch(12, "noSlot")).toEqual(same);
  });

  it("falls back to the main thread when the worker fails to load, keeping the ask", async () => {
    withWorker();
    const w = new FakeWorker();
    const fetcher = createFetcher(() => w as unknown as Worker);
    const open = fetcher.fetch(12, "noSlot");
    w.onerror?.();
    expect(w.terminated).toBe(true);
    const same = generateQuestion(12, "noSlot");
    expect(await open).toEqual(same);
    // Later asks skip the dead worker.
    expect(await fetcher.fetch(12, "noSlot")).toEqual(same);
    expect(w.asks).toHaveLength(1);
  });

  it("inline dispose cancels the timer and settles the pending ask", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = createFetcher();
      const asked = fetcher.fetch(12, "noSlot");
      expect(vi.getTimerCount()).toBe(1);
      fetcher.dispose();
      expect(vi.getTimerCount()).toBe(0);
      expect(await asked).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("matches replies to asks by id, and clears them on dispose", async () => {
    withWorker();
    const w = new FakeWorker();
    const fetcher = createFetcher(() => w as unknown as Worker);
    const a = fetcher.fetch(1, "noSlot");
    const b = fetcher.fetch(2, "forecast");
    const q = generateQuestion(1, "noSlot");
    w.onmessage?.({ data: { id: w.asks[0].id, question: q } } as MessageEvent<WorkerReply>);
    expect(await a).toBe(q);
    fetcher.dispose();
    expect(await b).toBeNull();
    expect(w.terminated).toBe(true);
  });
});
