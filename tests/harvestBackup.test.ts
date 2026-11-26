import { describe, expect, it } from "vitest";
import { exportBackup, importBackup, restoreBoth } from "../src/core/backup";
import { findDrill } from "../src/core/drillLookup";
import { DrillSession } from "../src/core/drillSession";
import {
  PUZZLES_KEY,
  addPuzzles,
  emptyPuzzleStore,
  hasPuzzleData,
  harvestRecord,
  loadPuzzleStore,
  loadPuzzles,
  reconcileHarvest,
} from "../src/core/harvest";
import { PROGRESS_KEY, emptyProgress, exportProgress, recordSession, saveProgress } from "../src/core/progress";
import { defaultSettings } from "../src/core/settings";
import type { Action } from "../src/core/settings";
import { TRAINING_KEY, emptyTraining, exportTraining, saveTraining } from "../src/core/training";
import type { Training } from "../src/core/training";

const press = (s: DrillSession, action: Action) => {
  s.keyDown(action);
  s.keyUp(action);
};
function sloppyRecord(id: string, endedAt: number) {
  const s = new DrillSession(findDrill("clean-100")!.drill, 11, defaultSettings());
  for (let n = 0; n < 60 && s.status === "playing"; n++) {
    const k = (n * 5 + 11) % 9;
    if (k === 0) press(s, "hold");
    for (let i = 0; i < k % 4; i++) press(s, "cw");
    for (let i = 0; i < k; i++) press(s, k % 2 ? "left" : "right");
    press(s, "hardDrop");
  }
  return s.record(id, endedAt);
}

const makeStorage = (failKey: string | null = null) => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k === failKey) throw new Error("quota");
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
  };
};

const record = sloppyRecord("r1", 1000);
const progress = recordSession(emptyProgress(), record);
const puzzles = harvestRecord(record);

describe("puzzle store in backups", () => {
  it("round-trips the puzzles and processed ids", () => {
    expect(puzzles.length).toBeGreaterThan(0);
    const store = { puzzles, processed: ["r1"] };
    const back = importBackup(exportBackup(progress, emptyTraining(), store));
    expect(back!.puzzles).toEqual(loadPuzzleStoreOf(store));
    expect(back!.puzzles.processed).toEqual(["r1"]);
    expect(back!.puzzles.puzzles.map((p) => p.id)).toEqual(puzzles.map((p) => p.id));
  });

  it("still imports version 2 and version 1 backups, with an empty puzzle store", () => {
    const v2 = JSON.stringify({
      version: 2,
      progress: JSON.parse(exportProgress(progress)),
      training: JSON.parse(exportTraining(emptyTraining())),
    });
    const a = importBackup(v2)!;
    expect(a.progress.progress).toEqual(progress);
    expect(a.training).toEqual(emptyTraining());
    expect(a.puzzles).toEqual(emptyPuzzleStore());
    const b = importBackup(exportProgress(progress))!;
    expect(b.training).toBeNull();
    expect(b.puzzles).toEqual(emptyPuzzleStore());
  });

  it("rejects a version 3 backup whose puzzle store is missing or malformed", () => {
    const base = {
      version: 3,
      progress: JSON.parse(exportProgress(progress)),
      training: JSON.parse(exportTraining(emptyTraining())),
    };
    expect(importBackup(JSON.stringify(base))).toBeNull();
    expect(importBackup(JSON.stringify({ ...base, puzzles: { version: 9 } }))).toBeNull();
  });

  it("restores the puzzle store, so an imported backup does not harvest twice", () => {
    const storage = makeStorage();
    const back = importBackup(exportBackup(progress, emptyTraining(), { puzzles, processed: ["r1"] }))!;
    expect(restoreBoth(storage, { progress: back.progress.progress, training: emptyTraining(), puzzles: back.puzzles })).toBe(true);
    expect(loadPuzzles(storage).map((p) => p.id)).toEqual(puzzles.map((p) => p.id));
    expect(loadPuzzleStore(storage).processed).toEqual(["r1"]);
  });
});

