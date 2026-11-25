import { describe, expect, it } from "vitest";
import type { DrillDef } from "../src/core/drill";
import { createRun, finishRun } from "../src/core/drillRun";
import { findDrill } from "../src/core/drillLookup";
import { evaluateGate, loadProgress, recordSession } from "../src/core/progress";
import { defaultSettings } from "../src/core/settings";

const def: DrillDef = {
  id: "t",
  title: "t",
  summary: "t",
  why: "t",
  how: [],
  end: { pieces: 3 },
  primary: "pieces",
  metrics: ["pieces"],
};
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};
const play = (run: ReturnType<typeof createRun>, n: number) => {
  for (let i = 0; i < n; i++) {
    run.controller.keyDown("hardDrop");
    run.controller.keyUp("hardDrop");
  }
};

describe("drill run", () => {
  it("stores the board before each placement", () => {
    const run = createRun(def, 1, defaultSettings());
    play(run, 2);
    expect(run.before).toHaveLength(2);
    expect(run.before[0].every((r) => r.every((c) => c === null))).toBe(true);
    expect(run.before[1].some((r) => r.some(Boolean))).toBe(true);
  });
  it("saves a finished run once, with a new best", () => {
    const store = memory();
    const run = createRun(def, 1, defaultSettings());
    play(run, 3);
    const a = finishRun(store, run, "a", 1);
    const again = finishRun(store, run, "a", 2);
    expect(a.newBest).toBe(true);
    expect(again.newBest).toBe(true);
    expect(loadProgress(store).sessions).toHaveLength(1);
    expect(loadProgress(store).sessions[0].completed).toBe(true);
  });
  it("saves a retried run as not completed", () => {
    const store = memory();
    const run = createRun(def, 1, defaultSettings());
    play(run, 3);
    run.retryFrom(1);
    expect(run.session.status).toBe("playing");
    play(run, 2);
    const out = finishRun(store, run, "b", 1);
    expect(out.assisted).toBe(true);
    expect(out.newBest).toBe(false);
    expect(loadProgress(store).sessions[0].completed).toBe(false);
  });
  it("keeps a retried save in place beside other sessions", () => {
    const store = memory();
    for (const [id, at] of [["a", 1], ["b", 2]] as const) {
      const r = createRun(def, 1, defaultSettings());
      play(r, 3);
      finishRun(store, r, id, at);
    }
    const retry = createRun(def, 1, defaultSettings());
    play(retry, 3);
    const out = finishRun(store, retry, "a", 1);
    const ids = loadProgress(store).sessions.map((x) => x.id);
    expect(ids).toEqual(["a", "b"]);
    expect(out.progress.sessions.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("does not erase a saved run when the new record is invalid", () => {
    const store = memory();
    const run = createRun(def, 1, defaultSettings());
    play(run, 3);
    finishRun(store, run, "a", 1);
    const bad = createRun(def, 1, defaultSettings());
    play(bad, 3);
    bad.session.record = () =>
      ({ id: "a", drillId: "t", endedAt: NaN, metrics: {} }) as never;
    const out = finishRun(store, bad, "a", 2);
    expect(out.progress.sessions.map((x) => x.id)).toEqual(["a"]);
    expect(loadProgress(store).sessions).toHaveLength(1);
  });
  it("still works without storage", () => {
    const run = createRun(def, 1, defaultSettings());
    play(run, 3);
    expect(finishRun(null, run, "c", 1).saved).toBe(false);
  });

  describe("direction override", () => {
    const prior = (pieces: number) =>
      recordSession(
        { version: 1, sessions: [] },
        {
          id: "p",
          drillId: "t",
          endedAt: 0,
          durationMs: 1,
          completed: true,
          metrics: { pieces },
        },
      );
    const run3 = (better?: "lower") => {
      const store = memory();
      store.setItem("tetr-trainer.progress.v1", JSON.stringify(prior(2)));
      const run = createRun({ ...def, better }, 1, defaultSettings());
      play(run, 3);
      return finishRun(store, run, "x", 5);
    };
    it("treats more pieces as worse for a lower-is-better drill", () => {
      expect(run3("lower").newBest).toBe(false);
      expect(run3().newBest).toBe(true);
    });
    it("marks cheese-100 as lower and gates honour the override", () => {
      expect(findDrill("cheese-100")?.drill.better).toBe("lower");
      const gate = {
        drillId: "t",
        metric: "pieces" as const,
        target: 3,
        over: "best" as const,
        better: "lower" as const,
      };
      expect(evaluateGate(prior(2), gate).met).toBe(true);
      expect(evaluateGate(prior(5), gate).met).toBe(false);
    });
  });
});
