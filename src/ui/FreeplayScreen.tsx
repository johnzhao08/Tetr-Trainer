import { useCallback, useEffect, useRef, useState } from "react";
import { freeplayRecord } from "../core/trends";
import type { SessionRecord } from "../core/progress";
import { lastActivityAt, readSavePref, saveFreeplayRecord, writeSavePref } from "./freeplaySave";
import { reviewPlacement } from "../core/coach";
import type { PlacementReview } from "../core/coach";
import { Game } from "../core/game";
import { defaultOptions, LEAGUE_PRESSURE } from "../core/incoming";
import { keyLabel } from "../core/settings";
import { BoardCanvas } from "./BoardCanvas";
import { IncomingMeter } from "./DrillHud";
import { FreeplayStats, PRESSURE_LABELS } from "./FreeplayStats";
import type { Pressure } from "./FreeplayStats";
import { ModuleHeader } from "./ModuleHeader";
import { PiecePreview } from "./PiecePreview";
import { SettingsDialog } from "./SettingsDialog";
import { useTrainer } from "./useTrainer";

function Icon({ name }: { name: "restart" | "pause" | "play" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "restart" ? (
        <>
          <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
        </>
      ) : name === "pause" ? (
        <>
          <path d="M8 5v14M16 5v14" />
        </>
      ) : (
        <path d="m8 4 12 8-12 8z" />
      )}
    </svg>
  );
}

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

function applyPressure(game: Game, pressure: Pressure) {
  game.setOptions({
    ...defaultOptions(),
    ...(pressure !== "off" && LEAGUE_PRESSURE),
    opponent:
      pressure === "opponent" ? { seed: newSeed(), apm: 30 } : undefined,
  });
}

