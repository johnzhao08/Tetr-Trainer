import type { DrillSession } from "./drillSession";
import type { GameState } from "./game";
import type { Action, Settings } from "./settings";

/** What the input loop needs; Game satisfies it directly. */
export interface Controller {
  readonly state: GameState;
  readonly settings: Settings;
  readonly canUndo: boolean;
  readonly elapsedMs: number;
  /** A change here forces a re-render (for example a drill finishing). */
  readonly phase?: string;
  keyDown(action: Action): void;
  keyUp(action: Action): void;
  tick(dt: number): void;
  undo(): void;
  restart(seed: number): void;
  pause(): void;
  resume(): void;
  clearInput(): void;
  configure(settings: Settings): void;
}

/** Adapts a DrillSession; hooks tell the screen when its review data is stale. */
export function drillController(
  session: DrillSession,
  hooks: { onRewind?: () => void; onRestart?: () => void } = {},
): Controller {
  const { game } = session;
  return {
    get state() {
      return game.state;
    },
    get settings() {
      return game.settings;
    },
    get canUndo() {
      return game.canUndo;
    },
    get elapsedMs() {
      return session.elapsedMs;
    },
    get phase() {
      return session.status;
    },
    keyDown: (a) => session.keyDown(a),
    keyUp: (a) => session.keyUp(a),
    tick: (dt) => session.tick(dt),
    undo() {
      if (!game.canUndo) return;
      session.undo();
      hooks.onRewind?.();
    },
    restart(seed) {
      session.restart(seed);
      hooks.onRestart?.();
    },
    pause: () => game.pause(),
    resume: () => game.resume(),
    clearInput: () => game.clearInput(),
    configure: (s) => game.configure(s),
  };
}
