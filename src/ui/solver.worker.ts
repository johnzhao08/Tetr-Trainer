import {
  analyze,
  type Analysis,
  type SolverPosition,
} from "../core/solver/search";
import type { WellSide } from "../core/solver/evaluation";
export type SolverRequest = {
  id: number;
  position: SolverPosition;
  side: WellSide;
  instantSoftDrop: boolean;
};
export type SolverReply =
  { id: number; analysis: Analysis } | { id: number; error: string };
self.onmessage = (event: MessageEvent<SolverRequest>) => {
  const { id, position, side, instantSoftDrop } = event.data;
  try {
    self.postMessage({
      id,
      analysis: analyze(position, side, { budgetMs: 500, instantSoftDrop }),
    } satisfies SolverReply);
  } catch {
    self.postMessage({
      id,
      error: "Analysis failed. Change the well side or restart to retry.",
    } satisfies SolverReply);
  }
};
