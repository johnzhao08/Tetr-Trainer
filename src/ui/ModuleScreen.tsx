import type { ReactElement } from "react";
import { findModule } from "../core/catalog";
import type { Settings } from "../core/settings";
import { FinesseScreen } from "./FinesseScreen";
import { SCENARIO_MODULES } from "../core/scenarios";
import { ScenarioScreen } from "./ScenarioScreen";
import { PlannedModuleScreen } from "./PlannedModuleScreen";
import { TSpinDrillScreen } from "./TSpinDrillScreen";

export type ModuleScreenProps = {
  settings: Settings;
  onHome: (settings?: Settings) => void;
};

// Playable screens by catalog id. A catalog entry marked "ready" must have one.
export const READY_SCREENS: Record<
  string,
  (props: ModuleScreenProps) => ReactElement
> = {
  "t-spin-basics": (props) => <TSpinDrillScreen {...props} />,
  "finesse-fundamentals": (props) => (
    <FinesseScreen
      title="Finesse fundamentals"
      mode={{ length: 20, hints: true }}
      {...props}
    />
  ),
  "finesse-test": (props) => (
    <FinesseScreen
      title="Finesse test"
      mode={{ length: 40, hints: false }}
      {...props}
    />
  ),
  ...Object.fromEntries(
    Object.entries(SCENARIO_MODULES).map(([id, module]) => [
      id,
      (props: ModuleScreenProps) => <ScenarioScreen module={module} {...props} />,
    ]),
  ),
};

export function ModuleScreen({
  id,
  settings,
  onHome,
  onOpen,
}: ModuleScreenProps & { id: string; onOpen: (id: string) => void }) {
  const module = findModule(id);
  if (!module) return null;
  if (module.status === "planned")
    return (
      <PlannedModuleScreen
        module={module}
        settings={settings}
        onHome={onHome}
        onOpen={onOpen}
      />
    );
  return READY_SCREENS[id]?.({ settings, onHome }) ?? null;
}
