import { describe, expect, it } from "vitest";
import { exportBackup, importBackup } from "../src/core/backup";
import { emptyProgress, exportProgress, recordSession } from "../src/core/progress";
import {
  emptyTraining,
  exportTraining,
  importTraining,
  isTrainingEmpty,
  loadTraining,
  MAX_PUZZLES,
  MAX_REVIEW,
  MAX_THEMES,
  saveTraining,
  TRAINING_KEY,
} from "../src/core/training";
import type { Training } from "../src/core/training";

const g = { rating: 1520, rd: 120, vol: 0.06 };
const item = {
  id: "p1",
  kind: "puzzle" as const,
  box: 2,
  dueAt: 5000,
  lastResult: "fail" as const,
  lapses: 1,
};
function sample(): Training {
  return {
    version: 1,
    players: { tspin: g },
    puzzles: { p1: { ...g, rd: 80 } },
    review: [item],
  };
}
function memory(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
    get value() {
      return value;
    },
  };
}

describe("training storage", () => {
  it("round-trips through storage", () => {
    const s = memory();
    expect(saveTraining(s, sample())).toBe(true);
    expect(loadTraining(s)).toEqual(sample());
    expect(TRAINING_KEY).toBe("tetr-trainer.training.v1");
  });

  it("returns empty for missing, corrupt or wrong-version data", () => {
    expect(loadTraining(memory())).toEqual(emptyTraining());
    expect(loadTraining(memory("{nope"))).toEqual(emptyTraining());
    expect(loadTraining(memory('{"version":9}'))).toEqual(emptyTraining());
    expect(loadTraining(memory("null"))).toEqual(emptyTraining());
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadTraining(throwing)).toEqual(emptyTraining());
  });

  it("reports save failure without throwing", () => {
    const setItem = () => {
      throw new Error("quota");
    };
    expect(saveTraining({ setItem }, sample())).toBe(false);
  });

  it("drops invalid entries and keeps valid ones", () => {
    const text = JSON.stringify({
      version: 1,
      players: {
        ok: g,
        negRd: { ...g, rd: -1 },
        nan: { ...g, rating: "x" },
        hugeVol: { ...g, vol: 5 },
        "": g,
      },
      puzzles: { p1: g, p2: null },
      review: [
        item,
        { ...item, id: "dup" },
        { ...item, id: "dup" },
        { ...item, id: "badbox", box: 6 },
        { ...item, id: "frac", box: 1.5 },
        { ...item, id: "kind", kind: "other" },
        { ...item, id: "neg", lapses: -1 },
        { ...item, id: "res", lastResult: "maybe" },
        "junk",
      ],
    });
    const t = importTraining(text);
    expect(Object.keys(t!.players)).toEqual(["ok"]);
    expect(Object.keys(t!.puzzles)).toEqual(["p1"]);
    expect(t!.review.map((i) => i.id)).toEqual(["p1", "dup"]);
  });

  it("ignores prototype keys", () => {
    const t = importTraining(
      '{"version":1,"players":{"__proto__":{"rating":1500,"rd":100,"vol":0.06}},"puzzles":{},"review":[]}',
    );
    expect(Object.keys(t!.players)).toEqual([]);
    expect(({} as Record<string, unknown>).rating).toBeUndefined();
  });

  it("caps themes, puzzles and review items", () => {
    const many = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, g]));
    const t = importTraining(
      JSON.stringify({
        version: 1,
        players: many(MAX_THEMES + 5),
        puzzles: many(MAX_PUZZLES + 5),
        review: Array.from({ length: MAX_REVIEW + 5 }, (_, i) => ({
          ...item,
          id: `r${i}`,
        })),
      }),
    );
    expect(Object.keys(t!.players)).toHaveLength(MAX_THEMES);
    expect(Object.keys(t!.puzzles)).toHaveLength(MAX_PUZZLES);
    expect(t!.review).toHaveLength(MAX_REVIEW);
  });

  it("saves only normalized data", () => {
    const s = memory();
    saveTraining(s, { ...sample(), players: { bad: { ...g, rd: 0 } } });
    expect(loadTraining(s).players).toEqual({});
  });

  it("exports and imports text", () => {
    expect(importTraining(exportTraining(sample()))).toEqual(sample());
    expect(importTraining("garbage")).toBeNull();
    expect(importTraining("[]")).toBeNull();
    expect(isTrainingEmpty(emptyTraining())).toBe(true);
    expect(isTrainingEmpty(sample())).toBe(false);
  });
});

describe("combined backup", () => {
  const progress = recordSession(emptyProgress(), {
    id: "s1",
    drillId: "d1",
    endedAt: 1000,
    durationMs: 5000,
    completed: true,
    metrics: { pps: 2 },
  });

  it("round-trips progress and training", () => {
    const result = importBackup(exportBackup(progress, sample()));
    expect(result!.progress.progress).toEqual(progress);
    expect(result!.training).toEqual(sample());
  });

  it("accepts an old progress-only backup and keeps training", () => {
    const result = importBackup(exportProgress(progress));
    expect(result!.progress.progress).toEqual(progress);
    expect(result!.training).toBeNull();
  });

  it("rejects garbage and half-valid backups", () => {
    expect(importBackup("nope")).toBeNull();
    expect(importBackup("42")).toBeNull();
    expect(importBackup('{"version":2}')).toBeNull();
    const bad = JSON.stringify({ version: 2, progress, training: "x" });
    expect(importBackup(bad)).toBeNull();
  });
});
