import { useEffect, useRef, useState } from "react";
import { judgeFindSlot } from "../core/vision";
import type { FindSlotQ } from "../core/vision";
import { VisionGame } from "../core/visionGame";
import { stepAnswerLatch } from "../core/visionAnswer";
import { keyLabel } from "../core/settings";
import type { Settings } from "../core/settings";
import { BoardCanvas } from "./BoardCanvas";
import { useTrainer } from "./useTrainer";

/**
 * Plays the T on the question's board with the player's own controls. The
 * first lock ends the question: right if it was a full T-spin clearing as
 * many lines as the best slot.
 */
export function VisionFindSlot({
  q,
  settings,
  suspended,
  ready,
  onAnswer,
}: {
  q: FindSlotQ;
  settings: Settings;
  suspended: boolean;
  /** The question is on screen; game keys do nothing before that. */
  ready: boolean;
  onAnswer: (right: boolean, detail: string) => void;
}) {
  const [game] = useState(() => {
    const g = new VisionGame(q.seed, settings, q.board, ["T"]);
    g.noHold = true;
    return g;
  });
  const { state, restart, togglePause } = useTrainer(
    game,
    {},
    suspended || !ready,
  );
  const frame = useRef<HTMLDivElement>(null);
  const answered = useRef(false);
  useEffect(() => frame.current?.focus(), []);
  useEffect(() => {
    game.configure(settings);
  }, [game, settings]);
  useEffect(() => {
    if (suspended) game.pause();
    else game.clearInput();
  }, [game, suspended]);
  useEffect(() => {
    const step = stepAnswerLatch(answered.current, ready, state);
    answered.current = step.latched;
    if (!step.judge) return;
    onAnswer(
      judgeFindSlot(q, state),
      state.lastEvent?.label ?? "a plain placement, no spin",
    );
  }, [state, q, ready, onAnswer]);
  return (
    <div className="vision-board">
      <div
        className="board-frame"
        ref={frame}
        tabIndex={0}
        aria-label="T-spin question board, keyboard controls"
        onPointerDown={() => frame.current?.focus()}
      >
        <BoardCanvas
          board={state.board}
          active={state.active}
          paused={state.status !== "playing"}
        />
        {state.status === "paused" && !suspended && (
          <div className="board-overlay">
            <h2>Paused</h2>
            <button
              className="button primary"
              onClick={() => {
                togglePause();
                frame.current?.focus();
              }}
            >
              Resume
            </button>
          </div>
        )}
      </div>
      <p className="step-note">
        Place the T where it makes a full T-spin. Retry with{" "}
        <kbd>{keyLabel(settings.bindings.restart)}</kbd>.
      </p>
      <button
        className="button"
        onClick={() => {
          restart();
          frame.current?.focus();
        }}
      >
        Reset piece
      </button>
    </div>
  );
}
