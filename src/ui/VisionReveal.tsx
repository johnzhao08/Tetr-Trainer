import { cells } from "../core/board";
import type { Board, Piece } from "../core/board";
import type { VisionQuestion } from "../core/vision";
import { BoardCanvas, COLORS } from "./BoardCanvas";
import type { GuideCell } from "./BoardCanvas";
import { VisionSource } from "./VisionSource";

const guideOf = (piece: Piece | null): GuideCell[] =>
  piece
    ? cells(piece).map(([x, y]) => ({ x, y, color: COLORS[piece.type] }))
    : [];

/** The board and piece to outline as the correct answer, or null for none. */
export function revealOf(q: VisionQuestion): { board: Board; piece: Piece | null } {
  switch (q.kind) {
    case "findSlot":
      return { board: q.board, piece: q.answers[0].piece };
    case "noSlot":
      return { board: q.board, piece: q.example?.piece ?? null };
    case "whichPiece":
      return { board: q.board, piece: q.example.placement.piece };
    case "structure":
      return { board: q.board, piece: null };
    case "forecast":
      return q.plan
        ? { board: q.plan.board, piece: q.plan.slot.piece }
        : { board: q.board, piece: null };
  }
}

/** What was right, drawn on the board, with the one-line reason. */
export function VisionReveal({
  q,
  right,
  detail,
}: {
  q: VisionQuestion;
  right: boolean;
  detail: string;
}) {
  const { board, piece } = revealOf(q);
  return (
    <div className="vision-board">
      <div className="board-frame">
        <BoardCanvas
          board={board}
          active={null}
          paused={false}
          guide={guideOf(piece)}
        />
      </div>
      <div className="vision-answer" role="status" aria-live="polite">
        <strong className={right ? "right" : "wrong"}>
          {right ? "Correct" : "Not quite"}
        </strong>
        {detail && <span> {detail}</span>}
        <p>{q.why}</p>
        <VisionSource q={q} revealed />
        {q.kind === "whichPiece" && (
          <p className="step-note">
            Any of {q.answers.join(", ")} works; outline shows {q.example.type}.
          </p>
        )}
        {q.kind === "forecast" && q.plan && (
          <p className="step-note">Board shown is after those plays.</p>
        )}
      </div>
    </div>
  );
}
