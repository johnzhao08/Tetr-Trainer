import { useEffect, useMemo, useRef, useState } from "react";
import { SIDE_TRACK } from "../core/catalog";
import { CONTINUATION_PIECES, OpenerRun } from "../core/openerRun";
import { itemId, parseItem, recordOpener } from "../core/openerReview";
import type { OpenerItem } from "../core/openerReview";
import { openerById, openerFor, supportedBags } from "../core/openers";
import type { OpenerDef } from "../core/openers";
import { bagSummary, buildOutcome, nextDueBag } from "../core/openerView";
import { goalLabel, rowsToCells } from "../core/scenario";
import { keyLabel, saveSettings } from "../core/settings";
import type { Settings } from "../core/settings";
import { dueItems } from "../core/review";
import type { ReviewItem } from "../core/review";
import { BoardCanvas, COLORS } from "./BoardCanvas";
import { MiniBoard } from "./MiniBoard";
import { ModuleHeader } from "./ModuleHeader";
import { PiecePreview } from "./PiecePreview";
import { readTraining, writeTraining } from "./progressStorage";
import { SettingsDialog } from "./SettingsDialog";
import { useNow } from "./useNow";
import { useTrainer } from "./useTrainer";

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** Openers: pick a first bag (with review badges), build it, then play on. */
export function OpenerScreen({
  id,
  settings,
  initialItem,
  onHome,
}: {
  id: string;
  settings: Settings;
  /** A due review item to start right away. */
  initialItem?: string;
  onHome: (settings?: Settings) => void;
}) {
  const def = openerById(id)!;
  const start = initialItem ? parseItem(initialItem, settings.instantSoftDrop) : null;
  const [pick, setPick] = useState<OpenerItem | null>(start?.opener === id ? start : null);
  const [attempt, setAttempt] = useState(0);
  const [mirror, setMirror] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [current, setCurrent] = useState(settings);
  const [training, setTraining] = useState(readTraining);
  const [dialog, setDialog] = useState(false);
  const back = () => {
    setTraining(readTraining());
    setPick(null);
  };
  return (
    <div className="app-shell">
      {pick ? (
        <OpenerAttempt
          key={attempt}
          def={def}
          item={pick}
          settings={current}
          showGuide={showGuide}
          onShowGuide={setShowGuide}
          onSettings={setCurrent}
          onBack={back}
          onHome={onHome}
          onRetry={() => setAttempt(attempt + 1)}
        />
      ) : (
        <>
          <ModuleHeader title={def.name} onHome={() => onHome(current)} onSettings={() => setDialog(true)} />
          <main className="opener-picker">
            <BagPicker
              def={def}
              mirror={mirror}
              onMirror={setMirror}
              showGuide={showGuide}
              onShowGuide={setShowGuide}
              reviews={training.review}
              instant={current.instantSoftDrop}
              onStart={(item) => {
                setPick(item);
                setAttempt(attempt + 1);
              }}
            />
          </main>
          {dialog && (
            <SettingsDialog
              settings={current}
              seed={0}
              onApply={(next) => {
                setCurrent(next);
                try {
                  saveSettings(localStorage, next);
                } catch {
                  // Settings stay active for this session.
                }
                setDialog(false);
              }}
              onClose={() => setDialog(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

function BagPicker({
  def,
  mirror,
  onMirror,
  showGuide,
  onShowGuide,
  reviews,
  instant,
  onStart,
}: {
  def: OpenerDef;
  mirror: boolean;
  onMirror: (m: boolean) => void;
  showGuide: boolean;
  onShowGuide: (v: boolean) => void;
  reviews: ReviewItem[];
  instant: boolean;
  onStart: (item: OpenerItem) => void;
}) {
  const now = useNow(reviews);
  const active = openerFor(def, mirror);
  const bags = useMemo(() => supportedBags(active, instant), [active, instant]);
  const summary = SIDE_TRACK.find((m) => m.id === def.id)?.summary;
  const due = new Set(dueItems({ items: reviews }, now).map((i) => i.id));
  // Canonical bags plus every bag of this opener already in the review queue.
  const listed = new Map<string, OpenerItem>();
  for (const bag of active.canonical)
    listed.set(itemId({ opener: def.id, bag, mirror }), { opener: def.id, bag, mirror });
  for (const r of reviews) {
    const item = parseItem(r.id, instant);
    if (item?.opener === def.id && item.mirror === mirror) listed.set(r.id, item);
  }
  const dueItem = nextDueBag(reviews, now, def.id, mirror, instant);
  const pickRandom = () => ({ opener: def.id, bag: bags[Math.floor(Math.random() * bags.length)], mirror });
  return (
    <section className="level-section" aria-labelledby="opener-title">
      <div className="level-heading">
        <h2 id="opener-title">{def.name}: choose a first bag</h2>
        <p>{summary}</p>
        {def.lowPriority && <p className="card-note">All clears send 5 lines in Season 2, so this is low priority.</p>}
        <p>
          {bagSummary(active, bags.length)}{" "}
          Each bag you try becomes a review item. After the build you play {CONTINUATION_PIECES} more pieces, scored with APP.
        </p>
      </div>
      <MiniBoard rows={active.guide.map((r) => r.replace(/G/g, "X"))} label={`${def.name} target shape`} className="mini-board guide-board" />
      {def.mirror && (
        <label className="checkbox-row finesse-toggle">
          <input type="checkbox" checked={mirror} onChange={() => onMirror(!mirror)} />
          <span>Mirror (left and right swapped)</span>
        </label>
      )}
      <label className="checkbox-row finesse-toggle">
        <input type="checkbox" checked={showGuide} onChange={() => onShowGuide(!showGuide)} />
        <span>Show the shape on the board</span>
      </label>
      <ul className="bag-list" aria-label="First bags">
        {[...listed.entries()].map(([key, item]) => {
          const review = reviews.find((r) => r.id === key);
          return (
            <li key={key}>
              <button className="button" onClick={() => onStart(item)}>
                <span className="bag-order">{item.bag}</span>
                <span className="bag-badge">
                  {!review ? "New" : due.has(key) ? "Due" : `Box ${review.box}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="board-actions">
        <button className="button primary" onClick={() => onStart(nextDueBag(reviews, Date.now(), def.id, mirror, instant) ?? pickRandom())}>
          {dueItem ? "Next due bag" : "Random supported bag"}
        </button>
      </div>
    </section>
  );
}

function OpenerAttempt({
  def: baseDef,
  item,
  settings: saved,
  showGuide,
  onShowGuide,
  onSettings,
  onBack,
  onHome,
  onRetry,
}: {
  def: OpenerDef;
  item: OpenerItem;
  settings: Settings;
  showGuide: boolean;
  onShowGuide: (v: boolean) => void;
  onSettings: (s: Settings) => void;
  onBack: () => void;
  onHome: (settings?: Settings) => void;
  onRetry: () => void;
}) {
  const def = useMemo(() => openerFor(baseDef, item.mirror), [baseDef, item.mirror]);
  const [run] = useState(() => new OpenerRun(seed(), saved, def, item.bag));
  const { state, settings, settingsOpen, restart, togglePause, openSettings, closeSettings, applySettings } =
    useTrainer(run);
  const board = useRef<HTMLDivElement>(null);
  const recorded = useRef(false);
  useEffect(() => board.current?.focus(), []);
  // Record the build outcome once it is known (the spin landed, or the build
  // failed); the continuation then finishes on its own. Restart arms it again.
  const outcome = buildOutcome(run);
  useEffect(() => {
    if (outcome === null) recorded.current = false;
    else if (!recorded.current) {
      recorded.current = true;
      writeTraining(recordOpener(readTraining(), item, outcome, Date.now()));
    }
  });
  const guide = useMemo(
    () =>
      rowsToCells(def.guide).map(({ x, y, char }) => ({
        x,
        y,
        color: char === "G" ? COLORS.X : char === "*" ? COLORS.T : COLORS[char as "I"],
      })),
    [def.guide],
  );
  const b = settings.bindings;
  const building = run.stage === "build";
  return (
    <>
      <ModuleHeader title={`${def.name}${item.mirror ? " (mirror)" : ""}`} onHome={() => onHome(settings)} onSettings={openSettings}>
        <button className="button" onClick={onBack}>First bags</button>
      </ModuleHeader>
      <main className="drill-layout">
        <section className="drill-instructions" aria-label="Opener attempt">
          <h2>First bag {item.bag}</h2>
          <p>
            Build the shape from this exact order, using hold when a piece arrives early. The attempt ends the moment a
            placement stops the opener from working.
          </p>
          <ol className="goal-list" aria-label="Goals">
            {def.goals.map((goal, i) => (
              <li key={i} className={i < run.goalsMet ? "goal-done" : undefined}>{goalLabel(goal)}</li>
            ))}
          </ol>
          <label className="checkbox-row finesse-toggle">
            <input type="checkbox" checked={showGuide} onChange={() => onShowGuide(!showGuide)} />
            <span>Show the shape on the board</span>
          </label>
          <p className="key-help">
            Hold <kbd>{keyLabel(b.hold)}</kbd> · Restart <kbd>{keyLabel(b.restart)}</kbd> ·{" "}
            {building || !run.built
              ? `Pieces ${state.pieces} / ${def.pieceLimit}`
              : `Continuation ${run.continuationPieces} / ${CONTINUATION_PIECES} · APP ${run.app.toFixed(2)}`}
          </p>
        </section>
        <section className="drill-play drill-with-queue" aria-label="Opener board">
          <div className="arena">
            <div className="hold-slot">
              <div className="section-label">HOLD</div>
              <PiecePreview type={state.hold} muted={!state.canHold} />
            </div>
            <div className="board-frame" ref={board} tabIndex={0} aria-label="Drill keyboard controls" onPointerDown={() => board.current?.focus()}>
              <BoardCanvas
                board={state.board}
                active={state.active}
                paused={!run.over && state.status !== "playing"}
                guide={showGuide && building && state.lines === 0 ? guide : undefined}
              />
              {!run.over && state.status === "paused" && (
                <div className="board-overlay">
                  <h2>Paused</h2>
                  <button className="button primary" onClick={togglePause}>Resume</button>
                </div>
              )}
            </div>
            <div className="next-slot">
              <div className="section-label">NEXT</div>
              {state.queue.slice(0, 5).map((type, i) => (
                <div key={i} className="next-piece"><PiecePreview type={type} /></div>
              ))}
            </div>
          </div>
          <div className="drill-result" role="status" aria-live="polite">
            {run.stage === "failed" && `Build failed. ${run.reason}`}
            {run.stage === "done" && <OpenerResult run={run} />}
          </div>
          <div className="board-actions">
            {run.over && <button className="button primary" onClick={onRetry}>Try this bag again</button>}
            {run.over && <button className="button" onClick={onBack}>Back to first bags</button>}
            {!run.over && <button className="button" onClick={restart}>Restart</button>}
          </div>
        </section>
      </main>
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          seed={state.seed}
          onApply={(next) => {
            applySettings(next);
            onSettings(next);
          }}
          onClose={closeSettings}
        />
      )}
    </>
  );
}

function OpenerResult({ run }: { run: OpenerRun }) {
  const bands = Object.entries(run.bands).filter(([, n]) => n > 0);
  return (
    <>
      Build succeeded in {(run.buildMs / 1000).toFixed(1)}s with {run.buildPieces} pieces. Continuation: APP{" "}
      {run.app.toFixed(2)} over {run.continuationPieces} pieces
      {bands.length > 0 && <> ({bands.map(([band, n]) => `${n} ${band}`).join(", ")})</>}.
      {run.reason && ` ${run.reason}`}
    </>
  );
}
