import type { ReactElement } from "react";
import type { Settings } from "../core/settings";
import { FinesseScreen } from "./FinesseScreen";
import { SCENARIO_MODULES } from "../core/scenarios";
import { ScenarioScreen } from "./ScenarioScreen";
import { TSpinDrillScreen } from "./TSpinDrillScreen";

export type ModuleScreenProps = {
  settings: Settings;
  onHome: (settings?: Settings) => void;
};

// Playable screens by catalog id. Every catalog entry must have one.
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
}: ModuleScreenProps & { id: string }) {
  return READY_SCREENS[id]?.({ settings, onHome }) ?? null;
}
