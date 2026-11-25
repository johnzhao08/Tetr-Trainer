import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cells } from "../core/board";
import type { Piece } from "../core/board";
import { puzzleController } from "../core/controller";
import { PuzzleSession } from "../core/puzzle";
import type { PuzzleDef } from "../core/puzzle";
import type { Settings } from "../core/settings";
import { BoardCanvas, COLORS } from "./BoardCanvas";
import { ModuleHeader } from "./ModuleHeader";
import { PiecePreview } from "./PiecePreview";
import { PuzzlePanel } from "./PuzzlePanel";
import { PuzzleResult } from "./PuzzleResult";
import { SettingsDialog } from "./SettingsDialog";
import { useTrainer } from "./useTrainer";

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/**
 * One lesson puzzle on its own board. Guided steps pass `guides`: the ghost of
 * the next piece to place is drawn, one placement at a time. `onSolved` fires
 * once per solve; `side` is the lesson's step list, shown above the goals.
 */
export function LessonPuzzle({
  def,
  guides,
  title,
  side,
  settings: initial,
  onSettingsChange,
  onSolved,
  onNext,
  onHome,
}: {
  def: PuzzleDef;
  guides?: readonly Piece[];
  title: string;
  side: ReactNode;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onSolved: () => void;
  onNext: (() => void) | null;
  onHome: (settings?: Settings) => void;
}) {
  const [session] = useState(() => new PuzzleSession(def, newSeed(), initial));
  const [controller] = useState(() => puzzleController(session));
  const {
    state, settings, settingsOpen, restart, undo, togglePause, openSettings, closeSettings,
    applySettings,
  } = useTrainer(controller);
  const [hintShown, setHintShown] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const status = session.status;
  const playing = status === "playing";
  useEffect(() => {
    if (status === "solved") onSolved();
  }, [status, onSolved]);
  useEffect(() => {
    if (playing && !settingsOpen) board.current?.focus();
  }, [playing, settingsOpen, state.pieces]);
  const act = (fn: () => void) => {
    fn();
    board.current?.focus();
  };
  const ghost = useMemo(() => {
    const piece = guides?.[state.pieces];
    return piece
      ? cells(piece).map(([x, y]) => ({ x, y, color: COLORS[piece.type] }))
      : undefined;
  }, [guides, state.pieces]);
  const outline = useMemo(
    () =>
      (def.guide ?? []).flatMap((piece) =>
        cells(piece).map(([x, y]) => ({ x, y, color: COLORS[piece.type] })),
      ),
    [def.guide],
  );
  const shown = guides ? ghost : hintShown && state.pieces === 0 ? outline : undefined;
  return (
    <>
      <ModuleHeader title={title} onHome={() => onHome(settings)} onSettings={openSettings} />
      <main className="drill-layout">
        <div className="lesson-side">
          {side}
          <PuzzlePanel
            def={def}
            progress={session.progress}
            pieces={state.pieces}
            seconds={Math.floor(state.elapsedMs / 1000)}
            review={session.reviews.at(-1)}
            hintShown={hintShown}
            onHint={() => act(() => setHintShown(!hintShown))}
            settings={settings}
          />
        </div>
        <section className="drill-play drill-with-queue" aria-label={def.title}>
          <div className="arena">
            <div className="hold-slot">
              <div className="section-label">HOLD</div>
              <PiecePreview type={state.hold} muted={!state.canHold} />
            </div>
            <div
              className="board-frame"
              ref={board}
              tabIndex={0}
              aria-label="Lesson keyboard controls"
              onPointerDown={() => board.current?.focus()}
            >
              <BoardCanvas
                board={state.board}
                active={state.active}
                paused={playing && state.status !== "playing"}
                guide={shown}
              />
              {playing && state.status === "paused" && (
                <div className="board-overlay">
                  <h2>Paused</h2>
                  <button className="button primary" onClick={() => act(togglePause)}>
                    Resume
                  </button>
                </div>
              )}
            </div>
            <div className="next-slot">
              <div className="section-label">NEXT</div>
              {state.queue.slice(0, 5).map((type, i) => (
                <div key={i} className="next-piece">
                  <PiecePreview type={type} />
                </div>
              ))}
            </div>
          </div>
          {playing ? (
            <div className="board-actions">
              <button className="button" disabled={!state.canUndo} onClick={() => act(undo)}>
                Undo
              </button>
              <button className="button" onClick={() => act(restart)}>
                Retry
              </button>
              <button className="button" onClick={() => act(togglePause)}>
                {state.status === "paused" ? "Resume" : "Pause"}
              </button>
            </div>
          ) : (
            <PuzzleResult
              session={session}
              def={def}
              canUndo={state.canUndo}
              onRetry={() => act(restart)}
              onUndo={() => act(undo)}
              onNext={onNext}
            />
          )}
        </section>
      </main>
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          seed={state.seed}
          onApply={(next) => {
            applySettings(next);
            onSettingsChange(next);
          }}
          onClose={closeSettings}
        />
      )}
    </>
  );
}
