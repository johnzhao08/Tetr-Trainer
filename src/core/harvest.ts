// Puzzles from the player's own mistakes. Pure: replays saved drill runs,
// finds placements the coach graded mistake or worse, and keeps only those
// where a clean alternative exists (the puzzle is solvable).
import { cells, HEIGHT, lock, TYPES, WIDTH } from "./board";
import type { Board, Piece, Rotation, Tetromino } from "./board";
import { analyzeBoard, COACH_CONFIG, reviewPlacement } from "./coach";
import { reviewDig, withDig } from "./dig";
import type { DrillFlag, DrillReview } from "./dig";
import { findDrill } from "./drillLookup";
import type { PuzzleDef } from "./puzzle";
import { boardFromRows, validatePosition } from "./position";
import type { Position } from "./position";
import type { SessionRecord } from "./progress";
import { replaySession } from "./replay";
import type { ReplayStep } from "./replay";
import { findPlacements, findSpins } from "./spins";

export const MAX_HARVEST = 50;
/** Puzzles in one "your mistakes" set. */
export const SET_SIZE = 10;
export const PUZZLES_KEY = "tetr-trainer.puzzles.v1";

type Kind = DrillFlag["kind"];
// Most telling flag first: it names the puzzle's theme.
const KINDS: readonly Kind[] = [
  "hole", "lost-tsd", "spike", "two-wide", "i-dependency", "overhang", "high",
  "next-hole-blocked", "cost-lines", "wasted-i", "hold-fit", "own-line",
];
const THEME: Record<Kind, string> = {
  hole: "Holes", "lost-tsd": "Lost T-spin slots", spike: "Height spikes",
  "two-wide": "2-wide gaps", "i-dependency": "I-piece dependency",
  overhang: "Overhangs", high: "Tall stacks", "next-hole-blocked": "Blocked holes",
  "cost-lines": "Costly stacking", "wasted-i": "Wasted I pieces",
  "hold-fit": "Missed holds", "own-line": "Own-line clears",
};
const AVOID: Record<Kind, string> = {
  hole: "a hole",
  "lost-tsd": "destroying your T-spin slot",
  spike: "a height spike",
  "two-wide": "a 2-wide gap",
  "i-dependency": "a well only an I fits",
  overhang: "an overhang",
  high: "a taller stack",
  "next-hole-blocked": "a blocked next hole",
  "cost-lines": "extra lines to dig",
  "wasted-i": "a wasted I piece",
  "hold-fit": "a missed hold",
  "own-line": "a clear of your own stack",
};
/** Plain-language explanation of the harvest rules, for the home section. */
export const HARVEST_EXPLAIN =
  "Positions from your saved drill runs where the coach graded a placement a mistake or blunder. Any placement the coach rates best or good solves it, so near-equal moves are forgiven. Opponent drills are not saved with a replay.";

export type Move = { piece: Piece; hold: boolean; review: DrillReview };

/**
 * The best placement for the current piece, or for the hold swap, by coach
 * penalty (then more lines, then a lower stack). Null unless some placement is
 * best or good, which is the puzzle's solvability test. Pass `swap` null when
 * hold is not allowed. With `dig`, placements are graded as a cheese drill
 * grades them: the coach plus the dig penalty.
 */
export function betterPlacement(
  board: Board,
  current: Tetromino,
  swap: Tetromino | null,
  dig?: { hold: Tetromino | null; next: Tetromino[] },
): Move | null {
  let best: Move | null = null;
  let bestKey: number[] = [];
  const consider = (type: Tetromino, hold: boolean) => {
    // A landing only a rotation reaches is scored as that spin, not a plain lock.
    const at = (p: Piece) => cells(p).map(String).sort().join(";");
    const turned = new Set(findSpins(board, type, { includeZero: true }).map((m) => at(m.piece)));
    const found: { piece: Piece; lines: number; after: Board; spin: boolean }[] = [
      ...findPlacements(board, type)
        .filter((p) => p.plain || !turned.has(at(p.piece)))
        .map((p) => ({ ...p, spin: false })),
      ...findSpins(board, type).map((s) => ({ ...s, spin: true })),
    ];
    for (const f of found) {
      const base = reviewPlacement(board, f.after, {
        cleared: f.lines,
        spin: f.spin,
      });
      let review: DrillReview = base;
      if (dig) {
        // The hold and queue as they stand once this piece has locked.
        const after = hold
          ? { hold: current, next: dig.hold ? dig.next : dig.next.slice(1) }
          : dig;
        const move = { type, landing: f.piece, cleared: f.lines, held: hold, garbageCleared: lock(board, f.piece).garbage };
        review = withDig(base, reviewDig(board, f.after, move, after));
      }
      if (review.penalty >= COACH_CONFIG.inaccuracyAt) continue;
      const key = [-f.lines, review.after.maxHeight, hold ? 1 : 0];
      // Lexicographic: more lines, then a lower stack, then no hold.
      const at = key.findIndex((k, i) => k !== bestKey[i]);
      if (!best || (at >= 0 && key[at] < bestKey[at])) {
        best = { piece: f.piece, hold, review };
        bestKey = key;
      }
    }
  };
  consider(current, false);
  if (swap) consider(swap, true);
  return best;
}

