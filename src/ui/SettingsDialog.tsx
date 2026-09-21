import { useEffect, useRef, useState } from "react";
import {
  ACTIONS,
  defaultSettings,
  isBindable,
  keyLabel,
  LABELS,
  LIMITS,
  normalizeSettings,
  rebind,
  type Action,
  type Settings,
} from "../core/settings";

type NumericSetting = keyof typeof LIMITS;
const FIELDS: {
  key: NumericSetting;
  title: string;
  description: string;
  unit: string;
}[] = [
  {
    key: "das",
    title: "DAS",
    description: "Delay before held movement repeats.",
    unit: "ms",
  },
  {
    key: "arr",
    title: "ARR",
    description: "Repeat interval. Zero moves straight to the wall.",
    unit: "ms",
  },
  {
    key: "dcd",
    title: "DCD",
    description: "After wall contact, delay movement on rotation or spawn.",
    unit: "ms",
  },
  {
    key: "softDropSpeed",
    title: "Soft drop speed",
    description: "Downward speed with instant soft drop off.",
    unit: "cells/s",
  },
];
const numberText = (settings: Settings) =>
  Object.fromEntries(
    FIELDS.map(({ key }) => [key, String(settings[key])]),
  ) as Record<NumericSetting, string>;

export function SettingsDialog({
  settings,
  onApply,
  onClose,
}: {
  settings: Settings;
  onApply: (settings: Settings) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Settings>(() =>
    normalizeSettings(settings),
  );
  const [values, setValues] = useState(() => numberText(settings));
  const [capture, setCapture] = useState<Action | null>(null);
  const [conflict, setConflict] = useState<{
    action: Action;
    code: string;
    existing: Action;
  } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (!capture) return;
    const handleKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (event.code === "Escape") {
        setCapture(null);
        setMessage("Binding unchanged.");
        return;
      }
      if (!isBindable(event.code)) {
        setMessage(
          "That key is unavailable. Try a letter, arrow, number, or modifier key.",
        );
        return;
      }
      const existing = ACTIONS.find(
        (action) => action !== capture && draft.bindings[action] === event.code,
      );
      setCapture(null);
      if (existing) {
        setConflict({ action: capture, code: event.code, existing });
        setMessage("");
      } else {
        setDraft(rebind(draft, capture, event.code));
        setMessage(`${LABELS[capture]} assigned to ${keyLabel(event.code)}.`);
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [capture, draft]);

  const restore = () => {
    const defaults = defaultSettings();
    setDraft(defaults);
    setValues(numberText(defaults));
    setCapture(null);
    setConflict(null);
    setMessage("Defaults restored. Apply settings to save.");
  };

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog"
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (capture || conflict) return;
          const numbers = Object.fromEntries(
            FIELDS.map(({ key }) => [
              key,
              values[key].trim() ? Number(values[key]) : draft[key],
            ]),
          );
          onApply(normalizeSettings({ ...draft, ...numbers }));
        }}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">YOUR SETUP</span>
            <h2 id="settings-title">Make it feel like you.</h2>
            <p>Controls and handling are saved on this device.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="settings-grid">
          <section aria-labelledby="handling-title">
            <h3 id="handling-title">Handling</h3>
            {FIELDS.map(({ key, title, description, unit }) => (
              <div className="setting-row" key={key}>
                <label htmlFor={`setting-${key}`}>
                  <strong>{title}</strong>
                  <span id={`description-${key}`}>{description}</span>
                </label>
                <div className="number-control">
                  <input
                    id={`setting-${key}`}
                    type="number"
                    inputMode="numeric"
                    required
                    min={LIMITS[key][0]}
                    max={LIMITS[key][1]}
                    step={1}
                    value={values[key]}
                    disabled={key === "softDropSpeed" && draft.instantSoftDrop}
                    aria-describedby={`description-${key} unit-${key}`}
                    onChange={(event) =>
                      setValues({ ...values, [key]: event.currentTarget.value })
                    }
                  />
                  <span id={`unit-${key}`}>{unit}</span>
                </div>
              </div>
            ))}
            <label className="checkbox-row" htmlFor="instant-soft-drop">
              <input
                id="instant-soft-drop"
                type="checkbox"
                checked={draft.instantSoftDrop}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    instantSoftDrop: event.currentTarget.checked,
                  })
                }
              />
              <span>
                <strong>Instant soft drop</strong>
                <span>Land immediately, without locking.</span>
              </span>
            </label>
            <p className="settings-note">
              Zero gravity. Hard drop is the only action that locks a piece.
            </p>
          </section>
          <section aria-labelledby="bindings-title">
            <h3 id="bindings-title">Controls</h3>
            <p className="settings-note">
              Select a binding, then press a key. Escape cancels capture.
            </p>
            {ACTIONS.map((action) => (
              <div className="binding-row" key={action}>
                <span>{LABELS[action]}</span>
                <button
                  type="button"
                  className={`binding-button${capture === action ? " capturing" : ""}`}
                  aria-label={`Rebind ${LABELS[action]}, currently ${keyLabel(draft.bindings[action])}`}
                  aria-pressed={capture === action}
                  disabled={Boolean(conflict)}
                  onClick={() => {
                    setCapture(action);
                    setMessage(
                      `Press a key for ${LABELS[action]}. Escape cancels.`,
                    );
                  }}
                >
                  {capture === action
                    ? "Press a key…"
                    : keyLabel(draft.bindings[action])}
                </button>
              </div>
            ))}
          </section>
        </div>
        {conflict && (
          <div className="binding-conflict" role="alert">
            <p>
              <strong>{keyLabel(conflict.code)}</strong> is assigned to{" "}
              <strong>{LABELS[conflict.existing]}</strong>. Swap bindings?
            </p>
            <p>
              {LABELS[conflict.action]} will use {keyLabel(conflict.code)};{" "}
              {LABELS[conflict.existing]} will use{" "}
              {keyLabel(draft.bindings[conflict.action])}.
            </p>
            <div className="button-row">
              <button
                type="button"
                onClick={() => {
                  setDraft(rebind(draft, conflict.action, conflict.code));
                  setConflict(null);
                  setMessage("Bindings swapped.");
                }}
              >
                Swap bindings
              </button>
              <button
                type="button"
                onClick={() => {
                  setConflict(null);
                  setMessage("Binding unchanged.");
                }}
              >
                Cancel swap
              </button>
            </div>
          </div>
        )}
        <p className="settings-status" role="status">
          {message || "\u00a0"}
        </p>
        <footer className="dialog-footer">
          <button type="button" className="text-button" onClick={restore}>
            Restore defaults
          </button>
          <div className="button-row">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={Boolean(capture || conflict)}
            >
              Apply settings
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
