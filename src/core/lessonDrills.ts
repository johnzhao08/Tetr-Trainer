import type { DrillDef } from "./drill";
import type { StructureKind } from "./structureCount";

// One random-bag drill per structure lesson. The score is how many times you
// used the structure (see structureCount.ts); holes keep the stack honest.
function structureDrill(
  id: string,
  title: string,
  structure: StructureKind,
  what: string,
  why: string,
  tip: string,
): DrillDef {
  return {
    id,
    title,
    summary: `Use ${what} as often as the bags allow in 140 pieces.`,
    why,
    how: [
      tip,
      "Skip it when it would need a hole; winterNebs: never compromise your stack for T-spins.",
      "Watch the queue for the T pieces before you commit.",
    ],
    structure,
    end: { pieces: 140 },
    primary: "structureCount",
    metrics: ["structureCount", "holesPer100", "app", "maxB2b"],
  };
}

export const LESSON_DRILLS: readonly DrillDef[] = [
  structureDrill(
    "kaidan-run",
    "Kaidan run",
    "donation",
    "a Kaidan donation",
    "A donation fixes parity and reopens the well. It counts when a T-spin double is followed by a quad within six pieces.",
    "Cover the well with a stair, spin the cover away, then drop the I.",
  ),
  structureDrill(
    "tst-run",
    "TST run",
    "tst",
    "T-spin triples",
    "A triple sends 7 with B2B. It leaves an overhang to clean up, so use it only when it fits the stack better than a double.",
    "Look for a notch or a two-step stair before the T arrives.",
  ),
  structureDrill(
    "stsd-run",
    "STSD run",
    "pair",
    "stacked T-spin doubles",
    "Two doubles back to back need a second T soon or they leave a hole. It counts when two T-spin clears land within six pieces.",
    "Count the Ts in the next bag before you start the stack.",
  ),
  structureDrill(
    "td-run",
    "Triple Double run",
    "td",
    "a Triple Double",
    "A double then a triple from one setup sends 12 with B2B. It counts when a T-spin double is followed by a triple within six pieces.",
    "Start from a notch or a two-step stair, with a TSD slot above it.",
  ),
  structureDrill(
    "fractal-run",
    "Fractal run",
    "pair",
    "Fractals or Imperial Crosses",
    "Both end in two T-spin doubles and fix an overhang when no I is coming. It counts when two T-spin clears land within six pieces.",
    "Build on an existing TSD when no I is in sight.",
  ),
];
