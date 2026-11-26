import { expect, it } from "vitest";
import { cells, collides } from "../src/core/board";
import { tSpinPreviewFrames } from "../src/core/tSpinPreview";

it("previews the sourced poses and a real full T-spin Double clear", () => {
  const [before, rotated, cleared] = tSpinPreviewFrames();
  expect(before.active).toEqual({ type: "T", x: 4, y: 1, rotation: 1 });
  expect(cells(before.active!)).toEqual(
    expect.arrayContaining([
      [4, 2],
      [4, 1],
      [4, 0],
      [5, 1],
    ]),
  );
  expect(rotated.active).toEqual({ type: "T", x: 4, y: 1, rotation: 2 });
  expect(cells(rotated.active!)).toEqual(
    expect.arrayContaining([
      [3, 1],
      [4, 1],
      [5, 1],
      [4, 0],
    ]),
  );
  for (const frame of [before, rotated]) {
    expect(collides(frame.board, frame.active!)).toBe(false);
    expect(frame.pieces).toBe(0);
  }
  expect(cleared.active).toBeNull();
  expect(cleared.lastEvent).toMatchObject({
    spin: "full",
    label: "T-spin Double",
  });
  expect(cleared.lines).toBe(2);
  // Rows 0 and 1 clear; the diagram's top row drops to the floor.
  expect(cleared.board[0]).toEqual(["X", "X", "X", "X", null, null, null, null, null, null]);
  expect(cleared.board.slice(1).flat().every((cell) => cell === null)).toBe(true);
});
