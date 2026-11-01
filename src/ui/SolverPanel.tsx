import { useEffect, useState } from "react";
import { cells, type Board } from "../core/board";
import type {
  Continuation,
  SolverPosition,
  SolverMode,
} from "../core/solver/search";
import type { WellMode } from "../core/solver/evaluation";
import type { Move } from "../core/solver/placements";
import { overlayPlacements } from "./solverOverlay";
import { COLORS } from "./BoardCanvas";
import { useSolver } from "./useSolver";

function inputLabel(action: Move): string {
  const labels: Partial<Record<Move, string>> = {
    left: "tap left",
    right: "tap right",
    wallLeft: "DAS left",
    wallRight: "DAS right",
    down: "soft drop 1 row",
    drop: "soft drop to rest",
    cw: "rotate CW",
    ccw: "rotate CCW",
    flip: "rotate 180°",
  };
  return labels[action] ?? `soft drop ${action.slice(5)} rows`;
}

export function SolverPanel({
  position,
  instant,
  solverMode = "nine-zero",
}: {
  position: SolverPosition;
  instant: boolean;
  solverMode?: SolverMode;
}) {
  const [mode, setMode] = useState<WellMode>("auto");
  const { result, loading } = useSolver(position, mode, instant, solverMode);
  const analysis =
    result && "analysis" in result.reply ? result.reply.analysis : null;
  return (
    <aside
      className="solver-panel"
      data-game-input="ignore"
      aria-label={solverMode === "lst" ? "LST analysis" : "9–0 analysis"}
    >
      <div className="solver-heading">
        <h2>Live analysis</h2>
        {solverMode !== "lst" && (
          <label>
            Well{" "}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as WellMode)}
            >
              <option value="auto">Auto</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
        )}
      </div>
      <p>
        {solverMode === "lst"
          ? "Flat-top TKI → second TSD → LST. Keep the central well open; build the overhang and support before spinning."
          : "Protect the well, avoid holes, and keep the stack level. Easier inputs break close ties."}
      </p>
      <p className="solver-status" role="status">
        {!position.active
          ? "Game over — restart to analyze."
          : loading
            ? "Analyzing the visible queue…"
            : result && "error" in result.reply
              ? result.reply.error
              : analysis
                ? !analysis.complete
                  ? `Search incomplete (${analysis.depth} pieces completed). No suggestions shown.`
                  : `${solverMode === "lst" ? "LST" : result!.side === "left" ? "Left well" : "Right well"} · ${analysis.depth}-piece lookahead · ${Math.round(analysis.elapsedMs)} ms${analysis.timedOut ? " · time limit reached" : ""}`
                : ""}
      </p>
      <p className="solver-note">
        Plans update after lock, hold, undo or restart—not while moving. Scores
        are heuristic penalties; lower is better.
      </p>
      {solverMode === "lst" && (
        <p>
          {position.tsds ?? 0} full TSDs ·{" "}
          {(position.tsds ?? 0) === 0
            ? "Flat-top opening"
            : position.tsds === 1
              ? "Second TSD"
              : "LST continuation"}
          <br />
          <small>
            First bag preset; later bags random. Use soft drop before the final
            rotation. Suggestions are heuristic; some queues require a different
            continuation.
          </small>
        </p>
      )}
      {analysis?.complete && (
        <>
          <div className="solver-lines">
            {analysis.lines.map((line, i) => (
              <ContinuationPreview
                key={`${result!.reply.id}-${i}`}
                line={line}
                rank={i + 1}
              />
            ))}
          </div>
          {!analysis.lines.length && (
            <p>
              {solverMode === "lst"
                ? "No pattern-preserving LST continuation found within the search budget. Try undo or restart."
                : "No safe continuation found within the search budget."}
            </p>
          )}
          <p className="solver-note">
            Overlays lift later placements by the rows already cleared. Hover,
            focus or tap a preview to play the exact sequence.
          </p>
        </>
      )}
    </aside>
  );
}

