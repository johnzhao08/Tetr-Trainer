import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { compare } from "../src/core/decision";
import { DECISIONS, lessonFor } from "../src/core/decisions";
import { defaultSettings } from "../src/core/settings";
import { DecisionScreen, Result } from "../src/ui/DecisionScreen";
import { StageList } from "../src/ui/StageList";
import { emptyProgress } from "../src/core/progress";

describe("DecisionScreen", () => {
  it("shows the opponent board with its garbage rows", () => {
    const html = renderToString(
      createElement(DecisionScreen, { settings: defaultSettings(), onHome: () => {} }),
    );
    const { stack, dirt } = DECISIONS[0].opponent.start!;
    expect(html).toContain("OPPONENT BOARD");
    expect(html).toContain(`Opponent board: ${stack} stack rows over ${dirt} garbage rows`);
    expect(html).toContain("decision-opp-grid");
  });
  it("labels the positions as simulated in the screen, results and lessons", () => {
    const screen = renderToString(
      createElement(DecisionScreen, { settings: defaultSettings(), onHome: () => {} }),
    );
    expect(screen).toContain("Simulated decision drill: positions are generated and scored");
    expect(screen).toContain("not rules");
    const result = renderToString(
      createElement(Result, {
        outcome: compare(DECISIONS[0]),
        pick: "keep",
        lesson: lessonFor(0),
        last: false,
        onNext: () => {},
      }),
    );
    expect(result).toContain("Simulated position, not a rule");
  });
  it("lists garbage still incoming apart from garbage taken", () => {
    const html = renderToString(
      createElement(Result, {
        outcome: compare(DECISIONS[1]),
        pick: "break",
        lesson: "In this position.",
        last: false,
        onNext: () => {},
      }),
    );
    expect(html).toContain("Still incoming");
    expect(html).toContain("net decides");
  });
});

describe("decision card on the stage list", () => {
  it("counts the published scenarios instead of a fixed number", () => {
    const html = renderToString(
      createElement(StageList, {
        progress: emptyProgress(), recommendedId: "b2b", onDrill: () => {}, onLesson: () => {}, onDecision: () => {}, onHandling: () => {},
      }),
    );
    expect(html).toContain(`${DECISIONS.length} scenarios`);
  });
});
