import { useState } from "react";
import { SettingsDialog } from "./ui/SettingsDialog";
import { createFreeplay } from "./ui/useTrainer";
import { FreeplayScreen } from "./ui/FreeplayScreen";
import type { PlacementReview } from "./core/coach";
import type { Pressure } from "./ui/FreeplayStats";
import { HandlingWizard } from "./ui/HandlingWizard";
import { HomeScreen } from "./ui/HomeScreen";
import { ModuleScreen } from "./ui/ModuleScreen";
import { DecisionScreen } from "./ui/DecisionScreen";
import { DrillScreen } from "./ui/DrillScreen";
import { LessonScreen } from "./ui/LessonScreen";
import { PuzzleScreen } from "./ui/PuzzleScreen";
import type { Game } from "./core/game";
import { parseItem } from "./core/openerReview";
import { saveSettings } from "./core/settings";
import type { Settings } from "./core/settings";
import { initialSettings } from "./ui/useTrainer";

type View =
  | { kind: "home" }
  | { kind: "freeplay" }
  | { kind: "handling" }
  | { kind: "decision" }
  | { kind: "module"; id: string; item?: string }
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
  // Screens hand back the settings they ended with; adopt them before leaving.
  const adopt = (next?: Settings) => {
    if (!next) return;
    setSettings(next);
    freeplay?.configure(next);
  };
  const goHome = (next?: Settings) => {
    adopt(next);
    setView({ kind: "home" });
  };
  const open = (id: string) => setView({ kind: "module", id });
  const applySettings = (next: Settings) => {
    setSettings(next);
    freeplay?.configure(next);
    try {
      saveSettings(localStorage, next);
    } catch {
      // Settings remain active for this app session.
    }
  };
  if (view.kind === "handling")
    return (
      <HandlingWizard
        settings={settings}
        onApply={(next) => {
          applySettings(next);
          setView({ kind: "home" });
        }}
        onHome={goHome}
      />
    );
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
  if (view.kind === "decision")
    return <DecisionScreen settings={settings} onHome={goHome} />;
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
        onDrill={(id, next) => {
          adopt(next);
          setView({ kind: "drill", id });
        }}
        onHome={goHome}
      />
    );
  if (view.kind === "module")
    return (
      <ModuleScreen
        key={view.id}
        id={view.id}
        item={view.item}
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
        instantSoftDrop={settings.instantSoftDrop}
        onReviewOpener={(item) => {
          const parsed = parseItem(item, settings.instantSoftDrop);
          if (parsed) setView({ kind: "module", id: parsed.opener, item });
        }}
        onHandling={() => setView({ kind: "handling" })}
        onDecision={() => setView({ kind: "decision" })}
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
            applySettings(next);
            setSettingsOpen(false);
          }}
          onHandling={() => {
            setSettingsOpen(false);
            setView({ kind: "handling" });
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
