import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultSettings } from "../src/core/settings";
import { generateQuestion } from "../src/core/vision";
import type { VisionKind } from "../src/core/vision";
import { VisionRun } from "../src/core/visionRun";
import { VisionPlay } from "../src/ui/VisionPlay";

const html = (kind: VisionKind, seed: number, feedback = false) => {
  const run = new VisionRun(`practice:${kind}`, seed, 0, generateQuestion);
  const out = renderToString(
    createElement(VisionPlay, {
      run, now: 0, settings: defaultSettings(), suspended: false,
      feedback: feedback ? { right: true, detail: "" } : null,
      onAnswer: () => {}, onNext: () => {}, onQuit: () => {},
    }),
  );
  return { run, out };
};

describe("vision source labels", { timeout: 60_000 }, () => {
  it("labels generated positions and cites sourced ones", () => {
    let generated = 0;
    let sourced = 0;
    for (const kind of ["findSlot", "noSlot", "whichPiece"] as const)
      for (let seed = 1; seed < 12; seed++) {
        const { run, out } = html(kind, seed);
        if (run.question.source === "generated") {
          generated++;
          expect(out).toContain("Generated position");
        } else {
          sourced++;
          expect(out).not.toContain("Generated position");
          expect(out).toContain("Sourced position (four.lol)");
          expect(html(kind, seed, true).out).toContain("four.lol/");
        }
      }
    expect(generated).toBeGreaterThan(0);
    expect(sourced).toBeGreaterThan(0);
  });

  it("structure questions offer four named choices and hide the answer", () => {
    const { run, out } = html("structure", 4);
    const q = run.question;
    if (q.kind !== "structure") throw new Error("expected a structure question");
    expect(out).toContain("Which structure is this?");
    expect(out).not.toContain("Generated position");
    expect(out.match(/<kbd>/g)).toHaveLength(4);
    expect(out).not.toContain("four.lol/");
  });
});
