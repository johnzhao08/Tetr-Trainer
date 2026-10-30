import {
  collides,
  emptyBoard,
  classifyTSpin,
  KICKS,
  lock,
  move,
  project,
  rotate,
  spawn,
  TYPES,
} from "./board";
import type { Board, Piece, Tetromino } from "./board";
import { defaultSettings, normalizeSettings } from "./settings";
import type { Action, Settings } from "./settings";
export type GameState = {
  board: Board;
  active: Piece | null;
  queue: Tetromino[];
  hold: Tetromino | null;
  canHold: boolean;
  status: "playing" | "paused" | "over";
  seed: number;
  pieces: number;
  fullTSpins: number;
  lines: number;
  lastClear: number;
  allClearId: number | null;
  combo: number;
  b2b: number;
  lastEvent: {
    id: number;
    label: string;
    tspin: boolean;
    spin: "full" | "mini" | null;
  } | null;
};
export class Game {
  state!: GameState;
  settings: Settings;
  private history: { state: GameState; rng: number }[] = [];
  get canUndo() {
    return this.history.length > 0;
  }
  undo() {
    const previous = this.history.pop();
    if (!previous) return;
    const paused = this.state.status === "paused";
    this.state = previous.state;
    this.state.allClearId = null;
    this.state.status = paused ? "paused" : "playing";
    this.rng = previous.rng;
    this.clearInput();
    this.spawnNext(this.state.active!.type);
  }
  private allClearSequence = 0;
  private lastKickIndex = 0;
  private rng = 1;
  private time = 0;
  private lastRotation: Piece | null = null;
  get elapsedMs() {
    return this.time;
  }
  private held = new Set<Action>();
  private direction: "left" | "right" | null = null;
  private chargedAt = Infinity;
  private nextShift = Infinity;
  private nextSoft = Infinity;
  private hitWall = false;
  constructor(seed: number, settings = defaultSettings()) {
    this.settings = normalizeSettings(settings);
    this.restart(seed);
  }
  restart(seed: number) {
    this.history = [];
    this.rng = seed >>> 0;
    this.time = 0;
    this.clearInput();
    this.state = {
      board: emptyBoard(),
      active: null,
      queue: [],
      hold: null,
      canHold: true,
      status: "playing",
      seed: seed >>> 0,
      pieces: 0,
      fullTSpins: 0,
      lines: 0,
      lastClear: 0,
      allClearId: null,
      combo: -1,
      b2b: -1,
      lastEvent: null,
    };
    this.fillQueue();
    this.spawnNext();
  }
  private random() {
    this.rng = (this.rng + 0x6d2b79f5) >>> 0;
    let t = this.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private fillQueue() {
    while (this.state.queue.length < 8) {
      const bag: Tetromino[] = [...TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.state.queue.push(...bag);
    }
  }
  private spawnNext(type?: Tetromino) {
    this.lastRotation = null;
    const piece = spawn(type ?? this.state.queue.shift()!);
    this.fillQueue();
    this.state.active = piece;
    if (collides(this.state.board, piece)) {
      this.state.active = null;
      this.state.status = "over";
      this.clearInput();
      return;
    }
    this.cutDAS();
    this.hitWall = false;
    this.continuousDrop();
    this.refreshInstantShift();
  }
  clearInput() {
    this.held.clear();
    this.hitWall = false;
    this.direction = null;
    this.nextShift = this.nextSoft = this.chargedAt = Infinity;
  }
  pause() {
    if (this.state.status === "playing") this.state.status = "paused";
    this.clearInput();
  }
  resume() {
    if (this.state.status === "paused") this.state.status = "playing";
    this.clearInput();
  }
  configure(settings: Settings) {
    this.settings = normalizeSettings(settings);
    this.clearInput();
  }
  private horizontal() {
    const p = this.state.active;
    if (!p || !this.direction) return;
    const dx = this.direction === "left" ? -1 : 1;
    if (this.settings.arr === 0 && this.time >= this.chargedAt) {
      let next = move(this.state.board, p, dx, 0);
      while (next !== this.state.active) {
        this.state.active = next;
        next = move(this.state.board, next, dx, 0);
      }
      this.hitWall = true;
    } else {
      this.state.active = move(this.state.board, p, dx, 0);
      this.hitWall = this.state.active === p;
    }
    this.continuousDrop();
  }
  private continuousDrop() {
    if (
      this.settings.instantSoftDrop &&
      this.held.has("softDrop") &&
      this.state.active
    )
      this.state.active = project(this.state.board, this.state.active);
  }
  private refreshInstantShift() {
    if (
      this.direction &&
      this.settings.arr === 0 &&
      this.nextShift === Infinity &&
      this.time >= this.chargedAt
    )
      this.horizontal();
  }
  private cutDAS() {
    const p = this.state.active;
    if (!p || !this.direction || !this.settings.dcd || !this.hitWall) return;
    this.chargedAt = Math.max(this.chargedAt, this.time + this.settings.dcd);
    this.nextShift = this.chargedAt;
  }
  private beginDirection(action: "left" | "right") {
    this.direction = action;
    this.chargedAt = this.time + this.settings.das;
    this.nextShift = this.chargedAt;
    this.horizontal();
    if (this.settings.das === 0) {
      if (this.settings.arr === 0) this.nextShift = Infinity;
      else this.nextShift += this.settings.arr;
    }
  }
  keyDown(action: Action) {
    if (this.held.has(action)) return;
    if (this.state.status !== "playing") return;
    this.held.add(action);
    if (action === "left" || action === "right") {
      this.beginDirection(action);
      return;
    }
    const p = this.state.active;
    if (!p) return;
    if (action === "softDrop") {
      this.state.active = this.settings.instantSoftDrop
        ? project(this.state.board, p)
        : move(this.state.board, p, 0, -1);
      this.nextSoft = this.settings.instantSoftDrop
        ? Infinity
        : this.time + 1000 / this.settings.softDropSpeed;
      this.refreshInstantShift();
    } else if (action === "cw" || action === "ccw" || action === "flip") {
      this.state.active = rotate(
        this.state.board,
        p,
        action === "cw" ? 1 : action === "ccw" ? -1 : 2,
      );
      if (this.state.active !== p) {
        this.lastRotation = this.state.active;
        if (p.type === "T") {
          const next = this.state.active;
          this.lastKickIndex = KICKS[`${p.rotation}${next.rotation}`].findIndex(
            ([dx, dy]) => next.x - p.x === dx && next.y - p.y === dy,
          );
        }
        this.cutDAS();
      }
      this.continuousDrop();
      this.refreshInstantShift();
    } else if (action === "hardDrop") {
      const landing = project(this.state.board, p);
      // Successful translations create a new pose; failed inputs/no-distance drops keep it.
      const spin =
        landing === this.lastRotation
          ? classifyTSpin(this.state.board, landing, this.lastKickIndex)
          : null;
      const tspin = spin !== null;
      const result = lock(this.state.board, landing);
      this.history.push({
        state: structuredClone(this.state),
        rng: this.rng,
      });
      this.state.board = result.board;
      if (
        result.cleared > 0 &&
        result.board.every((row) => row.every((cell) => cell === null))
      )
        this.state.allClearId = ++this.allClearSequence;
      this.state.lines += result.cleared;
      this.state.lastClear = result.cleared;
      this.state.pieces++;
      if (spin === "full") this.state.fullTSpins++;
      // -1 means no chain; the first clear arms it at 0, the second earns 1.
      this.state.combo = result.cleared > 0 ? this.state.combo + 1 : -1;
      if (result.cleared > 0) {
        const qualifies = result.cleared === 4 || tspin;
        this.state.b2b = qualifies ? this.state.b2b + 1 : -1;
      }
      if (tspin || result.cleared) {
        const clearName = ["", "Single", "Double", "Triple", "Quad"][
          result.cleared
        ];
        this.state.lastEvent = {
          id: this.state.pieces,
          label: [
            spin === "mini" ? "T-spin Mini" : tspin ? "T-spin" : "",
            clearName,
          ]
            .filter(Boolean)
            .join(" "),
          tspin,
          spin,
        };
      }
      this.state.canHold = true;
      this.spawnNext();
    } else if (action === "hold" && this.state.canHold) {
      const old = this.state.hold;
      this.state.hold = p.type;
      this.state.canHold = false;
      this.spawnNext(old ?? undefined);
    }
  }
  keyUp(action: Action) {
    this.held.delete(action);
    if (action === "softDrop") this.nextSoft = Infinity;
    if (action === this.direction) {
      const opposite = action === "left" ? "right" : "left";
      if (this.held.has(opposite)) this.beginDirection(opposite);
      else {
        this.direction = null;
        this.nextShift = this.chargedAt = Infinity;
      }
    }
  }
  tick(dt: number) {
    if (!Number.isFinite(dt) || dt < 0)
      throw new Error("Elapsed time must be finite and non-negative");
    if (this.state.status !== "playing") return;
    const end = this.time + dt;
    while (Math.min(this.nextShift, this.nextSoft) <= end) {
      this.time = Math.min(this.nextShift, this.nextSoft);
      if (this.nextShift <= this.time) {
        this.horizontal();
        this.nextShift =
          this.settings.arr === 0 ? Infinity : this.time + this.settings.arr;
      }
      if (this.nextSoft <= this.time) {
        if (this.state.active)
          this.state.active = move(this.state.board, this.state.active, 0, -1);
        this.nextSoft = this.time + 1000 / this.settings.softDropSpeed;
        this.refreshInstantShift();
      }
    }
    this.time = end;
  }
}
