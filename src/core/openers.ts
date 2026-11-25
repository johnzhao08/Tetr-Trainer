import { TYPES } from "./board";
import type { Board, Tetromino } from "./board";
import { mirrorPosition, rowsToCells } from "./position";
import type { Goal } from "./scenario";
import { DT_FIXED_QUEUE, DT_GUIDE, PCO_FIXED_QUEUE, PCO_GUIDE, TKI_GUIDE } from "./scenarios";
import { findPlacements, findSpins } from "./spins";
import type { Placement } from "./spins";
import { PRECOMPUTED_BAGS } from "./openerBags";
import { boardFromRows, chainSearch } from "./structures";

// Opener side track: which first bags each opener supports, mirrors, the
// fail-fast check and the review item ids. Guides are the scenarios' shapes.

export type OpenerDef = {
  /** Catalog module id. */
  id: string;
  name: string;
  /** Rating theme in `training.players`. */
  theme: string;
  /** Fixed rating of this opener as a Glicko opponent. */
  difficulty: number;
  /** Top-down rows: piece letters, G free cells, * cells that stay empty. */
  guide: readonly string[];
  /** Guides that are equally good builds; any one may match. */
  variants?: readonly (readonly string[])[];
  /** Finished board before the spins, to prove the spins in the engine. */
  built: readonly string[] | null;
  goals: readonly Goal[];
  /** Fixed pieces dealt after the first bag. */
  tail: readonly Tetromino[];
  pieceLimit: number;
  /**
   * How supported first bags are found: "spin" builds the guide and keeps a T
   * for the spin, "shape" builds it with every other piece held, null means
   * only the canonical bags are known.
   */
  solve: "spin" | "shape" | null;
  /** Shown when a build can no longer be finished. */
  stuck: string;
  canonical: readonly string[];
  /** Only true once tests/openers.test.ts proves the mirrored build. */
  mirror: boolean;
  /** Set on the left-right mirror of an opener. */
  mirrored?: boolean;
  lowPriority?: boolean;
};

const bag = (s: string) => [...s] as Tetromino[];

// DT Cannon after both bags are placed, before the two T-spins.
const DT_BUILT = [
  "..OO......",
  "..OO......",
  "...LLLLS.I",
  "JJ.LLZZSSI",
  "J..LLSZZSI",
  "J...TSSZZI",
  "OO.TTTSJZZ",
  "OO.IIIIJJJ",
];

export const OPENERS: readonly OpenerDef[] = [
  {
    id: "tki-opener",
    name: "TKI",
    theme: "Opener: TKI",
    difficulty: 1400,
    guide: TKI_GUIDE,
    built: TKI_GUIDE.map((r) => r.replace(/\*/g, ".")),
    goals: [{ kind: "tspin", lines: 2 }],
    tail: [],
    pieceLimit: 8,
    solve: "spin",
    stuck: "the T-slot can't be finished with the remaining pieces",
    canonical: ["ILZOSJT"],
    mirror: true,
  },
  {
    id: "dt-cannon",
    name: "DT Cannon",
    theme: "Opener: DT Cannon",
    difficulty: 1700,
    // The filler cells of the documented board are allowed, not forbidden.
    guide: DT_GUIDE.map((row, i) =>
      [...row].map((c, x) => (c === "." && DT_BUILT[i][x] !== "." ? "G" : c)).join(""),
    ),
    built: DT_BUILT,
    goals: [
      { kind: "tspin", lines: 2 },
      { kind: "tspin", lines: 3 },
    ],
    tail: DT_FIXED_QUEUE.slice(7),
    pieceLimit: 21,
    solve: null,
    stuck: "the two T-spins can't be finished",
    canonical: ["OIJTSZL"],
    mirror: true,
  },
  {
    id: "pc-opener",
    name: "PCO",
    theme: "Opener: PCO",
    difficulty: 1800,
    // The middle is filled by the second bag, so it is free here.
    guide: PCO_GUIDE.map((r) => r.replace(/\*/g, "G")),
    built: null,
    goals: [{ kind: "allClear" }],
    tail: PCO_FIXED_QUEUE.slice(7),
    pieceLimit: 10,
    solve: "shape",
    stuck: "the first bag can't be finished with the I kept in hold",
    canonical: ["IJOLZTS"],
    mirror: true,
    lowPriority: true,
  },
];

