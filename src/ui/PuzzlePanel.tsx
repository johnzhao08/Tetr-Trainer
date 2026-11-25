import { goalLabel } from "../core/puzzle";
import type { GoalProgress, PuzzleDef } from "../core/puzzle";
import type { Band } from "../core/coach";
import type { DrillFlag } from "../core/dig";
import { keyLabel } from "../core/settings";
import type { Settings } from "../core/settings";

const FLAG_NAMES = {
  hole: "hole",
  overhang: "overhang",
  spike: "height spike",
  "two-wide": "2-wide gap",
  "i-dependency": "needs an I",
  "lost-tsd": "lost T-spin slot",
  high: "stack too high",
  "next-hole-blocked": "next hole blocked", "cost-lines": "extra lines to dig",
  "wasted-i": "wasted I", "hold-fit": "missed hold", "own-line": "own-line clear",
} as const;
type Review = { band: Band; flags: readonly DrillFlag[] };

/** The coach's verdict on the last placement, as one short line. */
export function coachChip(review: Review | undefined): string | null {
  if (!review) return null;
  const flags = review.flags.map((f) => FLAG_NAMES[f.kind]).join(", ");
  return flags ? `Coach: ${review.band} (${flags})` : `Coach: ${review.band}`;
}

// Left column: what to do, how far along you are, and the hint.
export function PuzzlePanel({
  def,
  progress,
  pieces,
  seconds,
  review,
  hintShown,
  onHint,
  settings,
}: {
  def: PuzzleDef;
  progress: GoalProgress;
  pieces: number;
  seconds: number;
  review: Review | undefined;
  hintShown: boolean;
  onHint: () => void;
  settings: Settings;
}) {
  const b = settings.bindings;
  const chip = coachChip(review);
  const timeLeft =
    def.timeMs === undefined ? null : Math.max(0, def.timeMs / 1000 - seconds);
  return (
    <section className="drill-instructions" aria-labelledby="puzzle-prompt">
      {def.source === "session" && <p className="eyebrow">From your games</p>}
      <h2 id="puzzle-prompt">{def.prompt}</h2>
      <ol className="goal-list" aria-label="Goals">
        {progress.steps.map((step, i) => (
          <li
            key={i}
            className={
              i < progress.met ? "goal-done" : i === progress.met ? "goal-current" : undefined
            }
          >
            {goalLabel(step)}
          </li>
        ))}
      </ol>
      <p className="key-help">
        Pieces {pieces} / {def.pieceLimit}
        {timeLeft !== null && <> · {Math.ceil(timeLeft)}s left</>}
      </p>
      {chip && (
        <p className="puzzle-chip" role="status">
          {chip}
        </p>
      )}
      {def.hint && (
        <>
          <button className="button" onClick={onHint} aria-expanded={hintShown}>
            {hintShown ? "Hide hint" : "Show hint"}
          </button>
          {hintShown && <p>{def.hint}</p>}
        </>
      )}
      <p className="key-help">
        {def.allowHold !== false && <>Hold <kbd>{keyLabel(b.hold)}</kbd> · </>}
        Undo <kbd>{keyLabel(b.undo)}</kbd> · Retry <kbd>{keyLabel(b.restart)}</kbd> ·
        Pause <kbd>{keyLabel(b.pause)}</kbd>
      </p>
    </section>
  );
}
