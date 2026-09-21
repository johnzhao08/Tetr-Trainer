export const ACTIONS = [
  "left",
  "right",
  "cw",
  "ccw",
  "flip",
  "softDrop",
  "hardDrop",
  "hold",
  "restart",
  "undo",
  "pause",
] as const;
export type Action = (typeof ACTIONS)[number];
export type Settings = {
  das: number;
  arr: number;
  dcd: number;
  softDropSpeed: number;
  instantSoftDrop: boolean;
  bindings: Record<Action, string>;
};
export const LABELS: Record<Action, string> = {
  left: "Move left",
  right: "Move right",
  cw: "Rotate clockwise",
  ccw: "Rotate counterclockwise",
  flip: "Rotate 180°",
  softDrop: "Soft drop",
  hardDrop: "Hard drop",
  hold: "Hold",
  restart: "Restart",
  undo: "Undo",
  pause: "Pause / resume",
};
export const DEFAULTS: Settings = {
  das: 110,
  arr: 0,
  dcd: 0,
  softDropSpeed: 40,
  instantSoftDrop: true,
  bindings: {
    left: "ArrowLeft",
    right: "ArrowRight",
    cw: "ArrowUp",
    ccw: "KeyZ",
    flip: "KeyA",
    softDrop: "ArrowDown",
    hardDrop: "Space",
    hold: "KeyC",
    restart: "KeyR",
    undo: "Backspace",
    pause: "Escape",
  },
};
export const LIMITS = {
  das: [0, 500],
  arr: [0, 100],
  dcd: [0, 200],
  softDropSpeed: [1, 200],
} as const;
export function defaultSettings(): Settings {
  return { ...DEFAULTS, bindings: { ...DEFAULTS.bindings } };
}
export function isBindable(code: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Escape|Enter|Backspace|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Tab|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|Minus|Equal|Backquote|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter))$/.test(
    code,
  );
}
export function normalizeSettings(value: unknown): Settings {
  const result = defaultSettings();
  if (!value || typeof value !== "object") return result;
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const n = source[key];
    if (typeof n === "number" && Number.isFinite(n))
      result[key] = Math.min(
        LIMITS[key][1],
        Math.max(LIMITS[key][0], Math.round(n)),
      );
  }
  if (typeof source.instantSoftDrop === "boolean")
    result.instantSoftDrop = source.instantSoftDrop;
  if (source.bindings && typeof source.bindings === "object") {
    const bindings = { ...(source.bindings as Record<string, unknown>) };
    // Upgrade saved controls without overwriting an existing Backspace assignment.
    if (!Object.hasOwn(bindings, "undo")) {
      bindings.undo = [
        "Backspace",
        "KeyU",
        ...Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (letter) => `Key${letter}`),
      ].find((code) => !Object.values(bindings).includes(code));
    }
    // Saved keymaps are atomic: corrupt/duplicate bindings must never strand an action.
    const codes = ACTIONS.map((action) => bindings[action]);
    if (
      codes.every((code) => typeof code === "string" && isBindable(code)) &&
      new Set(codes).size === ACTIONS.length
    )
      result.bindings = Object.fromEntries(
        ACTIONS.map((action, i) => [action, codes[i]]),
      ) as Record<Action, string>;
  }
  return result;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const STORAGE_KEY = "tetr-trainer.settings.v1";
export function loadSettings(storage: StorageLike): Settings {
  try {
    return normalizeSettings(
      JSON.parse(storage.getItem(STORAGE_KEY) ?? "null"),
    );
  } catch {
    return defaultSettings();
  }
}
export function saveSettings(
  storage: StorageLike,
  settings: Settings,
): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
export function keyLabel(code: string): string {
  const labels: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    Space: "Space",
    Escape: "Esc",
    Backspace: "⌫",
    ShiftLeft: "L Shift",
    ShiftRight: "R Shift",
    ControlLeft: "L Ctrl",
    ControlRight: "R Ctrl",
    AltLeft: "L Alt",
    AltRight: "R Alt",
  };
  return labels[code] ?? code.replace(/^Key|^Digit/, "");
}
// Reassignment swaps the two actions so neither loses its binding.
export function rebind(
  settings: Settings,
  action: Action,
  code: string,
): Settings {
  if (!isBindable(code)) return settings;
  const bindings = { ...settings.bindings };
  const conflict = ACTIONS.find((a) => a !== action && bindings[a] === code);
  if (conflict) bindings[conflict] = bindings[action];
  bindings[action] = code;
  return { ...settings, bindings };
}
