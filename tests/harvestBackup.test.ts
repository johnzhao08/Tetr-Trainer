import { describe, expect, it } from "vitest";
import { exportBackup, importBackup, restoreBoth } from "../src/core/backup";
import { findDrill } from "../src/core/drillLookup";
import { DrillSession } from "../src/core/drillSession";
import {
  PUZZLES_KEY,
  addPuzzles,
  emptyPuzzleStore,
  harvestRecord,
  loadPuzzleStore,
  loadPuzzles,
  reconcileHarvest,
} from "../src/core/harvest";
import { PROGRESS_KEY, emptyProgress, exportProgress, recordSession } from "../src/core/progress";
import { defaultSettings } from "../src/core/settings";
import type { Action } from "../src/core/settings";
import { TRAINING_KEY, emptyTraining, exportTraining } from "../src/core/training";

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

// The store as the importer returns it: puzzles pass through the same parser.
const loadPuzzleStoreOf = (store: { puzzles: typeof puzzles; processed: string[] }) => {
  const s = makeStorage();
  addPuzzles(s, store.puzzles, store.processed);
  return loadPuzzleStore(s);
};
