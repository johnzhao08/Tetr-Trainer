import { TSpinDrill } from "./tSpinDrill";

// Match the sourced diagram (four.lol srs/t-spin, 3-Corner Rule, diagram 0):
// the T stands in the notch with its stem right, CW points it down, then lock.
export function tSpinPreviewFrames() {
  const game = new TSpinDrill(1);
  game.state.active = { type: "T", x: 4, y: 1, rotation: 1 };
  const before = structuredClone(game.state);
  game.keyDown("cw");
  game.keyUp("cw");
  const rotated = structuredClone(game.state);
  game.keyDown("hardDrop");
  game.keyUp("hardDrop");
  return [before, rotated, structuredClone(game.state)];
}
