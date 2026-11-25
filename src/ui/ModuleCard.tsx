import type { ModuleInfo } from "../core/catalog";
import { cells } from "../core/board";
import { tSpinPreviewFrames } from "../core/tSpinPreview";
import { COLORS } from "./BoardCanvas";
import { MiniBoard } from "./MiniBoard";

export function ModuleCard({
  module,
  onOpen,
}: {
  module: ModuleInfo;
  onOpen: () => void;
}) {
  return (
    <button className="module-card" onClick={onOpen}>
      {module.id === "t-spin-basics" ? (
        <TSpinCardPreview />
      ) : module.preview ? (
        <MiniBoard rows={module.preview} />
      ) : null}
      <strong>{module.title}</strong>
      <span>{module.summary}</span>
      {module.note && <span className="card-note">{module.note}</span>}
      <span className="card-tags">
        {module.skills.map((skill) => (
          <span key={skill} className="skill-tag">
            {skill}
          </span>
        ))}
      </span>
    </button>
  );
}

const previewFrames = tSpinPreviewFrames();
function TSpinCardPreview() {
  return (
    <svg className="t-spin-preview" viewBox="0 0 200 100" aria-hidden="true">
      <rect className="preview-well" width="200" height="100" rx="4" />
      {previewFrames.map((frame, index) => (
        <g key={index} className={`preview-frame preview-frame-${index}`}>
          {frame.board
            .slice(0, 5)
            .flatMap((row, y) =>
              row.map(
                (cell, x) =>
                  cell && (
                    <rect
                      key={`${x}-${y}`}
                      x={x * 20 + 1}
                      y={(4 - y) * 20 + 1}
                      width="18"
                      height="18"
                      rx="1"
                      fill={COLORS[cell]}
                    />
                  ),
              ),
            )}
          {frame.active &&
            cells(frame.active).map(([x, y]) => (
              <rect
                key={`${x}-${y}`}
                x={x * 20 + 1}
                y={(4 - y) * 20 + 1}
                width="18"
                height="18"
                rx="1"
                fill={COLORS.T}
              />
            ))}
        </g>
      ))}
      <path className="preview-floor" d="M0 99.5h200" />
    </svg>
  );
}
