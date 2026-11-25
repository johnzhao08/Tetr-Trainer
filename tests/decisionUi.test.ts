import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { compare } from "../src/core/decision";
import { DECISIONS } from "../src/core/decisions";
import { defaultSettings } from "../src/core/settings";
import { DecisionScreen, Result } from "../src/ui/DecisionScreen";

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
