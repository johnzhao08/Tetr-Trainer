import {
  cells,
  collides,
  emptyBoard,
  immobile,
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
import { findPlacements, findSpins } from "./spins";
import { attackFor } from "./attack";
import type { Spin } from "./attack";
import { emptyStats, finesseOptimal } from "./stats";
import type { SessionStats } from "./stats";
import {
  cancelIncoming,
  dealGarbage,
  defaultOptions,
  garbageMultiplierAt,
  gravityEnabled,
  LEAGUE_GARBAGE_DELAY_MS,
  newGarbageRng,
  pendingLines,
} from "./incoming";
import type { GameOptions, GarbageRng, Incoming } from "./incoming";
import { newCheeseState, refillCheese } from "./cheese";
import type { CheeseState } from "./cheese";
import { Opponent } from "./opponent";
import type { OpponentState } from "./opponent";

// Gravity and the opponent are simulated in steps of one 60 fps frame.
const FRAME_MS = 1000 / 60;
const FRAME_EPS = 1e-6;

// One locked piece. keys counts presses before the hard drop; optimalKeys is
// the fewest presses that reach the landing on the real board.
export type Placement = {
  index: number;
  type: Tetromino;
  landing: Piece;
  atMs: number;
  keys: number;
  optimalKeys: number;
  cleared: number;
  garbageCleared: number;
  spin: Spin;
  attack: number;
  b2b: number;
  combo: number;
  held: boolean;
};
export type GameState = {
  board: Board;
  active: Piece | null;
  queue: Tetromino[];
  hold: Tetromino | null;
  canHold: boolean;
  // Whether the current piece came from a successful hold.
  usedHold: boolean;
  status: "playing" | "paused" | "over";
  seed: number;
  pieces: number;
  fullTSpins: number;
  lines: number;
  lastClear: number;
  allClearId: number | null;
  combo: number;
  b2b: number;
  stats: SessionStats;
  /** Garbage waiting to be inserted; the UI meter reads this. */
  incoming: Incoming[];
  garbage: GarbageRng;
  opponent: OpponentState | null;
  cheese: CheeseState | null;
  lastAttack: { parts: number[]; total: number; id: number } | null;
  lastEvent: {
    id: number;
    label: string;
    tspin: boolean;
    spin: Spin;
  } | null;
};
export class Game {
  state!: GameState;
  settings: Settings;
  private history: {
    state: GameState;
    rng: number;
    time: number;
    frames: number;
  }[] = [];
  // Kept outside GameState so undo snapshots stay small.
  log: Placement[] = [];
  /** Called as each piece locks, after the line clear and before garbage. */
  onLock?: (info: {
    before: Board;
    after: Board;
    placement: Placement;
  }) => void;
  /** Set or clear the lock listener (a method, so UI code need not assign a prop). */
  listenToLocks(listener?: Game["onLock"]) {
    this.onLock = listener;
  }
  /** Checked between simulation steps; true ends the running `tick` early. */
  stopTick?: () => boolean;
  private options: GameOptions = defaultOptions();
  private opponent: Opponent | null = null;
  // Per-piece gravity state; spawnNext resets it, so undo needs none of it.
  private fall = 0;
  private lockAt = Infinity;
  // Game time the running lock timer last (re)started.
  private lockSince = 0;
  private resets = 0;
  // Game time a hard drop held back by ppsCap will lock; Infinity when none.
  private dropAt = Infinity;
  // Undo hands back the time spent on discarded attempts. `refunded` is that
  // total in game ms and `keptAt[i]` is placement i's lock time on the kept
  // timeline (game time minus refunds), the same timeline a drill reports.
  private refunded = 0;
  private keptAt: number[] = [];
  // Earliest game time the next lock is allowed under ppsCap: one interval
  // after the previous kept lock, measured on the kept timeline.
  private lockAllowedAt() {
    const cap = this.options.ppsCap;
    const last = this.keptAt.at(-1);
    return cap !== undefined && cap > 0 && last !== undefined
      ? last + 1000 / cap + this.refunded
      : -Infinity;
  }
  get pendingLines() {
    return pendingLines(this.state.incoming);
  }
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
    // Restore the game clock too, so queued garbage, gravity ramp and the
    // opponent replay exactly as the first time.
    this.time = previous.time;
    this.frames = previous.frames;
    if (this.opponent) this.opponent.state = this.state.opponent!;
    this.log.length = this.state.pieces;
    this.keptAt.length = this.state.pieces;
    this.refunded = this.time - (this.keptAt.at(-1) ?? 0);
    // The undone piece respawns, so its presses no longer count.
    this.state.stats.keys -= this.state.stats.pieceKeys;
    this.state.stats.pieceKeys = 0;
    this.clearInput();
    this.spawnNext(this.state.active!.type);
  }
  /** Restore the state from before placement `pieceIndex` (0-based). */
  rewindTo(pieceIndex: number) {
    if (!Number.isInteger(pieceIndex) || pieceIndex < 0) return;
    // Go through undo() so subclasses unwind their own per-placement state.
    while (this.state.pieces > pieceIndex && this.canUndo) {
      const before = this.state.pieces;
      this.undo();
      if (this.state.pieces >= before) break;
    }
  }
  private pieceStart: Piece | null = null;
  /** Make `piece` the active piece and remember it as the pose it started in. */
  protected setActive(piece: Piece) {
    this.state.active = piece;
    this.pieceStart = piece;
  }
  private allClearSequence = 0;
  private lastKickIndex = 0;
  private rng = 1;
  private time = 0;
  // Pressure frames already simulated (frame k ends at k * 1000 / 60 ms).
  private frames = 0;
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
  constructor(
    seed: number,
    settings = defaultSettings(),
    options: Partial<GameOptions> = {},
  ) {
    this.settings = normalizeSettings(settings);
    this.options = { ...defaultOptions(), ...options };
    this.restart(seed);
  }
  /**
   * Gravity, lock and garbage values apply immediately. A changed `opponent`
   * takes effect from the next restart.
   */
  setOptions(options: Partial<GameOptions>) {
    this.options = { ...this.options, ...options };
    if (this.lockAt !== Infinity)
      this.lockAt = this.lockSince + this.options.lockDelayMs;
    // A held drop follows the new cap; with no cap it locks on the next tick.
    if (this.dropAt !== Infinity)
      this.dropAt = Math.max(this.time, this.lockAllowedAt());
    this.settle(false);
  }
  /** Queue incoming garbage that lands after `delayMs` of game time. */
  receive(lines: number, delayMs = LEAGUE_GARBAGE_DELAY_MS) {
    if (lines > 0)
      this.state.incoming.push({ lines, readyAt: this.time + delayMs });
  }
  restart(seed: number) {
    this.history = [];
    this.log = [];
    this.keptAt = [];
    this.refunded = 0;
    this.rng = seed >>> 0;
    this.time = 0;
    this.frames = 0;
    this.clearInput();
    const opp = this.options.opponent;
    this.opponent = opp ? new Opponent(opp.seed, opp) : null;
    this.state = {
      board: emptyBoard(),
      active: null,
      queue: [],
      hold: null,
      canHold: true,
      usedHold: false,
      status: "playing",
      seed: seed >>> 0,
      pieces: 0,
      fullTSpins: 0,
      lines: 0,
      lastClear: 0,
      allClearId: null,
      combo: -1,
      b2b: -1,
      stats: emptyStats(),
      incoming: [],
      garbage: newGarbageRng(seed),
      opponent: this.opponent?.state ?? null,
      cheese: this.options.cheese ? newCheeseState(seed) : null,
      lastAttack: null,
      lastEvent: null,
    };
    if (this.options.cheese)
      this.state.board = refillCheese(
        this.state.board,
        this.state.cheese!,
        this.options.cheese,
      ).board;
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
    this.fall = 0;
    this.lockAt = Infinity;
    this.resets = 0;
    this.dropAt = Infinity;
    const piece = spawn(type ?? this.state.queue.shift()!);
    this.fillQueue();
    this.setActive(piece);
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
    this.settle(false);
  }
  private gravityAt(ms: number) {
    const o = this.options;
    return (
      o.gravity +
      (o.gravityIncrease * Math.max(0, ms - o.gravityMarginMs)) / 1000
    );
  }
  private get gravityOn() {
    return gravityEnabled(this.options);
  }
  // Start or cancel the lock timer from the piece's current contact. A
  // successful move or rotation (`moved`) restarts a running timer while
  // resets remain.
  private settle(moved: boolean) {
    const p = this.state.active;
    if (!this.gravityOn || !p || move(this.state.board, p, 0, -1) !== p) {
      this.lockAt = Infinity;
      return;
    }
    if (this.lockAt === Infinity) {
      this.lockSince = this.time;
      this.lockAt = this.time + this.options.lockDelayMs;
    } else if (moved && this.resets < this.options.lockResets) {
      this.resets++;
      this.lockSince = this.time;
      this.lockAt = this.time + this.options.lockDelayMs;
    }
  }
  // One simulation step: opponent attacks, gravity, then the lock timer.
  private pressure(dt: number) {
    if (this.opponent)
      for (const lines of this.opponent.advance(
        dt,
        garbageMultiplierAt(this.options, this.time),
      ))
        this.receive(lines);
    if (!this.state.active) return;
    if (this.gravityOn) {
      this.fall += (this.gravityAt(this.time) * 60 * dt) / 1000;
      while (this.fall >= 1 && this.state.active) {
        const next = move(this.state.board, this.state.active, 0, -1);
        if (next === this.state.active) {
          this.fall = 0;
          break;
        }
        this.state.active = next;
        // A fall changes the pose, so an earlier rotation no longer counts.
        this.lastRotation = null;
        this.fall--;
      }
      this.settle(false);
    }
    if (
      this.state.active &&
      this.time >= this.lockAt &&
      this.time >= this.lockAllowedAt() - FRAME_EPS
    )
      // A hard drop held to this deadline wins the tie and counts as a press.
      this.lockPiece(this.state.active, { hard: this.dropAt !== Infinity });
  }
  // Pressure steps run on a persistent 60 Hz clock: frame k ends at
  // k * 1000 / 60 ms of game time, whatever the tick sizes were.
  private advanceTo(end: number) {
    const pressureOn = this.gravityOn || this.opponent !== null;
    while (
      this.time < end &&
      this.state.status === "playing" &&
      !this.stopTick?.()
    ) {
      const boundary = ((this.frames + 1) * 1000) / 60;
      if (!pressureOn) {
        // Keep the frame count in step so pressure can start mid-game.
        this.frames = Math.max(
          this.frames,
          Math.floor((end * 60) / 1000 + FRAME_EPS),
        );
        this.time = end;
        return;
      }
      if (boundary > end + FRAME_EPS) {
        this.time = end;
        return;
      }
      this.frames++;
      this.time = Math.max(this.time, boundary);
      this.pressure(FRAME_MS);
    }
  }
  clearInput() {
    this.held.clear();
    this.hitWall = false;
    this.direction = null;
    this.nextShift = this.nextSoft = this.chargedAt = Infinity;
    // A hard drop held back by ppsCap is dropped by pause, focus loss and settings.
    this.dropAt = Infinity;
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
    if (this.state.active !== p) this.settle(true);
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
    const stats = this.state.stats;
    if (action === "left" || action === "right") {
      stats.keys++;
      stats.pieceKeys++;
      this.beginDirection(action);
      return;
    }
    const p = this.state.active;
    if (!p) return;
    if (action !== "hardDrop" && action !== "hold") {
      stats.keys++;
      stats.pieceKeys++;
    }
    if (action === "softDrop") {
      this.state.active = this.settings.instantSoftDrop
        ? project(this.state.board, p)
        : move(this.state.board, p, 0, -1);
      this.settle(false);
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
      if (this.state.active !== p) this.settle(true);
    } else if (action === "hardDrop") {
      const allowed = this.lockAllowedAt();
      if (this.time < allowed - FRAME_EPS) this.dropAt = allowed;
      else this.lockPiece(p, { hard: true });
    } else if (action === "hold" && this.state.canHold) {
      const old = this.state.hold;
      this.state.hold = p.type;
      this.state.canHold = false;
      this.state.usedHold = true;
      stats.keys++;
      stats.pieceKeys = 0;
      this.spawnNext(old ?? undefined);
    }
  }
  /**
   * Lock the active piece at exactly `pose` (after a hold when `held`). The
   * recorded `spin` is only a claim: the engine recomputes it. A spin claim is
   * accepted only when the solver finds a path ending in a rotation that the
   * engine scores as that class. A non-spin claim needs a landing that a slide
   * or drop reaches, unless no rotation into it scores as a spin.
   * Anything else (out of bounds, colliding, unreachable, unprovable spin)
   * changes nothing and returns false.
   */
  placeAt(pose: Piece, held: boolean, spin: Spin): boolean {
    const s = this.state;
    if (s.status !== "playing" || !s.active) return false;
    if (held && !s.canHold) return false;
    const type = held ? (s.hold ?? s.queue[0]) : s.active.type;
    if (type !== pose.type || collides(s.board, pose)) return false;
    // Key by (x,y) pairs: a flat x + y * WIDTH key aliases off-board cells.
    const key = (p: Piece) =>
      cells(p)
        .map(([x, y]) => `${x},${y}`)
        .sort()
        .join(";");
    const want = key(pose);
    const landing = findPlacements(s.board, type).find((r) => key(r.piece) === want);
    if (!landing) return false;
    const spins = findSpins(s.board, type, { includeZero: true }).filter(
      (m) => key(m.piece) === want,
    );
    if (spin) {
      if (!spins.some((m) => m.spin === spin)) return false;
    } else if (!landing.plain && spins.length > 0) {
      // Only a final rotation reaches this pose, and the engine scores that as a spin.
      return false;
    }
    if (held) {
      this.keyDown("hold");
      this.keyUp("hold");
    }
    if (s.status !== "playing" || s.active?.type !== type) return false;
    this.lockPiece(pose, { hard: true }, spin);
    return true;
  }
  private lockPiece(
    p: Piece,
    { hard }: { hard: boolean },
    forcedSpin?: Spin,
  ) {
    const stats = this.state.stats;
    const landing = project(this.state.board, p);
    // Successful translations create a new pose; failed inputs/no-distance drops keep it.
    let spin: Spin = forcedSpin ?? null;
    if (forcedSpin === undefined && landing === this.lastRotation && p.type !== "O") {
      if (p.type === "T")
        spin = classifyTSpin(this.state.board, landing, this.lastKickIndex);
      // Season 2 "all-mini+": an immobile piece after a rotation is a mini.
      if (!spin && immobile(this.state.board, landing)) spin = "mini";
    }
    const tspin = spin !== null && p.type === "T";
    const result = lock(this.state.board, landing);
    const optimal = finesseOptimal(
      this.state.board,
      p.type,
      landing,
      this.pieceStart?.type === p.type ? this.pieceStart : undefined,
    );
    this.history.push({
      state: structuredClone(this.state),
      rng: this.rng,
      time: this.time,
      frames: this.frames,
    });
    const before = this.state.board;
    this.state.board = result.board;
    const allClear =
      result.cleared > 0 &&
      result.board.every((row) => row.every((cell) => cell === null));
    if (allClear) this.state.allClearId = ++this.allClearSequence;
    const faults =
      optimal === null ? 0 : Math.max(0, stats.pieceKeys - optimal);
    const placementKeys = stats.pieceKeys;
    // An auto-lock is not a key press.
    if (hard) stats.keys++;
    stats.pieceKeys = 0;
    stats.finesseFaults += faults;
    if (faults === 0) stats.cleanPieces++;
    this.state.lines += result.cleared;
    this.state.lastClear = result.cleared;
    this.state.pieces++;
    if (spin === "full" && tspin) this.state.fullTSpins++;
    if (spin) stats.spins[spin]++;
    const attack = attackFor({
      lines: result.cleared,
      spin,
      b2b: this.state.b2b,
      combo: this.state.combo,
      garbageCleared: result.garbage > 0,
      allClear,
    });
    this.state.b2b = attack.b2b;
    this.state.combo = attack.combo;
    stats.attack += attack.total;
    // The multiplier ramp scales what leaves the board (stats.attack stays
    // the unscaled total so APP and APM are comparable across games).
    const outgoing = Math.floor(
      attack.total * garbageMultiplierAt(this.options, this.time),
    );
    // Opener phase: a defender who is behind cancels 2 lines per attack line.
    const rate =
      this.state.pieces <= this.options.openerPhase &&
      pendingLines(this.state.incoming) > outgoing
        ? 2
        : 1;
    const cancelled =
      result.cleared > 0
        ? cancelIncoming(this.state.incoming, outgoing * rate)
        : 0;
    const sent = outgoing - Math.ceil(cancelled / rate);
    stats.cancelled += cancelled;
    stats.sent += sent;
    this.opponent?.receive(sent);
    stats.garbageCleared += result.garbage;
    stats.maxB2b = Math.max(stats.maxB2b, attack.b2b);
    stats.maxCombo = Math.max(stats.maxCombo, attack.combo);
    if (attack.surge) stats.surges++;
    if (attack.total > 0)
      this.state.lastAttack = {
        parts: attack.parts,
        total: attack.total,
        id: this.state.pieces,
      };
    const placement: Placement = {
      index: this.state.pieces - 1,
      type: p.type,
      landing,
      atMs: this.time,
      keys: placementKeys,
      optimalKeys: optimal ?? placementKeys,
      cleared: result.cleared,
      garbageCleared: result.garbage,
      spin,
      attack: attack.total,
      b2b: this.state.b2b,
      combo: this.state.combo,
      held: this.state.usedHold,
    };
    this.log.push(placement);
    this.keptAt.push(this.time - this.refunded);
    this.onLock?.({ before, after: result.board, placement });
    if (spin || result.cleared) {
      const clearName = ["", "Single", "Double", "Triple", "Quad"][
        result.cleared
      ];
      this.state.lastEvent = {
        id: this.state.pieces,
        label: [
          spin === "mini" ? `${p.type}-spin Mini` : tspin ? "T-spin" : "",
          clearName,
        ]
          .filter(Boolean)
          .join(" "),
        tspin,
        spin,
      };
    }
    this.state.canHold = true;
    this.state.usedHold = false;
    if (result.cleared === 0) {
      const dealt = dealGarbage(
        this.state.board,
        this.state.incoming,
        this.state.garbage,
        this.time,
        this.options.garbageCap,
        this.options.garbageMessiness,
      );
      this.state.board = dealt.board;
      if (dealt.toppedOut) {
        this.state.active = null;
        this.state.status = "over";
        this.clearInput();
        return;
      }
    }
    if (this.options.cheese && this.state.cheese) {
      const fill = refillCheese(
        this.state.board,
        this.state.cheese,
        this.options.cheese,
      );
      this.state.board = fill.board;
      if (fill.toppedOut) {
        this.state.active = null;
        this.state.status = "over";
        this.clearInput();
        return;
      }
    }
    this.spawnNext();
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
    while (
      this.state.status === "playing" &&
      !this.stopTick?.() &&
      Math.min(this.nextShift, this.nextSoft, this.dropAt) <= end
    ) {
      this.advanceTo(
        Math.max(
          this.time,
          Math.min(this.nextShift, this.nextSoft, this.dropAt),
        ),
      );
      if (this.state.status !== "playing") return;
      if (this.dropAt <= this.time && this.state.active) {
        this.dropAt = Infinity;
        this.lockPiece(this.state.active, { hard: true });
        if (this.state.status !== "playing") return;
        continue;
      }
      if (this.nextShift <= this.time) {
        this.horizontal();
        this.nextShift =
          this.settings.arr === 0 ? Infinity : this.time + this.settings.arr;
      }
      if (this.nextSoft <= this.time) {
        if (this.state.active)
          this.state.active = move(this.state.board, this.state.active, 0, -1);
        this.settle(false);
        this.nextSoft = this.time + 1000 / this.settings.softDropSpeed;
        this.refreshInstantShift();
      }
    }
    this.advanceTo(end);
  }
}
