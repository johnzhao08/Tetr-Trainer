import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STAGES } from "../src/core/curriculum";
import { LESSONS, STAGE_LESSONS } from "../src/core/lessons";
import { defaultSettings } from "../src/core/settings";
import { LessonRecognize } from "../src/ui/LessonRecognize";
import { LessonScreen } from "../src/ui/LessonScreen";
import { StageList } from "../src/ui/StageList";
import { emptyProgress } from "../src/core/progress";

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
        progress: emptyProgress(), recommendedId: "tsd", onDrill: () => {}, onLesson: () => {},
      }),
    );
    expect(html).toContain("Structures");
    expect(html).toContain("Overhangs from all 7 pieces");
    expect(html).toContain("0 of 8 steps");
  });
});
