import { useEffect, useState } from "react";
import { cells, type Board } from "../core/board";
import type { Continuation, SolverPosition } from "../core/solver/search";
import type { WellMode } from "../core/solver/evaluation";
import { COLORS } from "./BoardCanvas";
import { useSolver } from "./useSolver";

export function SolverPanel({
  position,
  instant,
}: {
  position: SolverPosition;
  instant: boolean;
}) {
  const [mode, setMode] = useState<WellMode>("auto");
  const { result, loading } = useSolver(position, mode, instant);
  const analysis =
    result && "analysis" in result.reply ? result.reply.analysis : null;
  return (
    <aside
      className="solver-panel"
      data-game-input="ignore"
      aria-label="9–0 analysis"
    >
      <div className="solver-heading">
        <h2>Live analysis</h2>
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
      </div>
      <p>
        Protect the well and avoid holes. Flatness and easier inputs break close
        ties.
      </p>
      <p className="solver-status" role="status">
        {!position.active
          ? "Game over — restart to analyze."
          : loading
            ? "Analyzing…"
            : result && "error" in result.reply
              ? result.reply.error
              : analysis
                ? `${result!.side === "left" ? "Left" : "Right"} well · ${analysis.depth}-piece lookahead · ${Math.round(analysis.elapsedMs)} ms${analysis.timedOut ? " · time limit reached" : ""}`
                : ""}
      </p>
      <p className="solver-note">
        Plans update after lock, hold, undo or restart—not while moving. Scores
        are heuristic penalties; lower is better.
      </p>
      {analysis && (
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
            <p>No safe continuation found within the search budget.</p>
          )}
          <p className="solver-note">
            Overlays combine placements in their own turn coordinates. A clear
            shifts the rows; hover, focus or tap a preview to play the exact
            sequence.
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
    : line.moves.map((move, index) => ({ move, index }));
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
        viewBox="0 0 100 230"
        role="img"
        aria-label={
          selected
            ? `Move ${Math.floor(frame / 2) + 1}: ${selected.useHold ? "hold, " : ""}${selected.piece.type}${locked ? `, locked, ${selected.cleared} lines cleared` : " planned placement"}`
            : `${line.moves.length} overlapping planned placements`
        }
      >
        <rect width="100" height="230" fill="#11151a" />
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
                x={move.piece.x * 10 + 5}
                y={(22 - move.piece.y) * 10 + 7}
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
            {m.cleared ? ` (${m.cleared} cleared)` : ""}
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
            : `${selected.path.join(" → ")} → hard drop`}
        </p>
      )}
      <p>
        {line.metrics.holes} holes · {line.metrics.wellBlocks} well blocks
        <br />
        {line.metrics.roughness} roughness · {line.effort} input effort
      </p>
      <small>{line.moves.length} placements searched</small>
    </article>
  );
}
