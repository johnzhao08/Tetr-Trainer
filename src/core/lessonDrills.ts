import type { DrillDef } from "./drill";
import type { StructureKind } from "./structureCount";

// One random-bag drill per structure lesson. The score is how many times you
// used the structure (see structureCount.ts); a lesson only counts the drill
// as done when holes per 100 pieces stay under LESSON_HOLE_CAP (lesson.ts).
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
    "kaidan",
    "a Kaidan donation",
    "A donation fixes parity and reopens the well. It counts when the Kaidan stair is on the board, a T-spin double clears the cover, and the I then quads down that well within six pieces.",
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
    "stsd",
    "stacked T-spin doubles",
    "Two doubles back to back need a second T soon or they leave a hole. It counts when the STSD space is on the board and two T-spin doubles in it land within six pieces.",
    "Count the Ts across hold, preview and the next bag before you start the stack.",
  ),
  structureDrill(
    "td-run",
    "Triple Double run",
    "triple-double",
    "a Triple Double",
    "A triple then a double from one setup sends 12 with B2B. It counts when the setup is on the board and a T-spin triple is followed by a double in it within six pieces.",
    "Start from a notch or a two-step stair, with a TSD slot above it.",
  ),
  structureDrill(
    "fractal-run",
    "Fractal run",
    "fractal",
    "a Fractal",
    "A Fractal fixes an overhang when no I is coming. It counts when the interlocked pockets are on the board and two T-spin doubles in them land within six pieces.",
    "Build on an existing TSD when no I is in sight.",
  ),
  structureDrill(
    "imperial-run",
    "Imperial Cross run",
    "imperial-cross",
    "an Imperial Cross",
    "An Imperial Cross fixes a bad TSD overhang when a Fractal cannot be built. It counts when the two stacked gaps are on the board and two T-spin doubles in them land within six pieces.",
    "Build the shifted overhang, then spin both gaps.",
  ),
];