function rowsOf(board: Board): string[] {
  let top = -1;
  board.forEach((row, y) => {
    if (row.some(Boolean)) top = y;
  });
  const rows: string[] = [];
  for (let y = top; y >= 0; y--)
    rows.push(
      board[y].map((c) => (c === null ? "." : TYPES.includes(c as Tetromino) ? c : "X")).join(""),
    );
  return rows;
}

const flagKinds = (flags: readonly DrillFlag[]): Kind[] =>
  KINDS.filter((k) => flags.some((f) => f.kind === k));

function columns(piece: Piece): string {
  const xs = cells(piece).map(([x]) => x + 1);
  const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
  return lo === hi ? `column ${lo}` : `columns ${lo} to ${hi}`;
}

/**
 * Turn one replayed placement into a puzzle: null when the coach had no flags
 * for it, it was not a mistake (unless `anyBand`), or no clean placement exists.
 * `meta.allowHold` false (a no-hold drill) keeps hold out of the search and
 * the puzzle; `meta.dig` (a cheese drill) grades both with the dig penalty.
 * A position the original move already solves is not a puzzle.
 */
export function puzzleFromStep(
  step: ReplayStep,
  meta: { id: string; drillTitle: string; allowHold?: boolean; dig?: boolean },
  anyBand = false,
): PuzzleDef | null {
  const { review } = step;
  const kinds = flagKinds(review.flags);
  if (kinds.length === 0) return null;
  if (!anyBand && review.penalty < COACH_CONFIG.mistakeAt) return null;
  const position: Position = {
    rows: rowsOf(step.board),
    queue: [step.current, ...step.next],
    hold: step.hold,
    b2b: step.b2b,
    combo: step.combo,
  };
  if (validatePosition(position).length || position.rows.length > HEIGHT) return null;
  const allowHold = meta.allowHold !== false;
  const swap = allowHold ? (step.hold ?? step.next[0] ?? null) : null;
  // The original move was graded by the same rules, so it must not pass them.
  if (review.penalty < COACH_CONFIG.inaccuracyAt) return null;
  const dig = meta.dig ? { hold: step.hold, next: step.next } : undefined;
  const move = betterPlacement(step.board, step.current, swap, dig);
  if (!move) return null;
  const kind = kinds[0];
  const avoid = kinds.map((k) => AVOID[k]).join(" or ");
  const how = move.hold
    ? `hold, then put the ${move.piece.type} in ${columns(move.piece)}`
    : `put the ${move.piece.type} in ${columns(move.piece)}`;
  return {
    id: meta.id,
    title: `Fix a mistake: ${THEME[kind].toLowerCase()}`,
    themes: kinds.map((k) => THEME[k]),
    prompt: `Place the piece without creating ${avoid}.`,
    hint: "Look for a landing that covers no empty cell and keeps the surface even.",
    explanation: `In ${meta.drillTitle} this placement was graded ${review.band}. A cleaner move: ${how}. Any best or good placement counts as solved.`,
    position,
    // Graded by what the explanation promises, not by the original flags.
    goal: { kind: "band", atLeast: "good" },
    pieceLimit: 1,
    ...(meta.dig && { dig: true as const }),
    ...(!allowHold && { allowHold: false }),
    guide: [move.piece],
    source: "session",
  };
}

// Same surface, piece and hold read as the same lesson.
function signature(def: PuzzleDef): string {
  const { heights } = analyzeBoard(boardFromRows(def.position.rows));
  const { queue, hold } = def.position;
  return `${heights.join(",")}|${queue[0]}|${hold ?? ""}|${def.themes[0]}`;
}

