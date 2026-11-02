import type { Construction } from "../core/solver/lstConstruction";
import {
  analyze,
  type Analysis,
  type SolverPosition,
  type SolverMode,
  type PlannedMove,
} from "../core/solver/search";
import type { WellSide } from "../core/solver/evaluation";
export type SolverRequest = {
  mode?: SolverMode;
  initialConstructions?: Construction[];
  seedPlans?: PlannedMove[][];
  id: number;
  position: SolverPosition;
  side: WellSide;
  instantSoftDrop: boolean;
};
export type SolverReply =
  { id: number; analysis: Analysis } | { id: number; error: string };
self.onmessage = (event: MessageEvent<SolverRequest>) => {
  const {
    id,
    position,
    side,
    instantSoftDrop,
    mode,
    initialConstructions,
    seedPlans,
  } = event.data;
  try {
    self.postMessage({
      id,
      analysis: analyze(position, side, {
        budgetMs: 1500,
        instantSoftDrop,
        mode,
        initialConstructions,
        seedPlans,
        onProgress:
          mode === "lst"
            ? (analysis) =>
                self.postMessage({ id, analysis } satisfies SolverReply)
            : undefined,
      }),
    } satisfies SolverReply);
  } catch {
    self.postMessage({
      id,
      error: "Analysis failed. Change the well side or restart to retry.",
    } satisfies SolverReply);
  }
};
