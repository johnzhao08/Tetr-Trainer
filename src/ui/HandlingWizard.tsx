import { useEffect, useRef, useState } from "react";
import { createRun } from "../core/drillRun";
import {
  acceptRun,
  HANDLING_DAS_STEPS,
  HANDLING_DCD,
  HANDLING_DRILL,
  HANDLING_PIECES,
  FINESSE_TOLERANCE,
  handlingSettings,
  nextDas,
  recommendDas,
} from "../core/handling";
import type { HandlingRun } from "../core/handling";
import { METRIC_INFO } from "../core/progress";
import { keyLabel, saveSettings } from "../core/settings";
import type { Settings } from "../core/settings";
import { BoardCanvas } from "./BoardCanvas";
import { ModuleHeader } from "./ModuleHeader";
import { PiecePreview } from "./PiecePreview";
import { SettingsDialog } from "./SettingsDialog";
import { useTrainer } from "./useTrainer";

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const pct = METRIC_INFO.finesse.format;

// Walks DAS down in short finesse runs. Nothing here is saved to progress;
// only Apply writes settings, through `onApply`.
export function HandlingWizard({
  settings: initial,
  onApply,
  onHome,
}: {
  settings: Settings;
  onApply: (settings: Settings) => void;
  onHome: (settings?: Settings) => void;
}) {
  // The player's own settings; test DAS values are layered on top per run.
  const [user, setUser] = useState(initial);
  const [runs, setRuns] = useState<HandlingRun[]>([]);
  // "ready": between runs (or before the first); "run": playing one.
  const [phase, setPhase] = useState<"ready" | "run">("ready");
  const [dialog, setDialog] = useState(false);
  // Set when the last run ended before all pieces; it is not counted.
  const [early, setEarly] = useState(false);
  // Bumped on a retry so the run view starts fresh at the same DAS.
  const [attempt, setAttempt] = useState(0);
  const das = nextDas(runs);
  const last = runs[runs.length - 1];
  const recommended = recommendDas(runs);
  const saveUser = (next: Settings) => {
    setUser(next);
    try {
      saveSettings(localStorage, next);
    } catch {
      /* Settings stay active for this session. */
    }
  };

  if (phase === "run" && das !== null)
    return (
      <div className="app-shell">
        <HandlingRunView
          key={`${das}-${attempt}`}
          das={das}
          user={user}
          onUser={saveUser}
          onHome={() => onHome(user)}
          onDone={(result) => {
            if (result) setRuns((r) => [...r, result]);
            else setAttempt((n) => n + 1);
            setEarly(!result);
            setPhase("ready");
          }}
        />
      </div>
    );

  return (
    <div className="app-shell">
      <ModuleHeader
        title="Handling setup"
        onHome={() => onHome(user)}
        onSettings={() => setDialog(true)}
      />
      <main className="handling-wizard">
        <section aria-labelledby="handling-intro">
          <h2 id="handling-intro">Find your DAS</h2>
          <p className="level-detail">
            ARR is set to 0 and DCD to {HANDLING_DCD} ms. Then you play{" "}
            {HANDLING_PIECES} pieces on a real stack at each DAS from{" "}
            {HANDLING_DAS_STEPS[0]} down to{" "}
            {HANDLING_DAS_STEPS[HANDLING_DAS_STEPS.length - 1]} ms. Lower DAS only
            helps while you keep control, so the best DAS is the lowest one where
            finesse stays within {Math.round(FINESSE_TOLERANCE * 100)} points of
            your best run. Only lower it once the current setting feels
            effortless.
          </p>
        </section>
        {runs.length > 0 && (
          <section aria-labelledby="handling-results">
            <h3 id="handling-results">Runs</h3>
            <table className="handling-table">
              <thead>
                <tr>
                  <th scope="col">DAS</th>
                  <th scope="col">Finesse</th>
                  <th scope="col">Extra presses</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.das} className={r.das === recommended ? "pick" : ""}>
                    <th scope="row">{r.das} ms</th>
                    <td>{pct(r.finesse)}</td>
                    <td>{r.extraPresses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {last && (
              <p role="status" className="level-detail">
                {last.das} ms: {pct(last.finesse)} finesse, {last.extraPresses}{" "}
                extra {last.extraPresses === 1 ? "press" : "presses"}.
              </p>
            )}
          </section>
        )}
        {early && das !== null && (
          <p role="status" className="level-detail">
            Run ended early at DAS {das} ms. It was not counted, so try the step
            again.
          </p>
        )}
        {recommended !== null && (
          <p className="handling-reco">
            Recommended: <strong>DAS {recommended} ms</strong>, ARR 0, DCD{" "}
            {HANDLING_DCD} ms.
          </p>
        )}
        <div className="button-row">
          {das !== null && (
            <button
              className="button primary"
              onClick={() => setPhase("run")}
            >
              {early ? "Retry step" : runs.length === 0 ? "Start" : "Next"}: DAS{" "}
              {das} ms
            </button>
          )}
          {recommended !== null && (
            <button
              className={das === null ? "button primary" : "button"}
              onClick={() => onApply(handlingSettings(user, recommended))}
            >
              Apply DAS {recommended} ms
            </button>
          )}
          <button className="button quiet" onClick={() => onHome(user)}>
            {runs.length > 0 ? "Keep my settings" : "Cancel"}
          </button>
        </div>
      </main>
      {dialog && (
        <SettingsDialog
          settings={user}
          seed={0}
          onApply={(next) => {
            saveUser(next);
            setDialog(false);
          }}
          onClose={() => setDialog(false)}
        />
      )}
    </div>
  );
}