/** Newest first; duplicates by id or by look keep the newest; capped. */
export function mergePuzzles(
  fresh: readonly PuzzleDef[],
  existing: readonly PuzzleDef[],
  max = MAX_HARVEST,
): PuzzleDef[] {
  const ids = new Set<string>();
  const looks = new Set<string>();
  const out: PuzzleDef[] = [];
  for (const def of [...fresh, ...existing]) {
    const look = signature(def);
    if (ids.has(def.id) || looks.has(look)) continue;
    ids.add(def.id);
    looks.add(look);
    out.push(def);
    if (out.length >= max) break;
  }
  return out;
}

/** Puzzles from one record's replay, latest placement first. */
export function harvestRecord(record: SessionRecord): PuzzleDef[] {
  const replay = replaySession(record);
  if (!replay) return [];
  const drill = findDrill(record.drillId)?.drill;
  const drillTitle = drill?.title ?? record.drillId;
  const allowHold = !drill?.noHold;
  const dig = !!drill?.options?.cheese;
  const out: PuzzleDef[] = [];
  replay.steps.forEach((step, i) => {
    const def = puzzleFromStep(step, { id: `h-${record.id}-${i}`, drillTitle, allowHold, dig });
    if (def) out.push(def);
  });
  return out.reverse();
}

/** "none": no replay or no clean alternative; "failed": storage refused. */
export type MomentResult = "saved" | "none" | "failed";

/**
 * "Practise this later": save placement `index` of a finished run, even when
 * it was only an inaccuracy.
 */
export function saveMoment(
  storage: Pick<Storage, "getItem" | "setItem">,
  record: SessionRecord,
  index: number,
): MomentResult {
  const step = replaySession(record)?.steps[index];
  if (!step) return "none";
  const drill = findDrill(record.drillId)?.drill;
  const def = puzzleFromStep(
    step,
    {
      id: `h-${record.id}-${index}`,
      drillTitle: drill?.title ?? record.drillId,
      allowHold: !drill?.noHold,
      dig: !!drill?.options?.cheese,
    },
    true,
  );
  if (!def) return "none";
  return addPuzzles(storage, [def]) ? "saved" : "failed";
}

/** From the replayable sessions, newest session first, deduped and capped. */
export function harvestPuzzles(
  records: readonly SessionRecord[],
  max = MAX_HARVEST,
): PuzzleDef[] {
  const newest = [...records].sort((a, b) => b.endedAt - a.endedAt);
  return mergePuzzles(
    newest.flatMap((r) => (r.replay ? harvestRecord(r) : [])),
    [],
    max,
  );
}

export function themeCounts(
  puzzles: readonly PuzzleDef[],
): { theme: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of puzzles) counts.set(p.themes[0], (counts.get(p.themes[0]) ?? 0) + 1);
  return [...counts]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));
}

// Storage -------------------------------------------------------------

const isStr = (v: unknown): v is string => typeof v === "string" && v !== "";

function parsePuzzle(value: unknown): PuzzleDef | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const pos = p.position as Record<string, unknown> | undefined;
  const goal = p.goal as Record<string, unknown> | undefined;
  if (![p.id, p.title, p.prompt, p.explanation].every(isStr)) return null;
  if (!Array.isArray(p.themes) || p.themes.length === 0 || !p.themes.every(isStr))
    return null;
  if (!pos || !Array.isArray(pos.rows) || !Array.isArray(pos.queue)) return null;
  if (!pos.rows.every((r) => typeof r === "string")) return null;
  const hold = pos.hold === null || pos.hold === undefined ? null : pos.hold;
  const position: Position = {
    rows: pos.rows as string[],
    queue: pos.queue as Tetromino[],
    hold: hold as Tetromino | null,
    ...(Number.isInteger(pos.b2b) && { b2b: pos.b2b as number }),
    ...(Number.isInteger(pos.combo) && { combo: pos.combo as number }),
  };
  if (validatePosition(position).length) return null;
  if (
    !goal ||
    (goal.kind !== "band" && goal.kind !== "noFlag")
  )
    return null;
  if (p.pieceLimit !== 1 || p.source !== "session") return null;
  const guide: Piece[] = [];
  for (const g of Array.isArray(p.guide) ? p.guide : []) {
    const q = g as Record<string, unknown>;
    if (
      !TYPES.includes(q?.type as Tetromino) ||
      !Number.isInteger(q.x) ||
      !Number.isInteger(q.y) ||
      !Number.isInteger(q.rotation) ||
      (q.rotation as number) < 0 ||
      (q.rotation as number) > 3 ||
      (q.x as number) < -3 ||
      (q.x as number) > WIDTH + 2
    )
      return null;
    guide.push({
      type: q.type as Tetromino,
      x: q.x as number,
      y: q.y as number,
      rotation: q.rotation as Rotation,
    });
  }
  return {
    id: p.id as string,
    title: p.title as string,
    themes: p.themes as string[],
    prompt: p.prompt as string,
    ...(isStr(p.hint) && { hint: p.hint }),
    explanation: p.explanation as string,
    position,
    // Older saves graded on the original flags; they now use the band goal.
    goal: { kind: "band", atLeast: "good" },
    pieceLimit: 1,
    ...(p.dig === true && { dig: true as const }),
    ...(p.allowHold === false && { allowHold: false }),
    guide,
    source: "session",
  };
}

