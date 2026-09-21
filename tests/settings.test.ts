import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  defaultSettings,
  loadSettings,
  normalizeSettings,
  rebind,
  saveSettings,
  STORAGE_KEY,
} from "../src/core/settings";
import type { StorageLike } from "../src/core/settings";

function storage(initial: string | null = null): StorageLike {
  let saved = initial;
  return {
    getItem: () => saved,
    setItem: (_key, value) => {
      saved = value;
    },
  };
}

describe("handling settings", () => {
  it("returns isolated defaults and recovers missing, corrupt, and unsupported saved values", () => {
    const defaults = defaultSettings();
    defaults.bindings.left = "KeyQ";
    expect(defaultSettings().bindings.left).toBe("ArrowLeft");
    for (const input of [
      null,
      "",
      "{broken",
      "null",
      "[]",
      "true",
      "42",
      '"settings"',
    ])
      expect(loadSettings(storage(input))).toEqual(defaultSettings());
  });

  it("clamps and rounds finite numbers while replacing invalid values and types", () => {
    const normalized = normalizeSettings({
      das: Infinity,
      arr: 1000,
      dcd: -20,
      softDropSpeed: 0,
      instantSoftDrop: "false",
    });
    expect(normalized).toMatchObject({
      das: 110,
      arr: 100,
      dcd: 0,
      softDropSpeed: 1,
      instantSoftDrop: true,
    });
    expect(
      normalizeSettings({
        das: 23.7,
        arr: NaN,
        dcd: "50",
        softDropSpeed: 201,
        instantSoftDrop: false,
      }),
    ).toMatchObject({
      das: 24,
      arr: 0,
      dcd: 0,
      softDropSpeed: 200,
      instantSoftDrop: false,
    });
  });

  it("preserves a complete valid keymap but rejects partial, duplicate, and unsupported keymaps atomically", () => {
    const settings = rebind(defaultSettings(), "left", "KeyQ");
    expect(normalizeSettings(settings)).toEqual(settings);
    for (const bindings of [
      { left: "KeyQ" },
      { ...settings.bindings, left: settings.bindings.right },
      { ...settings.bindings, left: "F5" },
      { ...settings.bindings, left: null },
    ])
      expect(normalizeSettings({ ...settings, bindings }).bindings).toEqual(
        defaultSettings().bindings,
      );
  });

  it("swaps conflicting bindings without mutation and ignores unsupported keys", () => {
    const before = defaultSettings();
    const swapped = rebind(before, "left", before.bindings.right);
    expect(swapped.bindings.left).toBe("ArrowRight");
    expect(swapped.bindings.right).toBe("ArrowLeft");
    expect(
      new Set(ACTIONS.map((action) => swapped.bindings[action])).size,
    ).toBe(ACTIONS.length);
    expect(before).toEqual(defaultSettings());
    expect(rebind(before, "left", "F5")).toBe(before);
    expect(rebind(before, "flip", "KeyQ").bindings.flip).toBe("KeyQ");
  });

  it("round-trips normalized settings and reports unavailable persistence without throwing", () => {
    const memory = storage();
    const settings = rebind(
      { ...defaultSettings(), das: 125, arr: 20, instantSoftDrop: false },
      "hold",
      "ShiftLeft",
    );
    expect(saveSettings(memory, settings)).toBe(true);
    expect(loadSettings(memory)).toEqual(settings);
    expect(JSON.parse(memory.getItem(STORAGE_KEY)!)).toEqual(settings);
    expect(saveSettings(memory, { ...settings, das: -1 })).toBe(true);
    expect(loadSettings(memory).das).toBe(0);
    const denied = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    };
    expect(loadSettings(denied)).toEqual(defaultSettings());
    expect(saveSettings(denied, settings)).toBe(false);
  });
});

it("adds default Backspace undo to saved controls without losing custom bindings", () => {
  const previous = rebind(defaultSettings(), "hold", "KeyQ");
  const legacy: Record<string, string> = { ...previous.bindings };
  delete legacy.undo;
  const upgraded = normalizeSettings({ ...previous, bindings: legacy });
  expect(upgraded.bindings.hold).toBe("KeyQ");
  expect(upgraded.bindings.undo).toBe("Backspace");
  legacy.hold = "Backspace";
  const conflict = normalizeSettings({ ...previous, bindings: legacy });
  expect(conflict.bindings.hold).toBe("Backspace");
  expect(conflict.bindings.undo).toBe("KeyU");
  expect(new Set(Object.values(conflict.bindings)).size).toBe(ACTIONS.length);
  const saved = storage();
  const rebound = rebind(upgraded, "undo", "KeyV");
  saveSettings(saved, rebound);
  expect(loadSettings(saved).bindings.undo).toBe("KeyV");
});
