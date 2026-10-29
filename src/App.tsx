import { useEffect, useRef, useState } from "react";
import { BoardCanvas } from "./ui/BoardCanvas";
import { PiecePreview } from "./ui/PiecePreview";
import { SettingsDialog } from "./ui/SettingsDialog";
import { createFreeplay, useTrainer } from "./ui/useTrainer";
import { TSpinDrillScreen } from "./ui/TSpinDrillScreen";
import type { Game } from "./core/game";
import { keyLabel, saveSettings } from "./core/settings";
import type { Settings } from "./core/settings";
import { initialSettings } from "./ui/useTrainer";

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
  const [view, setView] = useState<"home" | "freeplay" | "drill">("home");
  const [freeplay, setFreeplay] = useState<Game | null>(null);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (view === "freeplay" && freeplay)
    return (
      <Freeplay
        session={freeplay}
        onHome={() => {
          freeplay.pause();
          setSettings(freeplay.settings);
          setView("home");
        }}
      />
    );
  if (view === "drill")
    return (
      <TSpinDrillScreen
        settings={settings}
        onHome={(nextSettings) => {
          if (nextSettings) setSettings(nextSettings);
          setView("home");
        }}
      />
    );
  return (
    <div className="app-shell">
      <header className="site-header">
        <h1 className="brand">Tetr Trainer</h1>
        <nav aria-label="Modes">
          <button
            className="button"
            onClick={() => {
              if (!freeplay) setFreeplay(createFreeplay());
              setView("freeplay");
            }}
          >
            Freeplay
          </button>
          <button className="button quiet" onClick={() => setSettingsOpen(true)}>
            <Icon name="settings" /> Settings
          </button>
        </nav>
      </header>
      <main className="home-layout" aria-labelledby="modules-title">
        <h2 id="modules-title">Learning modules</h2>
        <button className="module-card" onClick={() => setView("drill")}>
          <TSpinCardPreview />
          <strong>Basic T-spin setup</strong>
          <span>
            Learn the setup, then practice on your own.
          </span>
        </button>
      </main>
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          seed={freeplay?.state.seed ?? 0}
          onApply={(next) => {
            setSettings(next);
            freeplay?.configure(next);
            try {
              saveSettings(localStorage, next);
            } catch {
              // Settings remain active for this app session.
            }
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function TSpinCardPreview() {
  return (
    <svg className="t-spin-preview" viewBox="0 0 200 100" aria-hidden="true">
      <rect className="preview-well" x="0" y="0" width="200" height="100" rx="4" />
      {[...Array(10)].map((_, x) => [...Array(5)].map((__, y) => (
        <rect key={`${x}-${y}`} className="preview-grid" x={x * 20} y={y * 20} width="20" height="20" />
      )))}
      {[0, 1, 2, 3, 7, 8, 9].map((x) => (
        <rect key={x} className="preview-stack" x={x * 20 + 1} y="41" width="18" height="18" rx="2" />
      ))}
      <rect className="preview-clear" x="1" y="41" width="198" height="18" rx="2" />
      <g className="preview-piece-move">
        <g className="preview-piece-rotate">
          {[ [1, 1], [1, 2], [1, 3], [2, 2] ].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x * 20 + 1} y={y * 20 + 1} width="18" height="18" rx="2" fill="#b380e9" />
          ))}
        </g>
      </g>
      <path className="preview-floor" d="M0 99.5h200" />
    </svg>
  );
}

function Freeplay({ session, onHome }: { session: Game; onHome: () => void }) {
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
        <div className="header-navigation">
          <button className="button quiet" onClick={onHome}>
            Home
          </button>
          <h1 className="brand">Freeplay</h1>
        </div>
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