// Freeplay is saved to progress only when the player opts in.
export function FreeplayScreen({
  session,
  reviews,
  onReviews,
  pressure,
  onPressure,
  onHome,
}: {
  session: Game;
  /** Coach reviews of the retained game, kept by App so they outlive this screen. */
  reviews: readonly PlacementReview[];
  onReviews: (update: (prev: PlacementReview[]) => PlacementReview[]) => void;
  pressure: Pressure;
  onPressure: (pressure: Pressure) => void;
  onHome: () => void;
}) {
  const {
    state,
    settings,
    settingsOpen,
    notice,
    restart,
    undo,
    togglePause,
    openSettings,
    closeSettings,
    applySettings,
  } = useTrainer(session);
  const arena = useRef<HTMLDivElement>(null);
  const [showStats, setShowStats] = useState(false);
  const [saveGames, setSaveGames] = useState(readSavePref);
  // The latest game as a record (null under 40 pieces), refreshed every
  // render so it can still be saved after a restart has wiped the game.
  const latest = useRef<SessionRecord | null>(null);
  const saveOn = useRef(saveGames);
  const flush = useCallback(() => {
    if (saveOn.current) saveFreeplayRecord(latest.current);
  }, []);
  useEffect(() => {
    saveOn.current = saveGames;
    const { seed, stats, pieces } = session.state;
    latest.current = freeplayRecord(
      { seed, stats, pieces, elapsedMs: session.elapsedMs },
      lastActivityAt(session),
    );
  });
  // A new seed means a restart: the cleanup saves the game that just ended.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [session, state.seed, flush]);
  const leave = () => {
    flush();
    onHome();
  };
  // reviews[i] grades piece i. Stale entries are overwritten before they
  // show, so the chip also follows undo.
  useEffect(() => {
    session.listenToLocks(({ before, after, placement }) => {
      const review = reviewPlacement(before, after, {
        cleared: placement.cleared,
        spin: placement.spin !== null,
      });
      onReviews((prev) => {
        const next = [...prev];
        next[placement.index] = review;
        return next;
      });
    });
    return () => session.listenToLocks();
  }, [session, onReviews]);
  const meter = pressure === "opponent" || state.incoming.length > 0;
  const changePressure = (next: Pressure) => {
    applyPressure(session, next);
    onPressure(next);
    onReviews(() => []);
    restart();
    arena.current?.focus();
  };
  useEffect(() => {
    if (!settingsOpen) arena.current?.focus();
  }, [settingsOpen]);
  const focus = () => arena.current?.focus();
  const act = (fn: () => void) => {
    fn();
    focus();
  };
  return (
    <div className="app-shell">
      <ModuleHeader title="Freeplay" onHome={leave} onSettings={openSettings} />
      <main>
        <div className="practice-layout">
          <section className="play-area" aria-label="Free play">
            <div className="play-status">
              <span>
                <span
                  className={`status-dot ${state.status !== "playing" ? "muted" : ""}`}
                />
                {state.status === "playing"
                  ? "Free play"
                  : state.status === "paused"
                    ? "Paused"
                    : "Game over"}
              </span>
              <span>
                {pressure === "off" ? "Zero gravity" : PRESSURE_LABELS[pressure]}{" "}
                · SRS+
              </span>
            </div>
            <div
              className="arena"
              ref={arena}
              tabIndex={0}
              aria-label="Game keyboard controls"
              onPointerDown={focus}
            >
              <div className="hold-slot">
                <div className="section-label">
                  HOLD <kbd>{keyLabel(settings.bindings.hold)}</kbd>
                </div>
                <PiecePreview type={state.hold} muted={!state.canHold} />
                {!state.hold && <span className="empty-hold">Empty</span>}
              </div>
              <div className={meter ? "board-wrap with-meter" : "board-wrap"}>
                {meter && <IncomingMeter state={state} />}
              <div className="board-frame">
                <BoardCanvas
                  board={state.board}
                  active={state.active}
                  paused={state.status !== "playing"}
                />
                {state.allClearId !== null && (
                  <div
                    key={state.allClearId}
                    className="all-clear"
                    role="status"
                  >
                    all clear
                  </div>
                )}
                {state.status !== "playing" && (
                  <div className="board-overlay">
                    <h2>{state.status === "over" ? "Game over" : "Paused"}</h2>
                    <button
                      className="button primary"
                      onClick={() =>
                        act(state.status === "over" ? restart : togglePause)
                      }
                    >
                      {state.status === "over" ? "Restart" : "Resume"}
                      <Icon
                        name={state.status === "over" ? "restart" : "play"}
                      />
                    </button>
                  </div>
                )}
              </div>
              </div>
              <div className="next-slot">
                <div className="section-label">NEXT</div>
                {state.queue.slice(0, 5).map((type, i) => (
                  <div className="next-piece" key={i}>
                    <PiecePreview type={type} />
                  </div>
                ))}
              </div>
            </div>
            <div className="board-actions">
              <button
                className="button quiet"
                disabled={!state.canUndo}
                onClick={() => act(undo)}
              >
                <span aria-hidden="true">↶</span>Undo
                <kbd>{keyLabel(settings.bindings.undo)}</kbd>
              </button>
              <button className="button quiet" onClick={() => act(restart)}>
                <Icon name="restart" />
                Restart<kbd>{keyLabel(settings.bindings.restart)}</kbd>
              </button>
              <button
                className="button quiet"
                disabled={state.status === "over"}
                onClick={() => act(togglePause)}
              >
                <Icon name={state.status === "paused" ? "play" : "pause"} />
                {state.status === "paused" ? "Resume" : "Pause"}
                <kbd>{keyLabel(settings.bindings.pause)}</kbd>
              </button>
            </div>
          </section>
          <aside className="right-panel">
            <section className="session-card">
              <div className="section-label">SESSION</div>
              <div className="stat session-time">
                <span
                  className="stat-value"
                  role="timer"
                  aria-label="Session time"
                >
                  {String(Math.floor(state.elapsedMs / 60000)).padStart(2, "0")}
                  :
                  {String(Math.floor(state.elapsedMs / 1000) % 60).padStart(
                    2,
                    "0",
                  )}
                </span>
                <span>Time</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {String(state.lines).padStart(2, "0")}
                </span>
                <span>Lines</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {String(state.pieces).padStart(2, "0")}
                </span>
                <span>Pieces</span>
              </div>
              <div
                className="streak-counters"
                aria-label="Current streaks"
                aria-live="polite"
                aria-atomic="true"
              >
                <div title="Consecutive clearing pieces. The second clear is Combo 1; a non-clearing piece resets it.">
                  <span className="section-label">COMBO</span>
                  <strong
                    aria-label="Combo count"
                    className={state.combo > 0 ? "streak-active" : ""}
                  >
                    {Math.max(0, state.combo)}
                  </strong>
                </div>
                <div title="Quads and T-spin Singles/Doubles/Triples. The second qualifying clear is B2B 1. Non-clearing pieces preserve the chain; other clears break it.">
                  <span className="section-label">B2B</span>
                  <strong
                    aria-label="B2B count"
                    className={state.b2b > 0 ? "streak-active" : ""}
                  >
                    {Math.max(0, state.b2b)}
                  </strong>
                </div>
              </div>
              <div
                className="session-message"
                aria-live="polite"
                aria-atomic="true"
              >
                {state.lastEvent ? (
                  <div
                    key={state.lastEvent.id}
                    className={`clear-indicator${state.lastEvent.tspin ? " tspin" : ""}`}
                  >
                    <span className="section-label">LAST CLEAR</span>
                    <strong>{state.lastEvent.label}</strong>
                  </div>
                ) : null}
              </div>
            </section>
            <section className="freeplay-options" aria-label="Freeplay options">
              <label className="pressure-select">
                <span className="section-label">PRESSURE</span>
                <select
                  value={pressure}
                  onChange={(e) => changePressure(e.target.value as Pressure)}
                >
                  {(Object.keys(PRESSURE_LABELS) as Pressure[]).map((key) => (
                    <option key={key} value={key}>
                      {PRESSURE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button quiet"
                aria-pressed={showStats}
                onClick={() => act(() => setShowStats((v) => !v))}
              >
                {showStats ? "Hide stats" : "Show stats"}
              </button>
              <label className="checkbox-row save-toggle">
                <input
                  type="checkbox"
                  checked={saveGames}
                  onChange={(e) => {
                    setSaveGames(e.currentTarget.checked);
                    writeSavePref(e.currentTarget.checked);
                    focus();
                  }}
                />
                <span>Save games for trends</span>
              </label>
              <p className="options-note">
                {saveGames
                  ? "Games of 40+ pieces are saved when you restart or leave."
                  : "Freeplay is not saved unless you turn this on."}
              </p>
            </section>
            {showStats && (
              <FreeplayStats
                state={state}
                elapsedMs={state.elapsedMs}
                review={reviews[state.pieces - 1]}
                onToggle={focus}
              />
            )}
          </aside>
        </div>
        <div className="notice" role="status">
          {notice}
        </div>
      </main>
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          seed={state.seed}
          onApply={applySettings}
          onClose={closeSettings}
        />
      )}
    </div>
  );
}
