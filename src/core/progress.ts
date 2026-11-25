export type MetricId =
  | "pps"
  | "app"
  | "apm"
  | "finesse"
  | "kpp"
  | "piecesPerGarbage"
  | "garbageShare"
  | "holesPer100"
  | "maxB2b"
  | "timeMs"
  | "pieces"
  | "lines"
  | "attack"
  | "tsdRate"
  | "violations"
  | "score";
export type SessionRecord = {
  id: string;
  drillId: string;
  endedAt: number;
  durationMs: number;
  completed: boolean;
  metrics: Partial<Record<MetricId, number>>;
};
export type Progress = { version: 1; sessions: SessionRecord[] };

const fixed = (digits: number) => (n: number) => n.toFixed(digits);
// Ratios (finesse, garbageShare, tsdRate) are stored as fractions 0..1.
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const whole = (n: number) => String(Math.round(n));
function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 10));
  const cs = total % 100;
  const sec = Math.floor(total / 100) % 60;
  const min = Math.floor(total / 6000);
  return `${min}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export const METRIC_INFO: Record<
  MetricId,
  {
    label: string;
    better: "higher" | "lower";
    format: (n: number) => string;
    /** Plain-language meaning, with rank context where it helps. */
    explain: string;
  }
> = {
  pps: {
    label: "PPS",
    better: "higher",
    format: fixed(2),
    explain:
      "Pieces placed per second: your speed. The median ranked player (A) is near 1.3 PPS and X+ near 3.5. Below the median, efficiency matters more than speed; from SS (about 2.0 PPS) upward, speed becomes the bigger lever.",
  },
  app: {
    label: "APP",
    better: "higher",
    format: fixed(2),
    explain:
      "Attack per piece: how much garbage each piece sends, a measure of efficiency. The A median is about 0.38 and X+ about 0.87. Below the median, raising APP moves your rank the most.",
  },
  apm: {
    label: "APM",
    better: "higher",
    format: fixed(1),
    explain:
      "Attack per minute, equal to APP x PPS x 60. It mixes efficiency and speed, and rises about 27-fold from D (about 7) to X+ (about 180).",
  },
  finesse: {
    label: "Finesse",
    better: "higher",
    format: percent,
    explain:
      "Share of pieces placed with the fewest key presses. About a third of D players are perfect, two thirds at A and 97-99% at X. It is cheap to improve and nearly mandatory higher up.",
  },
  kpp: {
    label: "KPP",
    better: "lower",
    format: fixed(2),
    explain:
      "Key presses per piece. Lower is better: fewer presses means cleaner finesse and more time to think.",
  },
  piecesPerGarbage: {
    label: "Pieces per garbage line",
    better: "lower",
    format: fixed(2),
    explain:
      "Pieces used per garbage line cleared. Lower is better: it shows how efficiently you dig. Digging efficiency quadruples from D to U, then flattens.",
  },
  garbageShare: {
    label: "Garbage share",
    better: "higher",
    format: percent,
    explain:
      "Share of cleared lines that were garbage. Higher means more of your clears went into digging.",
  },
  holesPer100: {
    label: "Holes per 100",
    better: "lower",
    format: fixed(1),
    explain:
      "New holes the coach flagged per 100 pieces. Lower is better: every hole slows later placements.",
  },
  maxB2b: {
    label: "Max B2B",
    better: "higher",
    format: whole,
    explain:
      "Longest back-to-back chain reached. Quads and spin clears keep it alive and add bonus attack.",
  },
  timeMs: {
    label: "Time",
    better: "lower",
    format: clock,
    explain:
      "How long the drill took. For sprints, lower is better. Median 40-line times barely move from C to A (about 80 s), then fall to 18 s at X+, so pure speed pays little below the median.",
  },
  pieces: {
    label: "Pieces",
    better: "higher",
    format: whole,
    explain: "Pieces placed.",
  },
  lines: {
    label: "Lines",
    better: "higher",
    format: whole,
    explain: "Lines cleared.",
  },
  attack: {
    label: "Attack",
    better: "higher",
    format: whole,
    explain: "Total garbage lines your clears sent. APP is this divided by pieces.",
  },
  tsdRate: {
    label: "TSD rate",
    better: "higher",
    format: percent,
    explain:
      "T-spin doubles per bag of 7 pieces. A value near 100% is about one TSD per bag.",
  },
  violations: {
    label: "Violations",
    better: "lower",
    format: whole,
    explain:
      "Rule breaks in this drill, such as using hold in a no-hold drill or clearing fewer than four lines in a quad-only drill.",
  },
  score: {
    label: "Score",
    better: "higher",
    format: whole,
    explain: "The drill's headline number: its primary metric.",
  },
};

export const PROGRESS_KEY = "tetr-trainer.progress.v1";
export const MAX_PER_DRILL = 40;
export const MAX_TOTAL = 600;

export function emptyProgress(): Progress {
  return { version: 1, sessions: [] };
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isNonNeg = (v: unknown): v is number => isNum(v) && v >= 0;

// Metrics stored as fractions that must stay within 0..1. tsdRate is a
// per-bag rate and may exceed 1.
const FRACTION_METRICS: ReadonlySet<MetricId> = new Set([
  "finesse",
  "garbageShare",
]);

function parseSession(value: unknown): SessionRecord | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  if (typeof s.id !== "string" || s.id === "") return null;
  if (typeof s.drillId !== "string" || s.drillId === "") return null;
  if (!isNonNeg(s.endedAt) || !isNonNeg(s.durationMs)) return null;
  if (typeof s.completed !== "boolean") return null;
  if (!s.metrics || typeof s.metrics !== "object" || Array.isArray(s.metrics))
    return null;
  const metrics: Partial<Record<MetricId, number>> = {};
  for (const [key, n] of Object.entries(s.metrics)) {
    if (!Object.hasOwn(METRIC_INFO, key) || !isNonNeg(n)) return null;
    if (FRACTION_METRICS.has(key as MetricId) && n > 1) return null;
    metrics[key as MetricId] = n;
  }
  return {
    id: s.id,
    drillId: s.drillId,
    endedAt: s.endedAt,
    durationMs: s.durationMs,
    completed: s.completed,
    metrics,
  };
}

// Sessions are kept oldest first; drops the oldest beyond each cap.
function capSessions(sessions: SessionRecord[]): SessionRecord[] {
  const seen = new Map<string, number>();
  const keep: SessionRecord[] = [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    const count = seen.get(sessions[i].drillId) ?? 0;
    seen.set(sessions[i].drillId, count + 1);
    if (count < MAX_PER_DRILL) keep.push(sessions[i]);
  }
  keep.reverse();
  return keep.slice(Math.max(0, keep.length - MAX_TOTAL));
}

function parseProgressCounted(
  value: unknown,
): ImportResult | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (p.version !== 1 || !Array.isArray(p.sessions)) return null;
  const ids = new Set<string>();
  const sessions: SessionRecord[] = [];
  for (const raw of p.sessions) {
    const s = parseSession(raw);
    if (!s || ids.has(s.id)) continue;
    ids.add(s.id);
    sessions.push(s);
  }
  sessions.sort((a, b) => a.endedAt - b.endedAt);
  const kept = capSessions(sessions);
  return {
    progress: { version: 1, sessions: kept },
    accepted: kept.length,
    skipped: p.sessions.length - sessions.length,
    trimmed: sessions.length - kept.length,
  };
}

function parseProgress(value: unknown): Progress | null {
  return parseProgressCounted(value)?.progress ?? null;
}

export function loadProgress(storage: Pick<Storage, "getItem">): Progress {
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (raw === null) return emptyProgress();
    return parseProgress(JSON.parse(raw)) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(
  storage: Pick<Storage, "setItem">,
  p: Progress,
): boolean {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

// Idempotent by id: recording an id already present replaces that record in
// place (sort is stable, so equal timestamps keep their order) and it never
// counts twice toward caps or recent-N gates. Invalid records are ignored, so
// a bad retry cannot replace a valid session.
export function recordSession(p: Progress, s: SessionRecord): Progress {
  const valid = parseSession(s);
  if (!valid) return p;
  const index = p.sessions.findIndex((x) => x.id === valid.id);
  const sessions =
    index < 0
      ? [...p.sessions, valid]
      : p.sessions.map((x, i) => (i === index ? valid : x));
  sessions.sort((a, b) => a.endedAt - b.endedAt);
  return { version: 1, sessions: capSessions(sessions) };
}

// Newest first.
export function sessionsFor(p: Progress, drillId: string): SessionRecord[] {
  return p.sessions.filter((s) => s.drillId === drillId).reverse();
}

function pick(
  sessions: SessionRecord[],
  metric: MetricId,
  completedOnly: boolean,
): number[] {
  const values: number[] = [];
  for (const s of sessions) {
    const v = s.metrics[metric];
    if (v !== undefined && (!completedOnly || s.completed)) values.push(v);
  }
  return values;
}

/** Which direction wins: an explicit override, else the metric's own. */
export function betterOf(
  metric: MetricId,
  override?: "higher" | "lower",
): "higher" | "lower" {
  return override ?? METRIC_INFO[metric].better;
}

function bestOf(
  values: number[],
  metric: MetricId,
  better?: "higher" | "lower",
): number | null {
  if (values.length === 0) return null;
  return betterOf(metric, better) === "higher"
    ? Math.max(...values)
    : Math.min(...values);
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function best(
  p: Progress,
  drillId: string,
  metric: MetricId,
  opts: { completedOnly?: boolean; better?: "higher" | "lower" } = {},
): number | null {
  return bestOf(
    pick(sessionsFor(p, drillId), metric, opts.completedOnly ?? false),
    metric,
    opts.better,
  );
}

export function recentAverage(
  p: Progress,
  drillId: string,
  metric: MetricId,
  n: number,
): number | null {
  if (!(n >= 1)) return null;
  return averageOf(
    pick(sessionsFor(p, drillId), metric, true).slice(0, Math.floor(n)),
  );
}

export type Gate = {
  drillId: string;
  metric: MetricId;
  target: number;
  over: "best" | { recent: number };
  label?: string;
  // Overrides the metric's usual direction for this gate.
  better?: "higher" | "lower";
  // Only sessions with pps >= minPps count (e.g. APP at a target speed).
  minPps?: number;
  // Only sessions where each of these metrics is recorded as 0 count, e.g.
  // `violations` for a quad-only run. Sessions missing the metric do not count.
  requireZero?: MetricId[];
};
export type GateStatus = {
  gate: Gate;
  value: number | null;
  met: boolean;
  progress: number;
};

const clamp01 = (n: number) =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

// Gates count completed sessions only. A recent-N gate has no value until N
// qualifying sessions exist.
export function evaluateGate(p: Progress, gate: Gate): GateStatus {
  const minPps = gate.minPps;
  const eligible = sessionsFor(p, gate.drillId).filter(
    (s) =>
      s.completed &&
      (minPps === undefined ||
        (s.metrics.pps !== undefined && s.metrics.pps >= minPps)) &&
      (gate.requireZero ?? []).every((m) => s.metrics[m] === 0),
  );
  const values = pick(eligible, gate.metric, true);
  let value: number | null;
  if (gate.over === "best") value = bestOf(values, gate.metric, gate.better);
  else {
    const n = Math.max(1, Math.floor(gate.over.recent));
    value = values.length >= n ? averageOf(values.slice(0, n)) : null;
  }
  if (value === null) return { gate, value, met: false, progress: 0 };
  const higher = betterOf(gate.metric, gate.better) === "higher";
  // Tolerate float rounding (e.g. 0.6 / 0.7 style averages) at the boundary.
  const eps = 1e-9 * Math.max(1, Math.abs(gate.target));
  const met = higher ? value >= gate.target - eps : value <= gate.target + eps;
  let progress: number;
  if (met) progress = 1;
  else if (higher)
    progress = gate.target > 0 ? clamp01(value / gate.target) : 0;
  else progress = value > 0 ? clamp01(gate.target / value) : 0;
  return { gate, value, met, progress };
}

export function exportProgress(p: Progress): string {
  return JSON.stringify(p, null, 2);
}

export type ImportResult = {
  progress: Progress;
  accepted: number;
  /** Invalid or duplicate records that were left out. */
  skipped: number;
  /** Valid records dropped by the per-drill and total retention caps. */
  trimmed: number;
};

/**
 * Like importProgress, with counts. Null when the text is not progress data,
 * or when it held records but none of them were valid, so a bad file can
 * never replace real history with nothing.
 */
export function importProgressCounted(text: string): ImportResult | null {
  try {
    const result = parseProgressCounted(JSON.parse(text));
    if (!result) return null;
    if (result.accepted === 0 && result.skipped > 0) return null;
    return result;
  } catch {
    return null;
  }
}

export function importProgress(text: string): Progress | null {
  try {
    return parseProgress(JSON.parse(text));
  } catch {
    return null;
  }
}
