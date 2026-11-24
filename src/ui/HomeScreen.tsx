import { LEVELS, modulesAt, type ModuleInfo } from "../core/catalog";
import { cells } from "../core/board";
import { tSpinPreviewFrames } from "../core/tSpinPreview";
import { COLORS } from "./BoardCanvas";
import { MiniBoard } from "./MiniBoard";
import { SettingsButton } from "./SettingsButton";

export function HomeScreen({
  onFreeplay,
  onOpen,
  onSettings,
}: {
  onFreeplay: () => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
}) {
  return (
    <>
      <header className="site-header">
        <h1 className="brand">Tetr Trainer</h1>
        <nav className="header-actions" aria-label="Modes">
          <button className="button" onClick={onFreeplay}>
            Freeplay
          </button>
          <SettingsButton onClick={onSettings} />
        </nav>
      </header>
      <main className="home-layout">
        <section className="home-intro" aria-labelledby="home-title">
          <h2 id="home-title">Learn modern stacking, one skill at a time.</h2>
          <p>
            Pick a level and work through its modules. Every module uses the
            same zero-gravity board and your saved handling, so practice
            carries straight into real games.
          </p>
        </section>
        {LEVELS.map((level) => (
          <section
            key={level.id}
            className="level-section"
            aria-labelledby={`level-${level.id}`}
          >
            <div className="level-heading">
              <h2 id={`level-${level.id}`}>
                <span className={`level-badge level-${level.id}`}>
                  {level.title}
                </span>
              </h2>
              <p>{level.blurb}</p>
            </div>
            <div className="module-grid">
              {modulesAt(level.id).map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  onOpen={() => onOpen(module.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

function ModuleCard({
  module,
  onOpen,
}: {
  module: ModuleInfo;
  onOpen: () => void;
}) {
  const planned = module.status === "planned";
  return (
    <button
      className={`module-card${planned ? " planned" : ""}`}
      onClick={onOpen}
    >
      {module.id === "t-spin-basics" ? (
        <TSpinCardPreview />
      ) : module.preview ? (
        <MiniBoard rows={module.preview} />
      ) : null}
      <strong>{module.title}</strong>
      <span>{module.summary}</span>
      <span className="card-tags">
        {planned && <span className="status-badge">Planned · needs solver</span>}
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
