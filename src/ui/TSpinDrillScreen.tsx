import { useEffect, useRef, useState } from "react";
import { TSpinDrill, type DrillStep } from "../core/tSpinDrill";
import { keyLabel, type Settings } from "../core/settings";
import { PiecePreview } from "./PiecePreview";
import { BoardCanvas } from "./BoardCanvas";
import { initialSettings, useTrainer } from "./useTrainer";
import { SettingsDialog } from "./SettingsDialog";
import { SettingsButton } from "./SettingsButton";

const STEPS = [
  "Rotate and lock",
  "Drop into the setup",
  "Build the overhang",
  "Three full T-spins",
] as const;

export function TSpinDrillScreen({
  settings,
  onHome,
}: {
  settings?: Settings;
  onHome: (settings?: Settings) => void;
}) {
  const [step, setStep] = useState<DrillStep>(1);
  const [currentSettings, setCurrentSettings] = useState(settings);
  return (
    <div className="app-shell">
      <DrillAttempt
        key={step}
        step={step}
        savedSettings={currentSettings}
        onStepChange={setStep}
        onHome={onHome}
        onSettingsChange={setCurrentSettings}
      />
    </div>
  );
}

function DrillAttempt({
  step,
  savedSettings,
  onStepChange,
  onHome,
  onSettingsChange,
}: {
  step: DrillStep;
  savedSettings?: Settings;
  onStepChange: (step: DrillStep) => void;
  onHome: (settings?: Settings) => void;
  onSettingsChange: (settings: Settings) => void;
}) {
  const [drill] = useState(
    () =>
      new TSpinDrill(
        crypto.getRandomValues(new Uint32Array(1))[0],
        savedSettings ?? initialSettings(),
        step,
      ),
  );
  const {
    state, settings, settingsOpen, restart, togglePause, undo,
    openSettings, closeSettings, applySettings,
  } = useTrainer(drill);
  const arena = useRef<HTMLDivElement>(null);
  useEffect(() => {
    arena.current?.focus();
  }, []);
  const act = (action: () => void) => {
    action();
    arena.current?.focus();
  };
  const result = drill.result;
  return (
    <>
      <header className="site-header">
        <div className="header-navigation">
          <button className="button" onClick={() => onHome(settings)}>
            Home
          </button>
          <h1 className="brand">Basic T-spin Setup</h1>
        </div>
        <SettingsButton onClick={openSettings} />
      </header>
      <nav className="drill-steps" aria-label="Drill steps">
        {STEPS.map((title, i) => (
          <button
            key={title}
            className="button"
            aria-current={step === i + 1 ? "step" : undefined}
            onClick={() => onStepChange((i + 1) as DrillStep)}
          >
            {i + 1}. {title}
          </button>
        ))}
      </nav>
      <p className="step-note">Choose any step. Switching steps starts a new attempt.</p>
      <main className="drill-layout">
      <section className="drill-instructions" aria-labelledby="objective-title">
        <h2 id="objective-title">
          {step === 4
            ? "Complete 3 full T-spins."
            : "Make a full T-spin"}
        </h2>
        {step === 1 && (
          <p>A full T-spin needs an overhang. Rotate the T, then hard drop.</p>
        )}
        {step === 2 && (
          <p>Slide the T under the overhang then rotate. Or try rotating counterclockwise first then directly soft dropping </p>
        )}
        {step === 3 && (
          <>
            <p>
              Start from an empty board with the fixed opening bag I → L → Z → O
              → S → J → T.
            </p>
            <p>Now try building your own overhang and do a T-spin. Make any full T-spin; you do not have to copy one exact layout.</p>
            <details>
              <summary>Example setup</summary>
              <TKIExample />
              <p>
                The Z block (red) is the overhang here.
              </p>
            </details>
          </>
        )}
        {step === 4 && (
          <p>
            Play on an empty board with random 7-bags. Build your own overhangs
            and complete three full T-spins in one attempt. They do not need to
            be consecutive.
          </p>
        )}
        {step <= 2 ? (
          <p>
            Hold and undo are disabled for this one-piece attempt. Retry with{" "}
            <kbd>{keyLabel(settings.bindings.restart)}</kbd>.
          </p>
        ) : (
          <>
            <p>
              Hold: <kbd>{keyLabel(settings.bindings.hold)}</kbd> · Undo:{" "}
              <kbd>{keyLabel(settings.bindings.undo)}</kbd> · Restart:{" "}
              <kbd>{keyLabel(settings.bindings.restart)}</kbd>.
            </p>
            <p>
              Minis do not count.
            </p>
            <p className="drill-progress" role="status">
              Full T-spins: {state.fullTSpins} / {drill.target}
            </p>
          </>
        )}
      </section>
      <section
        className={`drill-play${step >= 3 ? " drill-with-queue" : ""}`}
        aria-label="T-spin drill"
      >
        <div className={step >= 3 ? "arena" : undefined}>
          {step >= 3 && (
            <div className="hold-slot">
              <div className="section-label">HOLD</div>
              <PiecePreview type={state.hold} muted={!state.canHold} />
            </div>
          )}
          <div
            className="board-frame"
            ref={arena}
            tabIndex={0}
            aria-label="Drill keyboard controls"
            onPointerDown={() => arena.current?.focus()}
          >
            <BoardCanvas
              board={state.board}
              active={state.active}
              paused={!result && state.status !== "playing"}
            />
            {!result && state.status === "paused" && (
              <div className="board-overlay">
                <h2>Paused</h2>
                <button
                  className="button primary"
                  onClick={() => act(togglePause)}
                >
                  Resume
                </button>
              </div>
            )}
          </div>
          {step >= 3 && (
            <div className="next-slot">
              <div className="section-label">NEXT</div>
              {state.queue.slice(0, 5).map((type, i) => (
                <div key={i} className="next-piece">
                  <PiecePreview type={type} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="drill-result" role="status" aria-live="polite">
          {result === "success"
            ? step === 4
              ? "Success — 3 full T-spins completed."
              : `Success — ${state.lastEvent!.label}.`
            : result === "retry"
              ? state.status === "over"
                ? "Topped out. Try again."
                : state.lastEvent?.spin === "mini"
                  ? "T-spin Mini — this drill requires a full T-spin. Try again."
                  : "That lock was not a T-spin. Rotate before locking; try again."
              : step >= 3 && state.lastEvent
                ? `${state.lastEvent.label}${state.lastEvent.spin === "mini" ? " — mini does not count; keep building." : ""}`
                : null}
        </div>
        <div className="board-actions">
          {step >= 3 && !result && (
            <button
              className="button"
              disabled={!state.canUndo}
              onClick={() => act(undo)}
            >
              Undo
            </button>
          )}
          <button className="button" onClick={() => act(restart)}>
            {result ? "Try again" : "Restart"}
          </button>
          {result ? (
            <button className="button" onClick={() => onHome(settings)}>
              Home
            </button>
          ) : (
            <button className="button" onClick={() => act(togglePause)}>
              {state.status === "paused" ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </section>
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
      </main>
    </>
  );
}

function TKIExample() {
  const rows = [".......J..", "L..ZZ.SJJJ", "L...ZZSSOO", "LL.IIIISOO"];
  const colors: Record<string, string> = {
    I: "#36c9d2", J: "#5573e8", L: "#ed9a38", O: "#e7cb42", S: "#68c778", Z: "#dc5b62",
  };
  return (
    <svg className="tki-example" viewBox="0 0 200 80" role="img" aria-label="TKI example board, four rows shown from top to bottom">
      {rows.flatMap((row, y) => [...row].flatMap((cell, x) => cell === "." ? [] : [
        <rect key={`${x}-${y}`} x={x * 20 + 1} y={y * 20 + 1} width="18" height="18" rx="2" fill={colors[cell]} />,
      ]))}
    </svg>
  );
}
