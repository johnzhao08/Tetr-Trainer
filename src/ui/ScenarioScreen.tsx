import { useEffect, useMemo, useRef, useState } from "react";
import { goalLabel, rowsToCells, ScenarioDrill } from "../core/scenario";
import type { ScenarioModule } from "../core/scenarios";
import { keyLabel, type Settings } from "../core/settings";
import { BoardCanvas, COLORS } from "./BoardCanvas";
import { ModuleHeader } from "./ModuleHeader";
import { MiniBoard } from "./MiniBoard";
import { PiecePreview } from "./PiecePreview";
import { SettingsDialog } from "./SettingsDialog";
import { useTrainer } from "./useTrainer";

// Shared screen for opener, line-clear, and spin drills described as data.
export function ScenarioScreen({
  module,
  settings,
  onHome,
}: {
  module: ScenarioModule;
  settings: Settings;
  onHome: (settings?: Settings) => void;
}) {
  const [step, setStep] = useState(0);
  const [current, setCurrent] = useState(settings);
  return (
    <div className="app-shell">
      <ScenarioAttempt
        key={step}
        module={module}
        step={step}
        savedSettings={current}
        onStepChange={setStep}
        onHome={onHome}
        onSettingsChange={setCurrent}
      />
    </div>
  );
}

function ScenarioAttempt({
  module,
  step,
  savedSettings,
  onStepChange,
  onHome,
  onSettingsChange,
}: {
  module: ScenarioModule;
  step: number;
  savedSettings: Settings;
  onStepChange: (step: number) => void;
  onHome: (settings?: Settings) => void;
  onSettingsChange: (settings: Settings) => void;
}) {
  const { title, notes, scenario } = module.steps[step];
  const [drill] = useState(
    () =>
      new ScenarioDrill(
        crypto.getRandomValues(new Uint32Array(1))[0],
        savedSettings,
        scenario,
      ),
  );
  const {
    state, settings, settingsOpen, restart, togglePause, undo,
    openSettings, closeSettings, applySettings,
  } = useTrainer(drill);
  const [showGuide, setShowGuide] = useState(true);
  const board = useRef<HTMLDivElement>(null);
  useEffect(() => board.current?.focus(), []);
  const act = (action: () => void) => {
    action();
    board.current?.focus();
  };
  const guide = useMemo(
    () =>
      rowsToCells(scenario.guide ?? []).map(({ x, y, char }) => ({
        x,
        y,
        color: char === "G" ? COLORS.X : char === "*" ? COLORS.T : COLORS[char as "I"],
      })),
    [scenario.guide],
  );
  const result = drill.result;
  const hold = scenario.allowHold !== false;
  const b = settings.bindings;
  return (
    <>
      <ModuleHeader
        title={module.title}
        onHome={() => onHome(settings)}
        onSettings={openSettings}
      />
      {module.steps.length > 1 && (
        <nav className="drill-steps" aria-label="Drill steps">
          {module.steps.map((s, i) => (
            <button
              key={s.title}
              className="button"
              aria-current={step === i ? "step" : undefined}
              onClick={() => onStepChange(i)}
            >
              {i + 1}. {s.title}
            </button>
          ))}
        </nav>
      )}
      <main className="drill-layout">
        <section className="drill-instructions" aria-labelledby="scenario-goal">
          <h2 id="scenario-goal">{module.intro}</h2>
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {scenario.guide && (
            <>
              <MiniBoard rows={scenario.guide} label={`${title} target shape`} className="mini-board guide-board" />
              <label className="checkbox-row finesse-toggle">
                <input
                  type="checkbox"
                  checked={showGuide}
                  onChange={() => setShowGuide(!showGuide)}
                />
                <span>Show the shape on the board</span>
              </label>
            </>
          )}
          <ol className="goal-list" aria-label="Goals">
            {scenario.goals.map((goal, i) => (
              <li
                key={i}
                className={i < drill.goalIndex ? "goal-done" : i === drill.goalIndex ? "goal-current" : undefined}
              >
                {goalLabel(goal)}
              </li>
            ))}
          </ol>
          <p className="key-help">
            {hold && <>Hold <kbd>{keyLabel(b.hold)}</kbd> · </>}
            Undo <kbd>{keyLabel(b.undo)}</kbd> · Restart{" "}
            <kbd>{keyLabel(b.restart)}</kbd>
            {scenario.pieceLimit !== undefined && (
              <> · Pieces {state.pieces} / {scenario.pieceLimit}</>
            )}
          </p>
        </section>
        <section className="drill-play drill-with-queue" aria-label={title}>
          <div className="arena">
            <div className="hold-slot">
              <div className="section-label">HOLD</div>
              <PiecePreview type={state.hold} muted={!state.canHold} />
            </div>
            <div
              className="board-frame"
              ref={board}
              tabIndex={0}
              aria-label="Drill keyboard controls"
              onPointerDown={() => board.current?.focus()}
            >
              <BoardCanvas
                board={state.board}
                active={state.active}
                paused={!result && state.status !== "playing"}
                guide={showGuide && state.lines === 0 ? guide : undefined}
              />
              {!result && state.status === "paused" && (
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
          <div className="drill-result" role="status" aria-live="polite">
            {result === "success"
              ? `Success in ${state.pieces} pieces.`
              : result === "failed"
                ? drill.failure === "topOut"
                  ? "Topped out. Restart to try again."
                  : "Out of pieces. Undo or restart to try again."
                : state.lastEvent?.id === state.pieces
                  ? `${state.lastEvent.label}${state.lastEvent.spin === "mini" ? ": minis do not count." : ""}`
                  : null}
          </div>
          <div className="board-actions">
            {result !== "success" && (
              <button className="button" disabled={!state.canUndo} onClick={() => act(undo)}>
                Undo
              </button>
            )}
            <button className="button" onClick={() => act(restart)}>
              {result ? "Try again" : "Restart"}
            </button>
            {!result && (
              <button className="button" onClick={() => act(togglePause)}>
                {state.status === "paused" ? "Resume" : "Pause"}
              </button>
            )}
          </div>
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
