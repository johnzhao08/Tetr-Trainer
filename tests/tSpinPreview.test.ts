import { expect, it } from "vitest";
import { cells, collides } from "../src/core/board";
import { tSpinPreviewFrames } from "../src/core/tSpinPreview";

it("previews the reference poses and a real full T-spin Single clear", () => {
  const [before, rotated, cleared] = tSpinPreviewFrames();
  expect(before.active).toEqual({ type: "T", x: 4, y: 1, rotation: 3 });
  expect(cells(before.active!)).toEqual(
    expect.arrayContaining([
      [4, 2],
      [3, 1],
      [4, 1],
      [4, 0],
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
    expect(frame.board[2][5]).toBe("H");
    expect(frame.pieces).toBe(0);
  }
  expect(cleared.active).toBeNull();
  expect(cleared.lastEvent).toMatchObject({
    spin: "full",
    label: "T-spin Single",
  });
  expect(cleared.lines).toBe(1);
  expect(cleared.board[0]).toEqual([
    null,
    null,
    null,
    "T",
    "T",
    "T",
    null,
    null,
    null,
    null,
  ]);
  expect(cleared.board[1]).toEqual([
    null,
    null,
    null,
    null,
    null,
    "H",
    null,
    null,
    null,
    null,
  ]);
  expect(
    cleared.board
      .slice(2)
      .flat()
      .every((cell) => cell === null),
  ).toBe(true);
});
