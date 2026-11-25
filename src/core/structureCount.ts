import type { Placement } from "./game";

/**
 * A cheap, board-free detector for "you used the structure". It reads only the
 * placement log, so a drill can score it with no search:
 * - `tst`: full T-spin triples.
 * - `pair`: two full T-spin doubles-or-better within `WINDOW` pieces of each
 *   other (STSD, Fractal, Imperial Cross).
 * - `td`: a full T-spin double, then a full T-spin triple within `WINDOW`.
 * - `donation`: a full T-spin double, then a quad within `WINDOW` (the donated
 *   cover clears and the reopened well takes the I).
 * Each placement joins at most one use. It can credit a lucky pair that never
 * was the named structure; the drill's holes metric keeps that honest.
 */
export type StructureKind = "tst" | "pair" | "td" | "donation";

/** Pieces allowed between the first and second clear of a use. */
export const STRUCTURE_WINDOW = 6;

type Hit = Pick<Placement, "index" | "type" | "spin" | "cleared">;
const fullT = (p: Hit, lines: (n: number) => boolean) =>
  p.type === "T" && p.spin === "full" && lines(p.cleared);

export function countStructure(
  log: readonly Hit[],
  kind: StructureKind,
): number {
  if (kind === "tst") return log.filter((p) => fullT(p, (n) => n === 3)).length;
  const first = (p: Hit) =>
    fullT(p, (n) => (kind === "pair" ? n >= 2 : n === 2));
  const second = (p: Hit) =>
    kind === "pair"
      ? fullT(p, (n) => n >= 2)
      : kind === "td"
        ? fullT(p, (n) => n === 3)
        : p.cleared === 4;
  let count = 0;
  for (let i = 0; i < log.length; i++) {
    if (!first(log[i])) continue;
    for (let j = i + 1; j < log.length; j++) {
      if (log[j].index - log[i].index > STRUCTURE_WINDOW) break;
      if (second(log[j])) {
        count++;
        i = j;
        break;
      }
    }
  }
  return count;
}
