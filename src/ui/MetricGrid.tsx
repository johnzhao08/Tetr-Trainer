import { useId, useState } from "react";
import { explainTerm } from "../core/glossary";
import type { GlossaryId } from "../core/glossary";

export type MetricItem = { id: GlossaryId; label: string; value: string };

// Stat tiles where each label has a "?" button. One explanation shows at a
// time below the tiles, so the small tiles stay compact.
export function MetricGrid({
  items,
  className = "",
  onToggle,
}: {
  items: readonly MetricItem[];
  className?: string;
  /** Called after a mouse toggle, e.g. to give focus back to a game board.
   * Keyboard toggles keep focus on the button. */
  onToggle?: () => void;
}) {
  const [open, setOpen] = useState<GlossaryId | null>(null);
  const panel = useId();
  const shown = items.find((i) => i.id === open);
  return (
    <>
      <dl className={`hud-stats ${className}`}>
        {items.map((item) => (
          <div key={item.id}>
            <dt>
              {item.label}
              <button
                type="button"
                className="info-button"
                aria-label={`What is ${item.label}?`}
                aria-expanded={open === item.id}
                aria-controls={panel}
                onClick={(e) => {
                  setOpen(open === item.id ? null : item.id);
                  // detail is 0 for keyboard activation.
                  if (e.detail > 0) onToggle?.();
                }}
              >
                ?
              </button>
            </dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <p id={panel} className="metric-explain" aria-live="polite">
        {shown && (
          <>
            <strong>{shown.label}.</strong> {explainTerm(shown.id)}
          </>
        )}
      </p>
    </>
  );
}
