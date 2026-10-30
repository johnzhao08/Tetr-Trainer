import { TSpinDrill } from "./tSpinDrill";

// Match the reference: left-facing T, CCW under the overhang, then lock/clear.
export function tSpinPreviewFrames() {
  const game = new TSpinDrill(1);
  game.state.active = { type: "T", x: 4, y: 1, rotation: 3 };
  const before = structuredClone(game.state);
  game.keyDown("ccw");
  game.keyUp("ccw");
  const rotated = structuredClone(game.state);
  game.keyDown("hardDrop");
  game.keyUp("hardDrop");
  return [before, rotated, structuredClone(game.state)];
}
