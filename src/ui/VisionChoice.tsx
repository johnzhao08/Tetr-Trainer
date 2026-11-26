import { useEffect } from "react";
import { TYPES } from "../core/board";
import type { Tetromino } from "../core/board";
import type { VisionQuestion } from "../core/vision";
import { BoardCanvas } from "./BoardCanvas";
import { PiecePreview } from "./PiecePreview";
import { STRUCTURES } from "../core/structures";

const nameOf = (id: string) => STRUCTURES.find((s) => s.id === id)?.name ?? id;

/** 1-7 pick a piece in I J L O S T Z order; Y and N answer yes or no. */
export function choiceKey(code: string): "yes" | "no" | Tetromino | null {
  if (code === "KeyY") return "yes";
  if (code === "KeyN") return "no";
  const m = /^(?:Digit|Numpad)([1-7])$/.exec(code);
  return m ? TYPES[Number(m[1]) - 1] : null;
}

export function VisionChoice({
  q,
  suspended,
  onYesNo,
  onPiece,
  onStructure,
}: {
  q: Exclude<VisionQuestion, { kind: "findSlot" }>;
  suspended: boolean;
  onYesNo: (yes: boolean) => void;
  onPiece: (type: Tetromino) => void;
  onStructure: (id: string) => void;
}) {
  const pieces = q.kind === "whichPiece";
  const options = q.kind === "structure" ? q.options : null;
  useEffect(() => {
    if (suspended) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (options) {
        const m = /^(?:Digit|Numpad)([1-4])$/.exec(event.code);
        if (!m) return;
        onStructure(options[Number(m[1]) - 1]);
        event.preventDefault();
        return;
      }
      const choice = choiceKey(event.code);
      if (!choice) return;
      if (pieces && choice !== "yes" && choice !== "no") onPiece(choice);
      else if (!pieces && (choice === "yes" || choice === "no"))
        onYesNo(choice === "yes");
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [pieces, options, suspended, onPiece, onYesNo, onStructure]);
  return (
    <div className="vision-board">
      <div className={q.kind === "forecast" ? "arena" : undefined}>
        {q.kind === "forecast" && (
          <div className="hold-slot">
            <div className="section-label">HOLD</div>
            <PiecePreview type={q.hold} />
          </div>
        )}
        <div className="board-frame">
          <BoardCanvas board={q.board} active={null} paused={false} />
        </div>
        {q.kind === "forecast" && (
          <div className="next-slot">
            <div className="section-label">NEXT</div>
            {q.queue.map((type, i) => (
              <div key={i} className="next-piece">
                <PiecePreview type={type} />
              </div>
            ))}
          </div>
        )}
      </div>
      {options ? (
        <div className="vision-choices" role="group" aria-label="Structures">
          {options.map((id, i) => (
            <button key={id} className="button" onClick={() => onStructure(id)}>
              {nameOf(id)} <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      ) : pieces ? (
        <div className="vision-choices pieces" role="group" aria-label="Pieces">
          {TYPES.map((type, i) => (
            <button key={type} className="button" onClick={() => onPiece(type)}>
              <PiecePreview type={type} />
              <span>
                {type} <kbd>{i + 1}</kbd>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="vision-choices" role="group" aria-label="Answer">
          <button className="button" onClick={() => onYesNo(true)}>
            Yes <kbd>Y</kbd>
          </button>
          <button className="button" onClick={() => onYesNo(false)}>
            No <kbd>N</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
