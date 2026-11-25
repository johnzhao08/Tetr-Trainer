import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STAGES } from "../src/core/curriculum";
import { LESSONS, STAGE_LESSONS } from "../src/core/lessons";
import { defaultSettings } from "../src/core/settings";
import { LessonDrillStep } from "../src/ui/LessonDrillStep";
import { LessonRecognize, describeBoard } from "../src/ui/LessonRecognize";
import { commitStep, withStepDone } from "../src/ui/lessonProgress";
import { LessonScreen } from "../src/ui/LessonScreen";
import { StageList } from "../src/ui/StageList";
import { emptyProgress, loadProgress, recordSession, saveProgress } from "../src/core/progress";
import type { Progress } from "../src/core/progress";
import { findLesson } from "../src/core/lessons";
import { stepDone } from "../src/core/lesson";

describe("lesson wiring", () => {
  it("lists every lesson under exactly one real stage", () => {
    const stages = new Set(STAGES.map((s) => s.id));
    const listed = Object.entries(STAGE_LESSONS).flatMap(([stage, ids]) => {
      expect(stages.has(stage), stage).toBe(true);
      return ids;
    });
    expect([...listed].sort()).toEqual(LESSONS.map((l) => l.id).sort());
  });
  it("renders the overview with the step list and a settings button last", () => {
    const html = renderToString(
      createElement(LessonScreen, {
        id: "kaidan", settings: defaultSettings(), onDrill: () => {}, onHome: () => {},
      }),
    );
    expect(html).toContain("Kaidan (donation)");
    expect(html).toContain("Why it matters");
    expect(html).toContain("Build it");
    expect(html).toContain("Settings</button></nav></header>");
  });
  it("renders four numbered boards for a recognition round", () => {
    const rounds = LESSONS.find((l) => l.id === "stsd")!.steps.find((s) => s.kind === "recognize");
    if (rounds?.kind !== "recognize") throw new Error("missing");
    const html = renderToString(
      createElement(LessonRecognize, { rounds: rounds.rounds, name: "STSD", active: true, onDone: () => {} }),
    );
    for (const n of [1, 2, 3, 4]) expect(html).toContain(`aria-label="Board ${n}"`);
    expect(html.replace(/<!-- -->/g, "")).toContain("(1 of 2)");
  });
  it("shows lesson cards inside the matching stage", () => {
    const html = renderToString(
      createElement(StageList, {
        progress: emptyProgress(), recommendedId: "tsd", onDrill: () => {}, onLesson: () => {}, onHandling: () => {},
      }),
    );
    expect(html).toContain("Structures");
    expect(html).toContain("Overhangs from all 7 pieces");
    expect(html).toContain("0 of 8 steps");
  });
});

describe("lesson completion", () => {
  const lesson = findLesson("tst")!;
  it("completes a step once, even when nothing is ever persisted", () => {
    const first = withStepDone(emptyProgress(), lesson, lesson.steps[0], "a", 1);
    expect(stepDone(first, lesson, lesson.steps[0])).toBe(true);
    // A re-fired solve against the same in-memory progress is a no-op, so
    // the screen sets no new state and cannot loop.
    expect(withStepDone(first, lesson, lesson.steps[0], "b", 2)).toBe(first);
  });
});

describe("saving a lesson step", () => {
  const lesson = findLesson("tst")!;
  const store = () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    } as unknown as Storage;
    return { storage, data };
  };
  const other = {
    id: "other-tab",
    drillId: "line-race",
    endedAt: 5,
    durationMs: 1000,
    completed: true,
    metrics: { score: 7 },
  };

  it("keeps records another tab wrote after this screen mounted", () => {
    const { storage } = store();
    const mounted = loadProgress(storage);
    saveProgress(storage, recordSession(mounted, other));
    const io = { read: () => loadProgress(storage), write: (p: Progress) => saveProgress(storage, p) };
    const result = commitStep(io, [], lesson, lesson.steps[0], "mine", 9)!;
    const saved = loadProgress(storage);
    expect(saved.sessions.map((s) => s.id)).toContain("other-tab");
    expect(stepDone(saved, lesson, lesson.steps[0])).toBe(true);
    expect(result.progress.sessions.length).toBe(saved.sessions.length);
  });

  it("keeps an unsaved earlier step when a later write succeeds, and ignores repeats", () => {
    const { storage } = store();
    let failing = true;
    const io = {
      read: () => loadProgress(storage),
      write: (p: Progress) => (failing ? false : saveProgress(storage, p)),
    };
    const first = commitStep(io, [], lesson, lesson.steps[0], "a", 1)!;
    expect(stepDone(loadProgress(storage), lesson, lesson.steps[0])).toBe(false);
    expect(commitStep(io, first.marks, lesson, lesson.steps[0], "dup", 2)).toBeNull();
    failing = false;
    const second = commitStep(io, first.marks, lesson, lesson.steps[1], "b", 3)!;
    const saved = loadProgress(storage);
    expect(stepDone(saved, lesson, lesson.steps[0])).toBe(true);
    expect(stepDone(saved, lesson, lesson.steps[1])).toBe(true);
    expect(second.marks).toHaveLength(2);
  });
});

describe("lesson drill step", () => {
  it("hands the lesson's current settings to the drill", () => {
    const step = findLesson("kaidan")!.steps.find((s) => s.kind === "drill")!;
    if (step.kind !== "drill") throw new Error("shape");
    const settings = { ...defaultSettings(), das: 99 };
    const calls: unknown[][] = [];
    const tree = LessonDrillStep({
      step, progress: emptyProgress(), settings, onDrill: (...args) => calls.push(args),
    });
    type Node = { type?: string; props?: { children?: Node | Node[]; onClick?: () => void } };
    const find = (node: Node): Node | undefined =>
      node?.type === "button" ? node : [node?.props?.children ?? []].flat(9).map(find).find(Boolean);
    find(tree as Node)!.props!.onClick!();
    expect(calls).toEqual([["kaidan-run", settings]]);
  });
});

describe("board descriptions", () => {
  it("summarise heights and buried gaps without naming the answer", () => {
    expect(describeBoard(["X.", "XX", ".X"])).toBe(
      "Column heights, left to right: 3, 2. Buried empty cells: column 1: 1.",
    );
    expect(describeBoard(["..", "XX"])).toContain("Buried empty cells: none.");
  });
  it("renders one description per board, tied to its button", () => {
    const round = findLesson("stsd")!.steps.find((s) => s.kind === "recognize");
    if (round?.kind !== "recognize") throw new Error("missing");
    const html = renderToString(
      createElement(LessonRecognize, { rounds: round.rounds, name: "STSD", active: true, onDone: () => {} }),
    );
    for (const n of [0, 1, 2, 3]) expect(html).toContain(`aria-describedby="board-0-${n}"`);
    expect(html).toContain("Column heights, left to right");
    expect(html).not.toMatch(/visually-hidden[^>]*>[^<]*(correct|STSD)/);
  });
});
