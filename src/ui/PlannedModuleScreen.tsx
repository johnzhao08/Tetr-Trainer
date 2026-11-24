import { useState } from "react";
import { findModule, type ModuleInfo } from "../core/catalog";
import { saveSettings, type Settings } from "../core/settings";
import { ModuleHeader } from "./ModuleHeader";
import { SettingsDialog } from "./SettingsDialog";

type Planned = Extract<ModuleInfo, { status: "planned" }>;

// A placeholder for modules that need a solver. It explains what the module
// will do so the catalog shows the full curriculum before the engine exists.
export function PlannedModuleScreen({
  module,
  settings,
  onHome,
  onOpen,
}: {
  module: Planned;
  settings: Settings;
  onHome: (settings?: Settings) => void;
  onOpen: (id: string) => void;
}) {
  const [current, setCurrent] = useState(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="app-shell">
      <ModuleHeader
        title={module.title}
        onHome={() => onHome(current)}
        onSettings={() => setSettingsOpen(true)}
      />
      <main className="planned-layout">
        <p className="planned-tag">
          <span className={`level-badge level-${module.level}`}>
            {module.level}
          </span>
          <span className="status-badge">Planned · needs solver</span>
        </p>
        <h2>{module.summary}</h2>
        <section aria-labelledby="planned-what">
          <h3 id="planned-what">What this module will do</h3>
          <ul>
            {module.willDo.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="planned-needs">
          <h3 id="planned-needs">Why it is not playable yet</h3>
          <p>
            It depends on <strong>{module.needs.toLowerCase()}</strong>, which
            the trainer does not include yet. The board rules it will use are
            already in place.
          </p>
        </section>
        {module.research && (
          <section aria-labelledby="planned-research">
            <h3 id="planned-research">Groundwork so far</h3>
            <ul>
              {module.research.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )}
        <section aria-labelledby="planned-practise">
          <h3 id="planned-practise">Practise the skill now</h3>
          <div className="planned-links">
            {module.practiseWith.map((id) => {
              const target = findModule(id);
              return target ? (
                <button
                  key={id}
                  className="button"
                  onClick={() => onOpen(id)}
                >
                  {target.title}
                </button>
              ) : null;
            })}
          </div>
        </section>
      </main>
      {settingsOpen && (
        <SettingsDialog
          settings={current}
          seed={0}
          onApply={(next) => {
            setCurrent(next);
            try {
              saveSettings(localStorage, next);
            } catch {
              // Settings remain active for this app session.
            }
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
