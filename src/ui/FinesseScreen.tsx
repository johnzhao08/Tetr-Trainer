import { useEffect, useMemo, useRef, useState } from "react";
import { cells } from "../core/board";
import type { FinesseInput } from "../core/finesse";
import { FinesseDrill, type FinesseMode } from "../core/finesseDrill";
import { keyLabel, type Settings } from "../core/settings";
import { BoardCanvas, COLORS } from "./BoardCanvas";
import { ModuleHeader } from "./ModuleHeader";
import { PiecePreview } from "./PiecePreview";
import { SettingsDialog } from "./SettingsDialog";
import { useTrainer } from "./useTrainer";

export function FinesseScreen({
  title,
  mode,
  settings,
  onHome,
}: {
  title: string;
  mode: Omit<FinesseMode, "use180">;
  settings: Settings;
  onHome: (settings?: Settings) => void;
}) {
  const [use180, setUse180] = useState(true);
  const [current, setCurrent] = useState(settings);
  return (
    <div className="app-shell">
      <FinesseAttempt
        key={String(use180)}
        title={title}
        mode={{ ...mode, use180 }}
        savedSettings={current}
        onHome={onHome}
        onSettingsChange={setCurrent}
        onToggle180={() => setUse180(!use180)}
      />
    </div>
  );
}

function FinesseAttempt({
  title,
  mode,
  savedSettings,
  onHome,
  onSettingsChange,
  onToggle180,
}: {
  title: string;
  mode: FinesseMode;
  savedSettings: Settings;
  onHome: (settings?: Settings) => void;
  onSettingsChange: (settings: Settings) => void;
  onToggle180: () => void;
}) {
  const [drill] = useState(
    () =>
      new FinesseDrill(
        crypto.getRandomValues(new Uint32Array(1))[0],
        savedSettings,
        mode,
      ),
  );
  const {
    state, settings, settingsOpen, restart, togglePause,
    openSettings, closeSettings, applySettings,
  } = useTrainer(drill);
  const board = useRef<HTMLDivElement>(null);
  useEffect(() => board.current?.focus(), []);
  const act = (action: () => void) => {
    action();
    board.current?.focus();
  };
  const target = drill.target;
  const guide = useMemo(
    () =>
      target
        ? cells(target).map(([x, y]) => ({ x, y, color: COLORS[target.type] }))
        : [],
    [target],
  );
  const last = drill.results.at(-1);
  const seconds = (drill.elapsedMs / 1000).toFixed(1);
  const label = (input: FinesseInput) => {
    const b = settings.bindings;
    if (input === "dasLeft") return `hold ${keyLabel(b.left)}`;
    if (input === "dasRight") return `hold ${keyLabel(b.right)}`;
    return keyLabel(b[input]);
  };
  return (
    <>
      <ModuleHeader
        title={title}
        onHome={() => onHome(settings)}
        onSettings={openSettings}
      />
      <main className="drill-layout">
        <section className="drill-instructions" aria-labelledby="finesse-goal">
          <h2 id="finesse-goal">
            Drop each piece on the outline using the fewest presses.
          </h2>
          <p>
            A tap moves one cell. Holding a direction (DAS) to the wall counts
            as one press, the same as a tap. Rotations count one each.
          </p>
          {mode.hints && target && (
            <p className="finesse-hint">
              Optimal:{" "}
              {drill.optimal.length ? (
                drill.optimal.map((input, i) => <kbd key={i}>{label(input)}</kbd>)
              ) : (
                <span>just hard drop</span>
              )}{" "}
              then <kbd>{keyLabel(settings.bindings.hardDrop)}</kbd>
            </p>
          )}
          <label className="checkbox-row finesse-toggle">
            <input type="checkbox" checked={mode.use180} onChange={onToggle180} />
            <span>Count 180° rotation as one press (restarts)</span>
          </label>
          <dl className="drill-stats">
            <div>
              <dt>Pieces</dt>
              <dd>
                {drill.results.length} / {mode.length}
              </dd>
            </div>
            <div>
              <dt>Perfect</dt>
              <dd>{drill.perfect}</dd>
            </div>
            <div>
              <dt>Extra presses</dt>
              <dd>{drill.extraPresses}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{seconds}s</dd>
            </div>
          </dl>
        </section>
        <section className="drill-play drill-with-queue" aria-label={title}>
          <div className="arena">
            <div className="hold-slot" />
            <div
              className="board-frame"
              ref={board}
              tabIndex={0}
              aria-label="Finesse keyboard controls"
              onPointerDown={() => board.current?.focus()}
            >
              <BoardCanvas
                board={state.board}
                active={state.active}
                paused={!drill.done && state.status !== "playing"}
                guide={guide}
              />
              {!drill.done && state.status === "paused" && (
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
              {state.queue.slice(0, 3).map((type, i) => (
                <div key={i} className="next-piece">
                  <PiecePreview type={type} />
                </div>
              ))}
            </div>
          </div>
          <div className="drill-result" role="status" aria-live="polite">
            {drill.done
              ? `Done: ${drill.perfect} / ${mode.length} perfect, ${drill.extraPresses} extra presses in ${seconds}s.`
              : last
                ? !last.correct
                  ? "Missed the outline."
                  : last.presses <= last.optimal
                    ? `Perfect: ${last.presses} press${last.presses === 1 ? "" : "es"}.`
                    : `${last.presses - last.optimal} extra (${last.presses} vs ${last.optimal}).`
                : null}
          </div>
          <div className="board-actions">
            <button className="button" onClick={() => act(restart)}>
              {drill.done ? "Try again" : "Restart"}
              <kbd>{keyLabel(settings.bindings.restart)}</kbd>
            </button>
            {!drill.done && (
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
