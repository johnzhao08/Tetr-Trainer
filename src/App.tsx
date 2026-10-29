import { useEffect, useRef } from "react";
import { BoardCanvas } from "./ui/BoardCanvas";
import { PiecePreview } from "./ui/PiecePreview";
import { SettingsDialog } from "./ui/SettingsDialog";
import { useTrainer } from "./ui/useTrainer";
import { keyLabel } from "./core/settings";

function Icon({ name }: { name: "settings" | "restart" | "pause" | "play" }) {
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
      ) : name === "play" ? (
        <path d="m8 4 12 8-12 8z" />
      ) : (
        <>
          <path d="M4 7h16M4 17h16" />
          <path d="M9 4v6M15 14v6" />
        </>
      )}
    </svg>
  );
}
export default function App() {
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
  } = useTrainer();
  const arena = useRef<HTMLDivElement>(null);
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
      <header className="site-header">
        <h1 className="brand">Tetr Trainer</h1>
        <button className="button quiet" onClick={openSettings}>
          <Icon name="settings" />
          Settings
        </button>
      </header>
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
              <span>Zero gravity · SRS+</span>
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