function Blocks({ board }: { board: Board }) {
  return (
    <>
      {board
        .slice(0, 23)
        .flatMap((row, y) =>
          row.map(
            (cell, x) =>
              cell && (
                <rect
                  key={`${x}-${y}`}
                  x={x * 10 + 0.4}
                  y={(22 - y) * 10 + 0.4}
                  width="9.2"
                  height="9.2"
                  fill={COLORS[cell]}
                />
              ),
          ),
        )}
    </>
  );
}
function ContinuationPreview({
  line,
  rank,
}: {
  line: Continuation;
  rank: number;
}) {
  const [frame, setFrame] = useState(-1),
    [playing, setPlaying] = useState(false);
  const last = line.moves.length * 2 - 1,
    isPlaying = playing && frame < last;
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => setFrame((f) => f + 1), 650);
    return () => window.clearTimeout(timer);
  }, [isPlaying, frame]);
  const selected = frame < 0 ? null : line.moves[Math.floor(frame / 2)];
  const locked = frame >= 0 && frame % 2 === 1;
  const board = selected
    ? locked
      ? selected.after
      : selected.before
    : line.moves[0].before;
  const ghosts = selected
    ? locked
      ? []
      : [{ move: selected, index: Math.floor(frame / 2) }]
    : overlayPlacements(line.moves).map((piece, index) => ({
        move: { ...line.moves[index], piece },
        index,
      }));
  const topRow = Math.max(
    22,
    ...ghosts.flatMap(({ move }) => cells(move.piece).map(([, y]) => y)),
  );
  return (
    <article
      className="solver-line"
      tabIndex={0}
      aria-label={`Suggestion ${rank}`}
    >
      <header>
        <strong>#{rank}</strong>
        <span>Penalty {Math.round(line.cost)}</span>
      </header>
      <svg
        viewBox={`0 ${(22 - topRow) * 10} 100 ${(topRow + 1) * 10}`}
        role="img"
        aria-label={
          selected
            ? `Move ${Math.floor(frame / 2) + 1}: ${selected.useHold ? "hold, " : ""}${selected.piece.type}${locked ? `, locked, ${selected.cleared} lines cleared` : " planned placement"}`
            : `${line.moves.length} overlapping planned placements`
        }
      >
        <rect
          y={(22 - topRow) * 10}
          width="100"
          height={(topRow + 1) * 10}
          fill="#11151a"
        />
        <Blocks board={board} />
        {ghosts.map(({ move, index }) => (
          <g key={index}>
            {cells(move.piece).map(([x, y]) => (
              <rect
                key={`${x}-${y}`}
                x={x * 10 + 0.4}
                y={(22 - y) * 10 + 0.4}
                width="9.2"
                height="9.2"
                fill={COLORS[move.piece.type]}
                fillOpacity=".38"
                stroke={COLORS[move.piece.type]}
                strokeWidth=".6"
              />
            ))}
            {!selected && (
              <text
                x={
                  (cells(move.piece).reduce((sum, [x]) => sum + x, 0) / 4) *
                    10 +
                  5
                }
                y={
                  (22 -
                    cells(move.piece).reduce((sum, [, y]) => sum + y, 0) / 4) *
                    10 +
                  7
                }
                textAnchor="middle"
                fill="white"
                fontSize="6"
              >
                {index + 1}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="preview-controls">
        <button
          type="button"
          onClick={() => {
            if (frame < 0 || frame >= last) setFrame(0);
            setPlaying(!isPlaying);
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          disabled={frame <= 0}
          aria-label="Previous playback step"
          onClick={() => {
            setPlaying(false);
            setFrame((f) => Math.max(0, f - 1));
          }}
        >
          ←
        </button>
        <button
          type="button"
          disabled={frame >= last}
          aria-label="Next playback step"
          onClick={() => {
            setPlaying(false);
            setFrame((f) => f + 1);
          }}
        >
          →
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setFrame(-1);
          }}
        >
          Overlay
        </button>
      </div>
      <p className="solver-sequence">
        {line.moves.map((m, i) => (
          <span key={i} style={{ color: COLORS[m.piece.type] }}>
            {m.useHold ? "H→" : ""}
            {m.piece.type}
            {m.cleared
              ? ` (${m.spin === "full" ? "T-spin " : m.spin === "mini" ? "Mini " : ""}${m.cleared} cleared)`
              : ""}
            {i < line.moves.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
      {selected && (
        <p>
          {Math.floor(frame / 2) + 1}/{line.moves.length}:{" "}
          {selected.useHold ? "Hold; " : ""}
          {locked
            ? `lock, ${selected.cleared} cleared`
            : `${selected.path.slice(0, -1).map(inputLabel).join(" → ")}${selected.path.length > 1 ? " → " : ""}hard drop`}
        </p>
      )}
      <p>
        {line.metrics.holes} holes · {line.metrics.wellBlocks} well blocks
        <br />
        {line.metrics.roughness} roughness · {line.effort} minimum inputs
      </p>
      <small>{line.moves.length} placements searched</small>
    </article>
  );
}
