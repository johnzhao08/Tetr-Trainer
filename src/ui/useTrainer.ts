import { frameChanged, frameView } from "../core/frameView";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Controller } from "../core/controller";
import { Game } from "../core/game";
import {
  ACTIONS,
  defaultSettings,
  loadSettings,
  saveSettings,
} from "../core/settings";
import type { Settings } from "../core/settings";
import { Metronome } from "./metronome";
function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
export function initialSettings() {
  try {
    return loadSettings(localStorage);
  } catch {
    return defaultSettings();
  }
}
export function createFreeplay() {
  return new Game(newSeed(), initialSettings());
}
export function useTrainer(
  session?: Controller,
  /** Metronome pace that overrides the saved one, such as a drill's pacer. */
  options: { pps?: number } = {},
) {
  const [game] = useState<Controller>(() => session ?? createFreeplay());
  const [state, setState] = useState(() => ({
    ...game.state,
    canUndo: game.canUndo,
    elapsedMs: game.elapsedMs,
    queue: [...game.state.queue],
  }));
  const [settings, setSettings] = useState(game.settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(
    () =>
      setState({
        ...game.state,
        canUndo: game.canUndo,
        elapsedMs: game.elapsedMs,
        queue: [...game.state.queue],
      }),
    [game],
  );
  const restart = useCallback(() => {
    game.restart(newSeed());
    refresh();
  }, [game, refresh]);
  const undo = useCallback(() => {
    game.undo();
    refresh();
  }, [game, refresh]);
  const togglePause = useCallback(() => {
    if (game.state.status === "paused") game.resume();
    else game.pause();
    refresh();
  }, [game, refresh]);
  const openSettings = useCallback(() => {
    game.pause();
    refresh();
    setSettingsOpen(true);
  }, [game, refresh]);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    game.clearInput();
    refresh();
  }, [game, refresh]);
  const applySettings = useCallback(
    (next: Settings) => {
      game.configure(next);
      setSettings(game.settings);
      let saved = false;
      try {
        saved = saveSettings(localStorage, game.settings);
      } catch {
        /* Storage may be disabled. */
      }
      setNotice(
        saved
          ? "Settings saved."
          : "Settings applied for this session. Browser storage is unavailable.",
      );
      setSettingsOpen(false);
      refresh();
    },
    [game, refresh],
  );
  const toggleMetronome = useCallback(() => {
    const next = {
      ...game.settings,
      metronome: {
        ...game.settings.metronome,
        enabled: !game.settings.metronome.enabled,
      },
    };
    game.configure(next);
    setSettings(game.settings);
    try {
      saveSettings(localStorage, game.settings);
    } catch {
      /* Storage may be disabled; the toggle still applies this session. */
    }
  }, [game]);
  // The click runs only while the piece clock does: pause, game over, a
  // finished drill and a hidden tab (which pauses) all silence it.
  const { enabled, volume, accent } = settings.metronome;
  const pace = options.pps ?? settings.metronome.pps;
  const ticking =
    enabled &&
    state.status === "playing" &&
    (game.phase === undefined || game.phase === "playing");
  const metronome = useRef<Metronome | null>(null);
  useEffect(() => {
    if (!ticking) {
      metronome.current?.stop();
      return;
    }
    metronome.current ??= new Metronome();
    metronome.current.start({ pps: pace, volume, accent });
  }, [ticking, pace, volume, accent]);
  useEffect(
    () => () => {
      metronome.current?.dispose();
      metronome.current = null;
    },
    [],
  );
  useEffect(() => {
    let previous = performance.now();
    let frame = 0;
    const pressed = new Set<string>();
    const advance = (now: number) => {
      const before = frameView(game);
      // Timing is advanced at both input events and render callbacks; input cannot move backwards in time.
      game.tick(Math.max(0, now - previous));
      previous = Math.max(previous, now);
      if (frameChanged(before, frameView(game))) refresh();
    };
    const tick = (now: number) => {
      advance(now);
      frame = requestAnimationFrame(tick);
    };
    const keydown = (event: KeyboardEvent) => {
      if (settingsOpen || event.isComposing || event.metaKey) return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          "input,select,textarea,button,[contenteditable=true]",
        )
      )
        return;
      const action = ACTIONS.find(
        (a) => game.settings.bindings[a] === event.code,
      );
      if (!action) return;
      event.preventDefault();
      if (event.repeat || pressed.has(event.code)) return;
      pressed.add(event.code);
      advance(performance.now());
      if (action === "restart") restart();
      else if (action === "pause") togglePause();
      else if (action === "undo") undo();
      else {
        game.keyDown(action);
        refresh();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      pressed.delete(event.code);
      const action = ACTIONS.find(
        (a) => game.settings.bindings[a] === event.code,
      );
      if (action) {
        advance(performance.now());
        game.keyUp(action);
        refresh();
      }
    };
    const blur = () => {
      game.pause();
      pressed.clear();
      previous = performance.now();
      refresh();
    };
    const visibility = () => {
      if (document.hidden) blur();
      else previous = performance.now();
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      game.clearInput();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [game, refresh, restart, settingsOpen, togglePause, undo]);
  return {
    state,
    settings,
    settingsOpen,
    notice,
    refresh,
    restart,
    undo,
    togglePause,
    openSettings,
    closeSettings,
    applySettings,
    toggleMetronome,
  };
}