function HandlingRunView({
  das,
  user,
  onUser,
  onHome,
  onDone,
}: {
  das: number;
  user: Settings;
  onUser: (settings: Settings) => void;
  onHome: () => void;
  /** The accepted run, or null when it ended early. */
  onDone: (run: HandlingRun | null) => void;
}) {
  const [run] = useState(() =>
    createRun(HANDLING_DRILL, newSeed(), handlingSettings(user, das)),
  );
  const { session } = run;
  const { state, settingsOpen, togglePause, openSettings, closeSettings } =
    useTrainer(run.controller);
  const board = useRef<HTMLDivElement>(null);
  const reported = useRef(false);
  const playing = session.status === "playing";

  useEffect(() => {
    if (playing || reported.current) return;
    reported.current = true;
    onDone(
      acceptRun(das, {
        pieces: session.game.state.pieces,
        finesse: session.metrics().finesse,
        extraPresses: session.game.state.stats.finesseFaults,
      }),
    );
  }, [playing, session, das, onDone]);
  useEffect(() => {
    if (playing && !settingsOpen) board.current?.focus();
  }, [playing, settingsOpen]);

  return (
    <>
      <ModuleHeader title={`Handling: DAS ${das} ms`} onHome={onHome} onSettings={openSettings} />
      <main className="drill-layout drill-run">
        <section className="drill-play drill-with-queue" aria-label="Handling run">
          <p className="level-detail" role="status">
            Piece {Math.min(state.pieces + 1, HANDLING_PIECES)} of {HANDLING_PIECES}. Keys:
            move <kbd>{keyLabel(user.bindings.left)}</kbd>{" "}
            <kbd>{keyLabel(user.bindings.right)}</kbd>, drop{" "}
            <kbd>{keyLabel(user.bindings.hardDrop)}</kbd>.
          </p>
          <div className="arena">
            <div className="hold-slot">
              <div className="section-label">HOLD</div>
              <PiecePreview type={state.hold} muted={!state.canHold} />
            </div>
            <div className="board-wrap">
              <div
                className="board-frame"
                ref={board}
                tabIndex={0}
                aria-label="Handling run keyboard controls"
                onPointerDown={() => board.current?.focus()}
              >
                <BoardCanvas board={state.board} active={state.active} paused={state.status !== "playing"} />
                {state.status === "paused" && (
                  <div className="board-overlay">
                    <h2>Paused</h2>
                    <button className="button primary" onClick={togglePause}>
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
        </section>
      </main>
      {settingsOpen && (
        <SettingsDialog
          settings={user}
          seed={state.seed}
          onApply={(next) => {
            onUser(next);
            // Keep this run at its test DAS; the player's DAS stays as saved.
            run.controller.configure(handlingSettings(next, das));
            closeSettings();
          }}
          onClose={closeSettings}
        />
      )}
    </>
  );
}
