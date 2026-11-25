import { useState } from "react";
import { SettingsDialog } from "./ui/SettingsDialog";
import { createFreeplay } from "./ui/useTrainer";
import { FreeplayScreen } from "./ui/FreeplayScreen";
import type { PlacementReview } from "./core/coach";
import type { Pressure } from "./ui/FreeplayStats";
import { HomeScreen } from "./ui/HomeScreen";
import { ModuleScreen } from "./ui/ModuleScreen";
import { DrillScreen } from "./ui/DrillScreen";
import { LessonScreen } from "./ui/LessonScreen";
import { PuzzleScreen } from "./ui/PuzzleScreen";
import type { Game } from "./core/game";
import { saveSettings } from "./core/settings";
import type { Settings } from "./core/settings";
import { initialSettings } from "./ui/useTrainer";

type View =
  | { kind: "home" }
  | { kind: "freeplay" }
  | { kind: "module"; id: string }
  | { kind: "drill"; id: string }
  | { kind: "puzzle"; id: string }
  | { kind: "lesson"; id: string };

export default function App() {
  const [view, setView] = useState<View>({ kind: "home" });
  const [freeplay, setFreeplay] = useState<Game | null>(null);
  // Kept here so it survives leaving and re-entering freeplay.
  const [reviews, setReviews] = useState<PlacementReview[]>([]);
  const [pressure, setPressure] = useState<Pressure>("off");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const goHome = (nextSettings?: Settings) => {
    if (nextSettings) {
      setSettings(nextSettings);
      freeplay?.configure(nextSettings);
    }
    setView({ kind: "home" });
  };
  const open = (id: string) => setView({ kind: "module", id });
  if (view.kind === "freeplay" && freeplay)
    return (
      <FreeplayScreen
        session={freeplay}
        reviews={reviews}
        onReviews={setReviews}
        pressure={pressure}
        onPressure={setPressure}
        onHome={() => {
          freeplay.pause();
          goHome(freeplay.settings);
        }}
      />
    );
  if (view.kind === "drill")
    return (
      <DrillScreen
        key={view.id}
        id={view.id}
        settings={settings}
        onHome={goHome}
      />
    );
  if (view.kind === "puzzle")
    return (
      <PuzzleScreen
        key={view.id}
        id={view.id}
        settings={settings}
        onHome={goHome}
      />
    );
  if (view.kind === "lesson")
    return (
      <LessonScreen
        key={view.id}
        id={view.id}
        settings={settings}
        onDrill={(id) => setView({ kind: "drill", id })}
        onHome={goHome}
      />
    );
  if (view.kind === "module")
    return (
      <ModuleScreen
        key={view.id}
        id={view.id}
        settings={settings}
        onHome={goHome}
      />
    );
  return (
    <div className="app-shell">
      <HomeScreen
        onFreeplay={() => {
          if (!freeplay) setFreeplay(createFreeplay());
          setView({ kind: "freeplay" });
        }}
        onOpen={open}
        onDrill={(id) => setView({ kind: "drill", id })}
        onPuzzle={(id) => setView({ kind: "puzzle", id })}
        onLesson={(id) => setView({ kind: "lesson", id })}
        onSettings={() => setSettingsOpen(true)}
      />
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          seed={freeplay?.state.seed ?? 0}
          onApply={(next) => {
            setSettings(next);
            freeplay?.configure(next);
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
