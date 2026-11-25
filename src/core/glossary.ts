import { METRIC_INFO } from "./progress";
import type { MetricId } from "./progress";

/** Terms shown in live stats that are not saved metrics. */
export type ExtraTerm = "vs" | "vsApm" | "b2b";
export type GlossaryId = MetricId | ExtraTerm;

const EXTRA: Record<ExtraTerm, { label: string; explain: string }> = {
  vs: {
    label: "VS",
    explain:
      "TETR.IO's versus score: (attack + garbage cleared) per second x 100. It rewards both offense and digging.",
  },
  vsApm: {
    label: "VS/APM",
    explain:
      "VS divided by APM. It sits near 2.0 to 2.1 at every rank, so the offense and defense mix barely changes up the ladder; throughput per piece and per second does.",
  },
  b2b: {
    label: "B2B",
    explain:
      "Back-to-back chain length. Quads and T-spins extend it; other line clears break it. Season 2 releases a stored Surge when a long chain breaks.",
  },
};

export function termLabel(id: GlossaryId): string {
  return id in EXTRA
    ? EXTRA[id as ExtraTerm].label
    : METRIC_INFO[id as MetricId].label;
}

export function explainTerm(id: GlossaryId): string {
  return id in EXTRA
    ? EXTRA[id as ExtraTerm].explain
    : METRIC_INFO[id as MetricId].explain;
}

/** Order of the home glossary: the headline numbers first. */
export const GLOSSARY_ORDER: readonly GlossaryId[] = [
  "app",
  "pps",
  "apm",
  "vs",
  "vsApm",
  "finesse",
  "kpp",
  "piecesPerGarbage",
  "garbageShare",
  "holesPer100",
  "tsdRate",
  "maxB2b",
  "b2b",
  "attack",
  "pieces",
  "lines",
  "timeMs",
  "violations",
  "score",
];
