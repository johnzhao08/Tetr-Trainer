import { useRef, useState } from "react";
import { BoardCanvas } from "./ui/BoardCanvas";
import { PiecePreview } from "./ui/PiecePreview";
import { SettingsDialog } from "./ui/SettingsDialog";
import { useTrainer } from "./ui/useTrainer";
import { keyLabel } from "./core/settings";
import type { Action } from "./core/settings";

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
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
  const [copied, setCopied] = useState(false);
  const focus = () => arena.current?.focus();
  const act = (fn: () => void) => {
    fn();
    focus();
  };
  const controls: [Action, string][] = [
    ["left", "Move"],
    ["cw", "Rotate CW"],
    ["ccw", "Rotate CCW"],
    ["flip", "Rotate 180°"],
    ["softDrop", "Soft drop"],
    ["hardDrop", "Hard drop"],
    ["hold", "Hold"],
    ["undo", "Undo"],
  ];
  const copySession = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ seed: state.seed, settings }, null, 2),
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="Tetr Trainer home">
          <Mark />
          <span>
            tetr<span className="brand-light">trainer</span>
          </span>
        </a>
        <span className="header-tag">
          <span className="status-dot" />A little practice, every day.
        </span>
        <button className="button quiet" onClick={openSettings}>
          <Icon name="settings" />
          Settings
        </button>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">YOUR PRACTICE SPACE</div>
            <h1>
              Find your flow<span>.</span>
            </h1>
            <p>No pressure. Just you and the next piece.</p>
          </div>
          <div className="mode-pill">
            <span className="status-dot" />
            FREE PLAY
            <span className="pill-divider" />
            ZERO GRAVITY
          </div>
        </div>
        <div className="practice-layout">
          <aside className="left-panel">
            <section className="guide-card">
              <span className="card-index">01 / THE PLAYGROUND</span>
              <h2>Take your time.</h2>
              <p>
                Pieces stay where you put them. Explore a setup, find the
                rotation, then commit.
              </p>
              <div className="guide-rule">
                <span className="rule-icon">↓</span>
                <div>
                  <strong>Move without locking</strong>
                  <span>Soft drop to explore the stack.</span>
                </div>
              </div>
              <div className="guide-rule">
                <span className="rule-icon">↵</span>
                <div>
                  <strong>Lock when you’re ready</strong>
                  <span>Hard drop places your piece.</span>
                </div>
              </div>
            </section>
            <section className="controls-card">
              <div className="section-label">
                YOUR CONTROLS
                <button className="text-button" onClick={openSettings}>
                  Edit ↗
                </button>
              </div>
              <div className="control-list">
                {controls.map(([action, label]) => (
                  <div className="control-row" key={action}>
                    <span>{label}</span>
                    <span className="keys">
                      <kbd>{keyLabel(settings.bindings[action])}</kbd>
                      {action === "left" && (
                        <kbd>{keyLabel(settings.bindings.right)}</kbd>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <div className="rotation-note">
              <span>↻</span>
              <p>
                <strong>SRS+ rotations</strong>
                <br />
                Room for the tricky ones.
              </p>
            </div>
          </aside>
          <section className="play-area" aria-label="Free play">
            <div className="play-status">
              <span>
                <span
                  className={`status-dot ${state.status !== "playing" ? "muted" : ""}`}
                />
                {state.status === "playing"
                  ? "READY TO PLAY"
                  : state.status === "paused"
                    ? "TAKE A BREATHER"
                    : "ONE MORE TRY?"}
              </span>
              <span>10 × 20</span>
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
                    <span className="overlay-glyph">
                      {state.status === "over" ? "↻" : "Ⅱ"}
                    </span>
                    <h2>
                      {state.status === "over"
                        ? "A fresh start."
                        : "On your time."}
                    </h2>
                    <p>
                      {state.status === "over"
                        ? "There’s always another way to stack."
                        : "Your board will be right here."}
                    </p>
                    <button
                      className="button primary"
                      onClick={() =>
                        act(state.status === "over" ? restart : togglePause)
                      }
                    >
                      {state.status === "over"
                        ? "Try again"
                        : "Resume practice"}
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
              <div className="section-label">THIS SESSION</div>
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
                <span>Time played</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {String(state.lines).padStart(2, "0")}
                </span>
                <span>Lines cleared</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {String(state.pieces).padStart(2, "0")}
                </span>
                <span>Pieces placed</span>
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
                    <span className="section-label">LAST CLEAR / SPIN</span>
                    <strong>{state.lastEvent.label}</strong>
                  </div>
                ) : (
                  "One piece at a time."
                )}
              </div>
            </section>
            <section className="handling-card">
              <div className="section-label">YOUR HANDLING</div>
              <div className="handling-values">
                <div>
                  <strong>
                    {settings.das}
                    <small>ms</small>
                  </strong>
                  <span>DAS</span>
                </div>
                <div>
                  <strong>
                    {settings.arr}
                    <small>ms</small>
                  </strong>
                  <span>ARR</span>
                </div>
                <div>
                  <strong>
                    {settings.dcd}
                    <small>ms</small>
                  </strong>
                  <span>DCD</span>
                </div>
              </div>
              <div className="soft-status">
                <span>Soft drop</span>
                <strong>
                  {settings.instantSoftDrop
                    ? "Instant"
                    : `${settings.softDropSpeed} cells/s`}
                </strong>
              </div>
              <button className="text-button" onClick={openSettings}>
                Make it yours <span>↗</span>
              </button>
            </section>
            <div className="seed-card">
              <span className="section-label">SESSION SEED</span>
              <code>{state.seed}</code>
              <button className="text-button" onClick={copySession}>
                {copied ? "Copied seed & settings ✓" : "Copy seed & settings"}
              </button>
            </div>
          </aside>
        </div>
        <div className="notice" role="status">
          {notice}
        </div>
      </main>
      <footer>
        <span>
          <span className="tiny-block" />
          Built for the love of the stack.
        </span>
        <span>
          ZERO GRAVITY <i /> MANUAL LOCK <i /> SRS+
        </span>
      </footer>
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          onApply={(s) => {
            applySettings(s);
            focus();
          }}
          onClose={() => {
            closeSettings();
            focus();
          }}
        />
      )}
    </div>
  );
}