export type PuzzleStore = { puzzles: PuzzleDef[]; processed: string[] };
type Stored = PuzzleStore;

export const emptyPuzzleStore = (): PuzzleStore => ({ puzzles: [], processed: [] });

/** True when the store holds anything, even only processed session ids. */
export const hasPuzzleData = (s: PuzzleStore) => s.puzzles.length > 0 || s.processed.length > 0;

/** The stored shape, validated; null when it is not a version 1 store. */
export function parsePuzzleStore(value: unknown): PuzzleStore | null {
  const data = value as { version?: unknown; puzzles?: unknown; processed?: unknown } | null;
  if (!data || typeof data !== "object" || data.version !== 1 || !Array.isArray(data.puzzles))
    return null;
  return {
    puzzles: mergePuzzles(
      data.puzzles.flatMap((v) => parsePuzzle(v) ?? []),
      [],
    ),
    processed: Array.isArray(data.processed) ? data.processed.filter(isStr) : [],
  };
}

export const serializePuzzleStore = (data: PuzzleStore) => ({
  version: 1,
  puzzles: data.puzzles,
  processed: data.processed.slice(-MAX_PROCESSED),
});

function readStored(storage: Pick<Storage, "getItem">): Stored {
  try {
    const raw = storage.getItem(PUZZLES_KEY);
    if (raw === null) return emptyPuzzleStore();
    return parsePuzzleStore(JSON.parse(raw)) ?? emptyPuzzleStore();
  } catch {
    return emptyPuzzleStore();
  }
}

export const loadPuzzleStore = readStored;

export function loadPuzzles(storage: Pick<Storage, "getItem">): PuzzleDef[] {
  return readStored(storage).puzzles;
}

/** Session ids already harvested, so evicted puzzles are not re-added. */
export const MAX_PROCESSED = 500;

export function writeStored(storage: Pick<Storage, "setItem">, data: Stored): boolean {
  try {
    storage.setItem(PUZZLES_KEY, JSON.stringify(serializePuzzleStore(data)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge new puzzles into storage, newest first, and mark `processed` session
 * ids as harvested. False when the write failed.
 */
export function addPuzzles(
  storage: Pick<Storage, "getItem" | "setItem">,
  fresh: readonly PuzzleDef[],
  processed: readonly string[] = [],
): boolean {
  const stored = readStored(storage);
  return writeStored(storage, {
    puzzles: mergePuzzles(fresh, stored.puzzles),
    processed: [...new Set([...stored.processed, ...processed])],
  });
}

/**
 * Harvest every replayable session not yet processed (restored by import, or
 * recorded before harvesting existed), oldest first so the newest end up on
 * top, then return the stored puzzles. Nothing is marked processed when the
 * write fails, so the next load retries.
 */
export function reconcileHarvest(
  storage: Pick<Storage, "getItem" | "setItem">,
  records: readonly SessionRecord[],
): PuzzleDef[] {
  const stored = readStored(storage);
  const done = new Set(stored.processed);
  const todo = records
    .filter((r) => r.replay && !done.has(r.id))
    .sort((a, b) => a.endedAt - b.endedAt);
  if (todo.length === 0) return stored.puzzles;
  let puzzles = stored.puzzles;
  for (const r of todo) {
    try {
      puzzles = mergePuzzles(harvestRecord(r), puzzles);
    } catch {
      // A bad record costs only its own puzzles.
    }
  }
  writeStored(storage, {
    puzzles,
    processed: [...stored.processed, ...todo.map((r) => r.id)],
  });
  return puzzles;
}
