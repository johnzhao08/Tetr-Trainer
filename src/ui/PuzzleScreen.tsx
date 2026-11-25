import { useEffect, useMemo, useRef, useState } from "react";
import { cells } from "../core/board";
import { puzzleController } from "../core/controller";
import { PuzzleSession } from "../core/puzzle";
import type { PuzzleDef } from "../core/puzzle";
import { PUZZLES, findPuzzle } from "../core/puzzles";
import { recordSession } from "../core/progress";
import type { Settings } from "../core/settings";
import { BoardCanvas, COLORS } from "./BoardCanvas";
import { ModuleHeader } from "./ModuleHeader";
import { PiecePreview } from "./PiecePreview";
import { PuzzlePanel } from "./PuzzlePanel";
import { PuzzleResult } from "./PuzzleResult";
import { readProgress, writeProgress } from "./progressStorage";
import { SettingsDialog } from "./SettingsDialog";
import { newSessionId } from "./sessionId";
import { useTrainer } from "./useTrainer";

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

export function PuzzleScreen({
  id,
  set,
  settings,
  onHome,
}: {
  id: string;
  /** Your own puzzles to play in order; built-in puzzles when absent. */
  set?: PuzzleDef[];
  settings: Settings;
  onHome: (settings?: Settings) => void;
}) {
  // Next puzzle swaps the id here, so the whole run remounts fresh.
  const [current, setCurrent] = useState(id);
  const [saved, setSaved] = useState(settings);
  const list = set ?? PUZZLES;
  const def = set ? set.find((p) => p.id === current) : findPuzzle(current);
  if (!def) return null;
  const next = list[list.findIndex((p) => p.id === current) + 1];
  return (
    <div className="app-shell">
      <PuzzleRun
        key={current}
        def={def}
        settings={saved}
        onSettingsChange={setSaved}
        onNext={next ? () => setCurrent(next.id) : null}
        onHome={onHome}
      />
    </div>
  );
}

function PuzzleRun({
  def,
  settings: initial,
  onSettingsChange,
  onNext,
  onHome,
}: {
  def: PuzzleDef;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onNext: (() => void) | null;
  onHome: (settings?: Settings) => void;
}) {
  const [session] = useState(() => new PuzzleSession(def, newSeed(), initial));
  const [controller] = useState(() => puzzleController(session));
  const {
    state, settings, settingsOpen, refresh, restart, undo, togglePause, openSettings, closeSettings,
    applySettings,
  } = useTrainer(controller);
  const [hintShown, setHintShown] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const runId = useRef<string | null>(null);
  const status = session.status;
  const playing = status === "playing";

  // Save once per finish; the id is kept until play resumes, so a repeated
  // effect (strict mode) replaces the same record instead of adding one.
  useEffect(() => {
    // Puzzles from your own games are practice, not rated history.
    if (playing || def.source === "session") {
      runId.current = null;
      return;
    }
    runId.current ??= newSessionId();
    writeProgress(recordSession(readProgress(), session.record(runId.current, Date.now())));
  }, [playing, session, def.source]);
  useEffect(() => {
    if (playing && !settingsOpen) board.current?.focus();
  }, [playing, settingsOpen, state.pieces]);
  const act = (fn: () => void) => {
    fn();
    board.current?.focus();
  };
  const guide = useMemo(
    () =>
      (def.guide ?? []).flatMap((piece) =>
        cells(piece).map(([x, y]) => ({ x, y, color: COLORS[piece.type] })),
      ),
    [def.guide],
  );
  return (
    <>
      <ModuleHeader title={def.title} onHome={() => onHome(settings)} onSettings={openSettings} />
      <main className="drill-layout">
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
        <section className="drill-play drill-with-queue" aria-label={def.title}>
          <div className="arena">
            <div className="hold-slot">
              <div className="section-label">HOLD</div>
              <PiecePreview type={state.hold} muted={!state.canHold || def.allowHold === false} />
            </div>
            <div
              className="board-frame"
              ref={board}
              tabIndex={0}
              aria-label="Puzzle keyboard controls"
              onPointerDown={() => board.current?.focus()}
            >
              <BoardCanvas
                board={state.board}
                active={state.active}
                paused={playing && state.status !== "playing"}
                guide={hintShown && state.pieces === 0 ? guide : undefined}
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
              {def.source === "session" && (
                <button
                  className="button"
                  onClick={() =>
                    act(() => {
                      session.giveUp();
                      refresh();
                    })
                  }
                >
                  Show answer
                </button>
              )}
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