describe("reset and restore are transactional with the puzzle store", () => {
  it("reset clears the puzzles and processed ids, and nothing is harvested back", () => {
    const storage = makeStorage();
    addPuzzles(storage, puzzles, ["r1"]);
    expect(loadPuzzles(storage).length).toBeGreaterThan(0);
    expect(restoreBoth(storage, { progress: emptyProgress(), training: emptyTraining(), puzzles: emptyPuzzleStore() })).toBe(true);
    expect(loadPuzzleStore(storage)).toEqual(emptyPuzzleStore());
    expect(reconcileHarvest(storage, emptyProgress().sessions)).toEqual([]);
  });

  it("rolls progress, training and puzzles back when the puzzle write fails", () => {
    const storage = makeStorage(PUZZLES_KEY);
    storage.m.set(PROGRESS_KEY, exportProgress(emptyProgress()));
    storage.m.set(TRAINING_KEY, exportTraining(emptyTraining()));
    const before = [...storage.m.entries()];
    expect(restoreBoth(storage, { progress, training: emptyTraining(), puzzles: { puzzles, processed: ["r1"] } })).toBe(false);
    expect([...storage.m.entries()]).toEqual(before);
    expect(storage.m.has(PUZZLES_KEY)).toBe(false);
  });
});

describe("rollback under a shared storage quota", () => {
  const quotaStorage = (quota: number) => {
    const m = new Map<string, string>();
    const used = (skip: string) =>
      [...m].reduce((n, [k, v]) => n + (k === skip ? 0 : v.length), 0);
    return {
      m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (used(k) + v.length > quota) throw new Error("quota");
        m.set(k, v);
      },
      removeItem: (k: string) => void m.delete(k),
    };
  };
  const training = (n: number): Training => ({
    ...emptyTraining(),
    puzzles: Object.fromEntries(
      Array.from({ length: n }, (_, i) => [`p${i}`, { rating: 1500, rd: 350, vol: 0.06 }]),
    ),
  });
  const sizes = (p: typeof progress, t: Training) => {
    const probe = quotaStorage(Infinity);
    saveProgress(probe, p);
    saveTraining(probe, t);
    return [probe.m.get(PROGRESS_KEY)!.length, probe.m.get(TRAINING_KEY)!.length];
  };

  it("frees the newest write first, so every old key comes back", () => {
    const oldProgress = Array.from({ length: 6 }, (_, i) => sloppyRecord(`o${i}`, 1000 + i)).reduce(
      (p, r) => recordSession(p, r),
      emptyProgress(),
    );
    const oldTraining = training(2);
    const next = { progress, training: training(400), puzzles: { puzzles, processed: ["r1"] } };
    const [p0, t0] = sizes(oldProgress, oldTraining);
    const [p1, t1] = sizes(next.progress, next.training);
    // The new progress and training fill the quota, so the puzzles do not fit,
    // and the old progress only fits back once the new training is gone.
    const quota = p1 + t1;
    expect(p0 + t0).toBeLessThanOrEqual(quota);
    expect(p0 + t1).toBeGreaterThan(quota);
    const storage = quotaStorage(quota);
    saveProgress(storage, oldProgress);
    saveTraining(storage, oldTraining);
    const before = [...storage.m.entries()];
    expect(restoreBoth(storage, next)).toBe(false);
    expect([...storage.m.entries()]).toEqual(before);
  });
});

describe("hasPuzzleData", () => {
  it("counts processed ids even with no puzzles", () => {
    expect(hasPuzzleData(emptyPuzzleStore())).toBe(false);
    expect(hasPuzzleData({ puzzles: [], processed: ["s1"] })).toBe(true);
    expect(hasPuzzleData({ puzzles, processed: [] })).toBe(true);
  });
});

// The store as the importer returns it: puzzles pass through the same parser.
const loadPuzzleStoreOf = (store: { puzzles: typeof puzzles; processed: string[] }) => {
  const s = makeStorage();
  addPuzzles(s, store.puzzles, store.processed);
  return loadPuzzleStore(s);
};
