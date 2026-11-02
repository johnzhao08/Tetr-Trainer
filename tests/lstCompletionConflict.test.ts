import { expect, it } from "vitest";
import captured from "./fixtures/lst-after-readiness.json";
import { type Board } from "../src/core/board";
import { constructionEvidence } from "../src/core/solver/lstConstruction";

it("detects mutually incompatible right-boundary fills even when every cell has candidates", () => {
  const board = captured.position.board as Board;
  const evidence = constructionEvidence(board, captured.constructions[0]);
  expect(evidence.obligations.every((o) => o.pieces.length > 0)).toBe(true);
  expect(evidence.obligations.some((o) => o.x === 4 && o.y === 5)).toBe(true);
  expect(evidence.obligations.some((o) => o.x === 3 && o.y === 6)).toBe(true);
  expect(evidence.impossible).toBeGreaterThan(0);
});