export const openerById = (id: string) => OPENERS.find((o) => o.id === id);

/** The left-right mirror: x to 9 - x, J/L and S/Z swapped. */
export function mirroredOpener(def: OpenerDef): OpenerDef {
  const rows = (r: readonly string[]) => mirrorPosition({ rows: [...r], queue: [] }).rows;
  const pieces = (p: readonly Tetromino[]) => mirrorPosition({ rows: [], queue: [...p] }).queue;
  return {
    ...def,
    mirrored: !def.mirrored,
    guide: rows(def.guide),
    variants: def.variants?.map(rows),
    built: def.built && rows(def.built),
    tail: pieces(def.tail),
    canonical: def.canonical.map((b) => pieces(bag(b)).join("")),
  };
}

export const openerFor = (def: OpenerDef, mirror: boolean) =>
  mirror ? mirroredOpener(def) : def;

/** True when the finished build yields every goal's spin in the engine. */
export function builtSpinsWork(def: OpenerDef): boolean | null {
  if (!def.built || def.goals.some((g) => g.kind !== "tspin")) return null;
  return chainSearch(boardFromRows([...def.built]), def.goals.length).some(
    (c) =>
      c.spins.length === def.goals.length &&
      c.spins.every((s, i) => {
        const g = def.goals[i];
        return s.spin === "full" && g.kind === "tspin" && s.lines === g.lines;
      }),
  );
}

// ------------------------------------------------------------------ solver

// Every search takes `instant`: with instant soft drop only moves a player can
// make (slides, rotations, drop to the floor) count, so a tuck under an
// overhang that needs a one-row drop never advertises a bag.
const keyOf = (b: Board) => b.map((r) => r.map((c) => c ?? ".").join("")).join("/");
type Targets = Map<Tetromino, Set<string>>;

function targetsOf(guide: readonly string[]): Targets {
  const out: Targets = new Map();
  for (const { x, y, char } of rowsToCells(guide)) {
    if (!(TYPES as readonly string[]).includes(char)) continue;
    const set = out.get(char as Tetromino) ?? new Set<string>();
    set.add(`${x},${y}`);
    out.set(char as Tetromino, set);
  }
  return out;
}

const placeCache = new Map<string, Board | null>();
/** The board after `type` lands exactly on `target`, or null if it cannot. */
function placeOn(
  board: Board,
  type: Tetromino,
  target: Set<string>,
  gid: string,
  instant: boolean,
) {
  const k = `${gid}|${type}|${instant}|${keyOf(board)}`;
  if (placeCache.has(k)) return placeCache.get(k)!;
  let found: Board | null = null;
  for (const p of findPlacements(board, type, { instantSoftDrop: instant })) {
    if (p.lines !== 0) continue;
    let n = 0;
    let ok = true;
    for (let y = 0; y < p.after.length && ok; y++)
      for (let x = 0; x < 10 && ok; x++)
        if (p.after[y][x] !== null && board[y][x] === null) {
          n++;
          ok = target.has(`${x},${y}`);
        }
    if (ok && n === target.size) {
      found = p.after;
      break;
    }
  }
  placeCache.set(k, found);
  return found;
}

/**
 * How the guide can still be built from this board with hold and `queue` (the
 * piece in play first): one "place" or "hold" per piece in play, or null when
 * it cannot. Pieces the guide does not use can only wait in hold.
 */
