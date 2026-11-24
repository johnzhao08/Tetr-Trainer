import type { ReactNode } from "react";
import { SettingsButton } from "./SettingsButton";

// One header for freeplay and every module. SettingsButton is always the
// rightmost control (see AGENTS.md); screens only change what it does.
export function ModuleHeader({
  title,
  onHome,
  onSettings,
  children,
}: {
  title: string;
  onHome: () => void;
  onSettings: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="site-header">
      <div className="header-navigation">
        <button className="button quiet" onClick={onHome}>
          Home
        </button>
        <h1 className="brand">{title}</h1>
      </div>
      <nav className="header-actions" aria-label="Screen actions">
        {children}
        <SettingsButton onClick={onSettings} />
      </nav>
    </header>
  );
}
