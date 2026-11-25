import { cells } from "./board";
import type { Board } from "./board";
import type { Placement } from "./game";
import { cueSpan, STRUCTURES } from "./structures";

/**
 * Counts uses of a named structure from the placement log, with no search:
 * - `tst`: any full T-spin triple.
 * - Every other kind is a structure id. A use is the structure's own chain
 *   (full T-spins with its exact line counts, in order, within `WINDOW`
 *   pieces), where the structure's pre-clear cue held on the board before the
 *   first spin, and each follow-up lands in the columns that cue identified.
 *   Kaidan's chain is the TSD, then a quad the I drops down the reopened well.
 * Two unrelated spins, or a spin and a quad in another well, never count.
 * Each placement joins at most one use.
 */
export type StructureKind =
  | "tst"
  | "kaidan"
  | "stsd"
  | "triple-double"
  | "fractal"
  | "imperial-cross";

/** Pieces allowed between the first and second clear of a use. */
export const STRUCTURE_WINDOW = 6;

export type StructureHit = Pick<
  Placement,
  "index" | "type" | "landing" | "spin" | "cleared"
> & {
  /** The board before this piece locked. */
  before: Board;
};

const spin = (lines: number) => (p: StructureHit) =>
  p.type === "T" && p.spin === "full" && p.cleared === lines;

export function countStructure(
  log: readonly StructureHit[],
  kind: StructureKind,
): number {
  if (kind === "tst") return log.filter(spin(3)).length;
  const steps = STRUCTURES.find((s) => s.id === kind)!.chain.map((c) =>
    spin(c.lines),
  );
  if (kind === "kaidan") steps.push((p) => p.type === "I" && p.cleared === 4);
  let count = 0;
  for (let i = 0; i < log.length; i++) {
    const span = cueSpan(kind, log[i].before);
    if (!span || !steps[0](log[i])) continue;
    let done = 1;
    let last = i;
    for (let j = i + 1; j < log.length && done < steps.length; j++) {
      if (log[j].index - log[i].index > STRUCTURE_WINDOW) break;
      const at = cells(log[j].landing).some(([x]) => x >= span[0] && x <= span[1]);
      if (at && steps[done](log[j])) [done, last] = [done + 1, j];
    }
    if (done === steps.length) [count, i] = [count + 1, last];
  }
  return count;
}
