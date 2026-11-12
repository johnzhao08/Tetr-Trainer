import { useEffect, useRef, useState } from "react";
import {
  chooseWell,
  type WellMode,
  type WellSide,
} from "../core/solver/evaluation";
import type { SolverPosition, SolverMode } from "../core/solver/search";
import type { SolverReply, SolverRequest } from "./solver.worker";

type Result = {
  solverMode: SolverMode;
  position: SolverPosition;
  mode: WellMode;
  instant: boolean;
  side: WellSide;
  reply: SolverReply;
};
export function useSolver(
  position: SolverPosition,
  mode: WellMode,
  instant: boolean,
  solverMode: SolverMode = "nine-zero",
) {
  const previousSide = useRef<WellSide>("right");
  const sequence = useRef(0);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!position.active) return;
    const id = ++sequence.current;
    const side =
      mode === "auto" ? chooseWell(position.board, previousSide.current) : mode;
    previousSide.current = side;
    let worker: Worker | undefined,
      cancelled = false;
    const deliver = (reply: SolverReply) => {
      if (!cancelled && reply.id === id)
        setResult({ position, mode, instant, side, reply, solverMode });
    };
    try {
      worker = new Worker(new URL("./solver.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<SolverReply>) =>
        deliver(event.data);
      worker.onerror = () =>
        deliver({ id, error: "Solver unavailable. Gameplay still works." });
      worker.postMessage({
        id,
        position,
        side,
        instantSoftDrop: instant,
        mode: solverMode,
      } satisfies SolverRequest);
    } catch {
      queueMicrotask(() =>
        deliver({
          id,
          error: "This browser could not start the solver worker.",
        }),
      );
    }
    // Terminating obsolete jobs prevents queue buildup during rapid play.
    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, [position, mode, instant, solverMode]);
  const current =
    result?.position === position &&
    result.mode === mode &&
    result.instant === instant &&
    result.solverMode === solverMode
      ? result
      : null;
  return { loading: Boolean(position.active && !current), result: current };
}
