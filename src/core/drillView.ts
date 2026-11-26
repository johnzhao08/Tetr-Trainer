import { cells } from "./board";
import type { Board, Piece } from "./board";
import type { Band } from "./coach";
import { digText, isDigFlag } from "./dig";
import type { DrillFlag } from "./dig";
import type { DrillDef } from "./drill";
import type { EndReason } from "./drillSession";

export const BANDS: readonly Band[] = [
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
];
export const BAND_TEXT: Record<Band, string> = {
  best: "Best",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

export function flagText(flag: DrillFlag): string {
  if (isDigFlag(flag)) return digText(flag);
  switch (flag.kind) {
    case "hole":
      return flag.count > 1 ? `Created ${flag.count} holes` : "Created a hole";
    case "overhang":
      return "Overhang to fill later";
    case "spike":
      return "Height spike";
    case "two-wide":
      return "2-wide well";
    case "i-dependency":
      return "Needs an I piece";
    case "lost-tsd":
      return "Lost your TSD slot";
    case "high":
      return "Stack too high";
  }
}

export function bandCounts(reviews: readonly ({ band: Band } | undefined)[]) {
  const counts = Object.fromEntries(BANDS.map((b) => [b, 0])) as Record<Band, number>;
  for (const r of reviews) if (r) counts[r.band]++;
  return counts;
}

export function endText(end: DrillDef["end"]): string {
  const parts: string[] = [];
  if (end.pieces !== undefined) parts.push(`place ${end.pieces} pieces`);
  if (end.lines !== undefined) parts.push(`clear ${end.lines} lines`);
  if (end.garbage) parts.push("dig out all the garbage");
  if (end.opponentKO) parts.push("top out the opponent");
  if (end.timeMs !== undefined)
    parts.push(`survive ${Math.round(end.timeMs / 1000)} seconds`);
  const text = parts.join(", or ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rules that change how the drill plays, one short line each. */
export function constraintLines(def: DrillDef): string[] {
  const out: string[] = [];
  if (def.noHold) out.push("No hold: pressing hold counts as a violation.");
  if (def.quadsOnly)
    out.push("Quads only: clearing 1 to 3 lines without a spin is a violation.");
  if (def.failOn?.violations !== undefined)
    out.push(`Fails after ${def.failOn.violations} violations.`);
  if (def.targetPps !== undefined)
    out.push(
      `Pacer at ${def.targetPps.toFixed(1)} PPS. Slower runs do not count toward speed gates.`,
    );
  const o = def.options;
  if (o?.ppsCap)
    out.push(
      `Speed cap: ${o.ppsCap.toFixed(1)} PPS. A drop made early waits and locks when the cap allows.`,
    );
  if (o?.gravity) out.push("Gravity is on and pieces lock by themselves.");
  if (o?.cheese) out.push(`Garbage: ${o.cheese.total} lines to dig.`);
  if (o?.bot)
    out.push(
      `A bot plays its own board at ${o.bot.pps.toFixed(1)} PPS and sends you garbage.`,
    );
  if (o?.opponent)
    out.push(`An opponent sends garbage at about ${o.opponent.apm} APM.`);
  if (o?.openerPhase)
    out.push(
      `Opener phase: for the first ${o.openerPhase} pieces, each attack line cancels 2 incoming lines when you are behind.`,
    );
  if (o?.garbageIncrease)
    out.push(
      `After ${Math.round((o.garbageMarginMs ?? 180000) / 1000)} seconds all attack grows stronger every second.`,
    );
  if (def.startIncoming)
    out.push("Garbage is already on its way. Clear lines to cancel it.");
  if (def.failOn?.topOut === false) out.push("Topping out just ends the run.");
  return out;
}

export type Remaining = { label: string; value: string };

/** Progress toward each end condition, as "left" counters for the HUD. */
export function remaining(
  def: DrillDef,
  now: { pieces: number; lines: number; garbageCleared: number; elapsedMs: number },
): Remaining[] {
  const { end, options } = def;
  const out: Remaining[] = [];
  const left = (n: number) => String(Math.max(0, n));
  if (end.pieces !== undefined)
    out.push({ label: "Pieces left", value: left(end.pieces - now.pieces) });
  if (end.lines !== undefined)
    out.push({ label: "Lines left", value: left(end.lines - now.lines) });
  if (end.garbage && options?.cheese)
    out.push({
      label: "Garbage left",
      value: left(options.cheese.total - now.garbageCleared),
    });
  if (end.timeMs !== undefined) {
    const s = Math.max(0, Math.ceil((end.timeMs - now.elapsedMs) / 1000));
    out.push({
      label: "Time left",
      value: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
    });
  }
  return out;
}

export function paceText(delta: number): string {
  const n = Math.abs(delta).toFixed(1);
  return delta >= 0 ? `${n} pieces ahead` : `${n} pieces behind`;
}

export const END_TEXT: Record<EndReason, string> = {
  pieces: "All pieces placed.",
  lines: "Line goal reached.",
  garbage: "All garbage cleared.",
  time: "Time is up.",
  timeout: "Time up: no KO.",
  opponentKO: "The opponent topped out. You win.",
  topOut: "You topped out.",
  violations: "Too many violations.",
};

/**
 * Top-down text rows for MiniBoard: the stack plus two rows of headroom
 * (at least 6 rows). The landing cells are marked "*" as an outline.
 */
export function boardRows(board: Board, landing?: Piece): string[] {
  const target = new Set(
    landing ? cells(landing).map(([x, y]) => `${x},${y}`) : [],
  );
  let top = 0;
  board.forEach((row, y) => {
    if (row.some(Boolean) || row.some((_, x) => target.has(`${x},${y}`))) top = y;
  });
  const count = Math.min(board.length, Math.max(6, top + 3));
  const rows: string[] = [];
  for (let y = count - 1; y >= 0; y--)
    rows.push(
      Array.from({ length: 10 }, (_, x) =>
        target.has(`${x},${y}`) && !board[y][x] ? "*" : (board[y][x] ?? "."),
      ).join(""),
    );
  return rows;
}
