import {
  analyze,
  type Analysis,
  type LstObjective,
  type SolverPosition,
  type SolverMode,
} from "../core/solver/search";
import type { WellSide } from "../core/solver/evaluation";
export type SolverRequest = {
  mode?: SolverMode;
  objective?: LstObjective;
  id: number;
  position: SolverPosition;
  side: WellSide;
  instantSoftDrop: boolean;
};
export type SolverReply =
  { id: number; analysis: Analysis } | { id: number; error: string };
self.onmessage = (event: MessageEvent<SolverRequest>) => {
  const { id, position, side, instantSoftDrop, mode, objective } = event.data;
  try {
    self.postMessage({
      id,
      analysis: analyze(position, side, {
        budgetMs: 1500,
        instantSoftDrop,
        mode,
        objective,
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
