import { useEffect, useRef, useState } from "react";
import type { Stage } from "../core/curriculum";
import type { DrillDef } from "../core/drill";
import { findDrill } from "../core/drillLookup";
import { createRun, finishRun } from "../core/drillRun";
import type { Outcome } from "../core/drillRun";
import { newSessionId } from "../core/drillView";
import { keyLabel, saveSettings } from "../core/settings";
import type { Settings } from "../core/settings";
import { BoardCanvas } from "./BoardCanvas";
import { DrillHud, IncomingMeter } from "./DrillHud";
import { DrillIntro } from "./DrillIntro";
import { DrillResults } from "./DrillResults";
import { ModuleHeader } from "./ModuleHeader";
import { PiecePreview } from "./PiecePreview";
import { readProgress, storage } from "./progressStorage";
import { SettingsDialog } from "./SettingsDialog";
import { useTrainer } from "./useTrainer";

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];


export function DrillScreen({
  id,
  settings,
  onHome,
}: {
  id: string;
  settings: Settings;
  onHome: (settings?: Settings) => void;
}) {
  const found = findDrill(id);
  // 0 is the intro; each Start or Retry bumps it and remounts the run.
  const [attempt, setAttempt] = useState(0);
  const [current, setCurrent] = useState(settings);
  const [dialog, setDialog] = useState(false);
  if (!found) return null;
  const { drill, stage } = found;
  return (
    <div className="app-shell">
      {attempt === 0 ? (
        <>
          <ModuleHeader
            title={drill.title}
            onHome={() => onHome(current)}
            onSettings={() => setDialog(true)}
          />
          <DrillIntro
            def={drill}
            stage={stage}
            progress={readProgress()}
            active={!dialog}
            onStart={() => setAttempt(1)}
          />
          {dialog && (
            <SettingsDialog
              settings={current}
              seed={0}
              onApply={(next) => {
                setCurrent(next);
                try {
                  saveSettings(localStorage, next);
                } catch {
                  /* Settings stay active for this session. */
                }
                setDialog(false);
              }}
              onClose={() => setDialog(false)}
            />
          )}
        </>
      ) : (
        <DrillRun
          key={attempt}
          def={drill}
          stage={stage}
          settings={current}
          onSettingsChange={setCurrent}
          onRetry={() => setAttempt((n) => n + 1)}
          onHome={onHome}
        />
      )}
    </div>
  );
}

function DrillRun({
  def,
  stage,
  settings: initial,
  onSettingsChange,
  onRetry,
  onHome,
}: {
  def: DrillDef;
  stage: Stage;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onRetry: () => void;
  onHome: (settings?: Settings) => void;
}) {
  const [run] = useState(() => createRun(def, newSeed(), initial));
  const { session } = run;
  const {
    state, settings, settingsOpen, refresh, undo, restart, togglePause,
    openSettings, closeSettings, applySettings,
  } = useTrainer(run.controller);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const runId = useRef<string | null>(null);
  const status = session.status;
  const playing = status === "playing";

  // Save once per finish. The id is kept until play resumes, so a repeated
  // effect (strict mode) replaces the same record instead of adding another.
  useEffect(() => {
    if (playing) {
      runId.current = null;
      return;
    }
    runId.current ??= newSessionId();
    setOutcome(finishRun(storage(), run, runId.current, Date.now()));
  }, [playing, run]);

  // Buttons ignore game keys, so hand focus back to the board.
  useEffect(() => {
    if (playing && !settingsOpen) board.current?.focus();
  }, [playing, settingsOpen]);
  const act = (fn: () => void) => {
    fn();
    board.current?.focus();
  };
  const retryFrom = (index: number) => {
    run.retryFrom(index);
    setOutcome(null);
    refresh();
  };
  const b = settings.bindings;
  const garbageOn = !!(def.options?.opponent || state.incoming.length);
  return (
    <>
      <ModuleHeader title={def.title} onHome={() => onHome(settings)} onSettings={openSettings} />
      {playing ? (
        <main className="drill-layout drill-run">
          <section className="drill-play drill-with-queue" aria-label={def.title}>
            <div className="arena">
              <div className="hold-slot">
                <div className="section-label">HOLD</div>
                <PiecePreview type={state.hold} muted={!state.canHold || !!def.noHold} />
              </div>
              <div className={garbageOn ? "board-wrap with-meter" : "board-wrap"}>
                {garbageOn && <IncomingMeter state={state} />}
                <div
                  className="board-frame"
                  ref={board}
                  tabIndex={0}
                  aria-label="Drill keyboard controls"
                  onPointerDown={() => board.current?.focus()}
                >
                  <BoardCanvas board={state.board} active={state.active} paused={state.status !== "playing"} />
                  {state.status === "paused" && (
                    <div className="board-overlay">
                      <h2>Paused</h2>
                      <button className="button primary" onClick={() => act(togglePause)}>
                        Resume
                      </button>
                    </div>
                  )}
                </div>
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
            <div className="board-actions">
              <button className="button" disabled={!state.canUndo} onClick={() => act(undo)}>
                Undo
              </button>
              <button className="button" onClick={() => act(restart)}>
                Restart
              </button>
              <button className="button" onClick={() => act(togglePause)}>
                {state.status === "paused" ? "Resume" : "Pause"}
              </button>
            </div>
            <p className="key-help">
              {!def.noHold && <>Hold <kbd>{keyLabel(b.hold)}</kbd> · </>}
              Undo <kbd>{keyLabel(b.undo)}</kbd> (run will not count) · Restart{" "}
              <kbd>{keyLabel(b.restart)}</kbd>
            </p>
          </section>
          <DrillHud session={session} state={state} />
        </main>
      ) : outcome ? (
        <DrillResults
          session={session}
          stage={stage}
          outcome={outcome}
          before={run.before}
          onRetry={onRetry}
          onRetryFrom={retryFrom}
          onHome={() => onHome(settings)}
        />
      ) : null}
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
