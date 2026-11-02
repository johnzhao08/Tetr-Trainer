import type { Board } from "../board";
import { constructionBoardKey, type Construction } from "./lstConstruction";
import type { Continuation, PlannedMove } from "./search";
import { placementKey } from "./placements";

type Hints = {
  initialConstructions?: Construction[];
  seedPlans: PlannedMove[][];
};
// Bounded hints only: the search revalidates paths against current queue/hold.
export class ContinuationCache {
  private entries = new Map<string, Hints>();
  remember(lines: Continuation[]) {
    const batch = new Map<string, Hints>();
    const entry = (key: string) => {
      let value = batch.get(key);
      if (!value) {
        value = { seedPlans: [] };
        batch.set(key, value);
      }
      return value;
    };
    for (const line of lines) {
      for (const hint of line.constructionTrace ?? []) {
        const value = entry(hint.boardKey);
        // Latest searched trace supersedes older projected clear histories.
        value.initialConstructions = hint.states;
      }
      if (line.evidence !== "construction") continue;
      for (let i = 0; i < line.moves.length; i++) {
        const value = entry(constructionBoardKey(line.moves[i].before));
        const tail = line.moves.slice(i);
        const key = (moves: PlannedMove[]) =>
          moves
            .map((m) => `${m.useHold}:${placementKey(m.piece)}:${m.spin}`)
            .join(";");
        if (
          value.seedPlans.length < 3 &&
          !value.seedPlans.some((p) => key(p) === key(tail))
        )
          value.seedPlans.push(tail);
      }
    }
    for (const [key, value] of batch) {
      // A shallow progress message must not erase a longer repair already
      // found for this board. The core will reject stale queue/hold paths.
      const old = this.entries.get(key);
      if (old) {
        const plans = new Map<string, PlannedMove[]>();
        for (const plan of [...value.seedPlans, ...old.seedPlans]) {
          const id = plan
            .map((m) => `${m.useHold}:${placementKey(m.piece)}:${m.spin}`)
            .join(";");
          if (!plans.has(id)) plans.set(id, plan);
        }
        value.seedPlans = [...plans.values()]
          .sort((a, b) => b.length - a.length)
          .slice(0, 3);
        value.initialConstructions ??= old.initialConstructions;
      }
      this.entries.delete(key);
      this.entries.set(key, value);
      if (this.entries.size > 64)
        this.entries.delete(this.entries.keys().next().value!);
    }
  }
  forBoard(board: Board): Partial<Hints> {
    return this.entries.get(constructionBoardKey(board)) ?? {};
  }
}
