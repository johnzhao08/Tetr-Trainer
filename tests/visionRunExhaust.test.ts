import { describe, expect, it, vi } from "vitest";

// A tiny pool: only POOL distinct ids exist, however many seeds are tried.
const POOL = 3;
vi.mock("../src/core/vision", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/core/vision")>();
  return {
    ...real,
    // Cheap stand-in: the run only reads the id.
    generateQuestion: (seed: number) => ({ id: `fake-${seed % POOL}`, seed }),
  };
});

import { MAX_SALTS, PRACTICE_QUESTIONS, VisionRun } from "../src/core/visionRun";

describe("VisionRun question pool exhaustion", () => {
  it("ends the practice set early instead of repeating a question", () => {
    const run = new VisionRun("practice:whichPiece", 5, 0);
    const ids = [run.question.id];
    let t = 0;
    while (!run.over && ids.length <= PRACTICE_QUESTIONS) {
      run.answer(true, (t += 10));
      if (run.over) break;
      run.next();
      run.show((t += 5));
      ids.push(run.question.id);
    }
    expect(run.over).toBe(true);
    expect(run.exhausted).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(POOL);
    expect(run.answered).toBeLessThan(PRACTICE_QUESTIONS);
    // A short set is not a completed one.
    expect(run.record("x", 1).completed).toBe(false);
  });

  it("searches past the old 20-salt cap before giving up", () => {
    expect(MAX_SALTS).toBeGreaterThan(20);
  });
});

describe("VisionRun when generation throws", () => {
  const ok = (seed: number) => ({ id: `ok-${seed}`, seed }) as never;

  it("tries more salts after a failure and keeps going", () => {
    let calls = 0;
    const run = new VisionRun("streak", 7, 0, (seed) => {
      if (calls++ < 5) throw new Error("no question");
      return ok(seed);
    });
    expect(run.question.id.startsWith("ok-")).toBe(true);
    expect(run.exhausted).toBe(false);
    expect(run.over).toBe(false);
  });

  it("ends the run early and incomplete when nothing can be generated", () => {
    let fail = false;
    const run = new VisionRun("practice:findSlot", 7, 0, (seed) => {
      if (fail) throw new Error("no question");
      return ok(seed);
    });
    fail = true;
    expect(run.answer(true, 100)).toBe(true);
    expect(run.over).toBe(true);
    expect(run.exhausted).toBe(true);
    const rec = run.record("t", 1);
    expect(rec.completed).toBe(false);
    expect(rec.metrics.score).toBe(1);
  });

  it("ends before the first question when the generator always throws", () => {
    const run = new VisionRun("streak", 7, null, () => {
      throw new Error("no question");
    });
    expect(run.over).toBe(true);
    expect(run.exhausted).toBe(true);
    expect(run.asking).toBe(false);
    expect(run.record("t", 1).completed).toBe(false);
  });
});

describe("VisionRun when the next slot is empty while a question is open", () => {
  const feed = () => {
    let drained = false;
    const l = new Set<() => void>();
    return {
      get: (i: number) => (i === 0 ? ({ id: "only" } as never) : drained ? null : undefined),
      want() {},
      subscribe: (f: () => void) => (l.add(f), () => void l.delete(f)),
      dispose() {},
      drain() {
        drained = true;
        l.forEach((f) => f());
      },
    };
  };

  it("lets the player answer the open question in either arrival order", () => {
    const early = feed();
    const a = new VisionRun("streak", 1, 0, early);
    early.drain();
    a.poll();
    expect(a.over).toBe(false);
    a.answer(true, 50);
    const late = feed();
    const b = new VisionRun("streak", 1, 0, late);
    b.answer(true, 50);
    late.drain();
    b.poll();
    for (const r of [a, b]) {
      expect([r.over, r.exhausted, r.score]).toEqual([true, true, 1]);
      expect(r.record("x", 1).completed).toBe(false);
    }
  });
});