export function buildPlan(
  def: OpenerDef,
  guide: readonly string[],
  board: Board,
  hold: Tetromino | null,
  queue: readonly Tetromino[],
  instant: boolean,
): ("place" | "hold")[] | null {
  const targets = targetsOf(guide);
  const gid = guide.join("");
  const pending = (b: Board) =>
    [...targets]
      .filter(([, cells]) =>
        [...cells].some((c) => {
          const [x, y] = c.split(",").map(Number);
          return b[y][x] === null;
        }),
      )
      .map(([t]) => t);
  const dead = new Set<string>();
  type Plan = ("place" | "hold")[];
  const dfs = (b: Board, h: Tetromino | null, i: number): Plan | null => {
    const need = pending(b);
    const cur = queue[i];
    if (need.length === 0) {
      if (def.solve !== "spin") return [];
      if (h !== "T" && cur !== "T") return null;
      const goal = def.goals[0];
      return findSpins(b, "T", { instantSoftDrop: instant }).some(
        (m) => m.spin === "full" && goal.kind === "tspin" && m.lines === goal.lines,
      )
        ? []
        : null;
    }
    const key = `${keyOf(b)}|${h}|${i}`;
    if (!cur || dead.has(key)) return null;
    const put = (t: Tetromino, rest: Tetromino | null, moves: Plan) => {
      if (!need.includes(t)) return null;
      const next = placeOn(b, t, targets.get(t)!, gid, instant);
      const tail = next && dfs(next, rest, i + 1);
      return tail && [...moves, ...tail];
    };
    const plan =
      put(cur, h, ["place"]) ??
      (h === null
        ? ((t) => t && (["hold", ...t] as Plan))(dfs(b, cur, i + 1))
        : h !== cur
          ? put(h, cur, ["hold", "place"])
          : null);
    if (!plan) dead.add(key);
    return plan ?? null;
  };
  return dfs(board, hold, 0);
}

export const canFinish = (...args: Parameters<typeof buildPlan>) =>
  buildPlan(...args) !== null;

/** Most pieces the perfect-clear search looks ahead. */
export const PC_LOOKAHEAD = 4;

export type PcStep = { swap: boolean; piece: Tetromino; placement: Placement };

/**
 * A route to a perfect clear within `budget` pieces, or null when none exists.
 * Pieces beyond the known queue count as possible, so only a proven dead end
 * fails (the route then stops at the end of the known pieces).
 */
export function perfectClearRoute(
  board: Board,
  hold: Tetromino | null,
  upcoming: readonly Tetromino[],
  budget: number,
  instant: boolean,
): PcStep[] | null {
  const dead = new Set<string>();
  const dfs = (b: Board, h: Tetromino | null, i: number, k: number): PcStep[] | null => {
    const cells = b.reduce((n, r) => n + r.filter((c) => c !== null).length, 0);
    if (cells === 0) return [];
    const rows = b.filter((r) => r.some((c) => c !== null)).length;
    // Every filled row must clear, and each piece adds four cells.
    const fits = Array.from({ length: k }, (_, n) => cells + 4 * (n + 1)).some(
      (t) => t % 10 === 0 && rows <= t / 10,
    );
    const key = `${keyOf(b)}|${h}|${i}|${k}`;
    if (!fits || dead.has(key)) return null;
    const cur = upcoming[i];
    if (!cur) return [];
    const tries: [Tetromino, Tetromino | null, number, boolean][] = [[cur, h, i + 1, false]];
    if (h !== null && h !== cur) tries.push([h, cur, i + 1, true]);
    if (h === null && upcoming[i + 1]) tries.push([upcoming[i + 1], cur, i + 2, true]);
    for (const [piece, rest, next, swap] of tries)
      for (const placement of findPlacements(b, piece, { instantSoftDrop: instant })) {
        const tail = dfs(placement.after, rest, next, k - 1);
        if (tail) return [{ swap, piece, placement }, ...tail];
      }
    dead.add(key);
    return null;
  };
  return dfs(board, hold, 0, Math.min(budget, PC_LOOKAHEAD));
}

const perms = (items: string[]): string[] =>
  items.length <= 1
    ? items
    : items.flatMap((c, i) =>
        perms([...items.slice(0, i), ...items.slice(i + 1)]).map((r) => c + r),
      );

/** Solves every first-bag order from scratch (slow; used to build the tables). */
export function solveBags(def: OpenerDef, instant: boolean): readonly string[] {
  return def.solve
    ? perms([...TYPES]).filter((b) =>
        canFinish(def, def.guide, boardFromRows([]), null, bag(b), instant),
      )
    : def.canonical;
}

/** Position of a first-bag order among all 5,040, in `TYPES` order. */
export function bagRank(order: string): number {
  const free = [...TYPES] as string[];
  let rank = 0;
  for (let i = 0; i < 7; i++) {
    const at = free.indexOf(order[i]);
    rank = rank * (7 - i) + at;
    free.splice(at, 1);
  }
  return rank;
}

export const tableKey = (def: OpenerDef, instant: boolean) =>
  `${def.id}:${def.mirrored ? "m" : "n"}:${instant ? "i" : "s"}`;

