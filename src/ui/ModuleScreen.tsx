import type { ReactElement } from "react";
import type { Settings } from "../core/settings";
import { FinesseScreen } from "./FinesseScreen";
import { OPENERS } from "../core/openers";
import { SCENARIO_MODULES } from "../core/scenarios";
import { OpenerScreen } from "./OpenerScreen";
import { ScenarioScreen } from "./ScenarioScreen";
import { TSpinDrillScreen } from "./TSpinDrillScreen";

export type ModuleScreenProps = {
  settings: Settings;
  onHome: (settings?: Settings) => void;
  /** A due review item to start right away (opener modules). */
  item?: string;
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
  ...Object.fromEntries(
    OPENERS.map((o) => [
      o.id,
      (props: ModuleScreenProps) => <OpenerScreen id={o.id} initialItem={props.item} {...props} />,
    ]),
  ),
};

export function ModuleScreen({
  id,
  settings,
  onHome,
  item,
}: ModuleScreenProps & { id: string }) {
  return READY_SCREENS[id]?.({ settings, onHome, item }) ?? null;
}
