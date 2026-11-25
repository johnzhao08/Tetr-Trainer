import { boardRows } from "../core/drillView";
import { boardFromRows } from "../core/position";
import type { PuzzleDef, PuzzleSession } from "../core/puzzle";
import { MiniBoard } from "./MiniBoard";

// Shown under the board once a puzzle ends: what happened, why the structure
// works, and where to go next.
export function PuzzleResult({
  session,
  def,
  canUndo,
  onRetry,
  onUndo,
  onNext,
}: {
  session: PuzzleSession;
  def: PuzzleDef;
  canUndo: boolean;
  onRetry: () => void;
  onUndo: () => void;
  onNext: (() => void) | null;
}) {
  const solved = session.status === "solved";
  return (
    <div className="puzzle-result" role="status" aria-live="polite">
      <h2>{solved ? "Solved" : "Not this time"}</h2>
      <p>{session.explainResult()}</p>
      <p>{def.explanation}</p>
      {def.source === "session" && def.guide?.[0] && (
        <MiniBoard
          className="mini-board better-placement"
          rows={boardRows(boardFromRows(def.position.rows), def.guide[0])}
          label="Better placement, outlined"
        />
      )}
      <div className="board-actions">
        <button className="button" onClick={onRetry}>
          Retry
        </button>
        {!solved && (
          <button className="button" disabled={!canUndo} onClick={onUndo}>
            Undo last piece
          </button>
        )}
        {solved && onNext && (
          <button className="button primary" onClick={onNext}>
            Next puzzle
          </button>
        )}
      </div>
    </div>
  );
}