const decoded = new Map<string, Set<string>>();
/** Supported orders as a set: from the committed table, else solved once. */
export function supportedSet(def: OpenerDef, instant: boolean): Set<string> {
  const key = tableKey(def, instant);
  let set = decoded.get(key);
  if (!set) {
    const table = PRECOMPUTED_BAGS[key];
    if (table) {
      const bytes = Uint8Array.from(atob(table), (c) => c.charCodeAt(0));
      set = new Set(perms([...TYPES]).filter((b) => bytes[bagRank(b) >> 3] & (1 << (bagRank(b) & 7))));
    } else set = new Set(solveBags(def, instant));
    decoded.set(key, set);
  }
  return set;
}

/** First-bag orders (as strings like "ILZOSJT") the opener can be built from. */
export const supportedBags = (def: OpenerDef, instant: boolean): readonly string[] => [
  ...supportedSet(def, instant),
];

// ---------------------------------------------------------------- fail-fast

/** A filled cell the guide does not allow there, if any. */
function offGuide(guide: readonly string[], board: Board) {
  for (let y = 0; y < board.length; y++)
    for (let x = 0; x < 10; x++) {
      const cell = board[y][x];
      if (cell === null) continue;
      const row = guide[guide.length - 1 - y];
      if (!row || (row[x] !== "G" && row[x] !== cell)) return { x, type: cell };
    }
  return null;
}

export type TrackContext = {
  instantSoftDrop?: boolean;
  /** Pieces locked so far; with it the piece budget and goals are checked. */
  placed?: number;
  /** Goals already met. */
  goalIndex?: number;
  /** A line has cleared, so the board no longer follows the raw guide. */
  cleared?: boolean;
};

/** Why the goals still to come cannot be met in the pieces left, if so. */
function goalsProblem(
  def: OpenerDef,
  board: Board,
  hold: Tetromino | null,
  upcoming: readonly Tetromino[],
  ctx: TrackContext & { placed: number },
): string | null {
  const budget = def.pieceLimit - ctx.placed;
  const goals = def.goals.slice(ctx.goalIndex ?? 0);
  if (goals.length === 0) return null;
  const instant = !!ctx.instantSoftDrop;
  if (budget < goals.length) return "there are not enough pieces left";
  const spins = goals.filter((g) => g.kind === "tspin").length;
  // An empty hold also draws one more piece: swapping parks one and uses the next.
  const reach = budget + (hold === null ? 1 : 0);
  const known = upcoming.length >= reach;
  const ts = (hold === "T" ? 1 : 0) + upcoming.slice(0, reach).filter((t) => t === "T").length;
  if (known && ts < spins) return "no T is left for the T-spin";
  if (goals[0].kind === "allClear" && budget <= PC_LOOKAHEAD && !perfectClearRoute(board, hold, upcoming, budget, instant))
    return "the perfect clear is out of reach";
  return null;
}

/**
 * Why the build can no longer reach the opener, or null while it is on track.
 * `upcoming` is the piece in play followed by the queue. Any variant guide
 * that still fits keeps the attempt alive. With `ctx.placed` the goals still
 * to come are checked too, also after a line clear, and a perfect-clear opener
 * is judged by whether the clear is reachable once few pieces are left.
 */
export function trackProblem(
  def: OpenerDef,
  board: Board,
  hold: Tetromino | null,
  upcoming: readonly Tetromino[],
  ctx: TrackContext = {},
): string | null {
  const instant = !!ctx.instantSoftDrop;
  const wrap = (why: string) => `This placement doesn't fit ${def.name}: ${why}.`;
  if (ctx.placed !== undefined) {
    const why = goalsProblem(def, board, hold, upcoming, { ...ctx, placed: ctx.placed });
    if (why) return wrap(why);
  }
  const finishing =
    def.solve === "shape" && ctx.placed !== undefined && def.pieceLimit - ctx.placed <= PC_LOOKAHEAD;
  if (ctx.cleared || finishing) return null;
  const guides = [def.guide, ...(def.variants ?? [])];
  const ok = guides.some(
    (g) =>
      !offGuide(g, board) &&
      (!def.solve || canFinish(def, g, board, hold, upcoming, instant)),
  );
  if (ok) return null;
  const bad = offGuide(def.guide, board);
  return wrap(bad ? `the ${bad.type} at column ${bad.x + 1} is not part of the opener` : def.stuck);
}
