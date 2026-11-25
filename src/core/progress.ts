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
  { label: string; better: "higher" | "lower"; format: (n: number) => string }
> = {
  pps: { label: "PPS", better: "higher", format: fixed(2) },
  app: { label: "APP", better: "higher", format: fixed(2) },
  apm: { label: "APM", better: "higher", format: fixed(1) },
  finesse: { label: "Finesse", better: "higher", format: percent },
  kpp: { label: "KPP", better: "lower", format: fixed(2) },
  piecesPerGarbage: {
    label: "Pieces per garbage line",
    better: "lower",
    format: fixed(2),
  },
  garbageShare: { label: "Garbage share", better: "higher", format: percent },
  holesPer100: { label: "Holes per 100", better: "lower", format: fixed(1) },
  maxB2b: { label: "Max B2B", better: "higher", format: whole },
  timeMs: { label: "Time", better: "lower", format: clock },
  pieces: { label: "Pieces", better: "higher", format: whole },
  lines: { label: "Lines", better: "higher", format: whole },
  attack: { label: "Attack", better: "higher", format: whole },
  tsdRate: { label: "TSD rate", better: "higher", format: percent },
  score: { label: "Score", better: "higher", format: whole },
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

function parseProgress(value: unknown): Progress | null {
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
  return { version: 1, sessions: capSessions(sessions) };
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

// Idempotent by id: recording an id already present replaces that record, so
// it never counts twice toward caps or recent-N gates.
export function recordSession(p: Progress, s: SessionRecord): Progress {
  const sessions = [...p.sessions.filter((x) => x.id !== s.id), s].sort((a, b) => a.endedAt - b.endedAt);
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

function bestOf(values: number[], metric: MetricId): number | null {
  if (values.length === 0) return null;
  return METRIC_INFO[metric].better === "higher"
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
  opts: { completedOnly?: boolean } = {},
): number | null {
  return bestOf(
    pick(sessionsFor(p, drillId), metric, opts.completedOnly ?? false),
    metric,
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
  // Only sessions with pps >= minPps count (e.g. APP at a target speed).
  minPps?: number;
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
        (s.metrics.pps !== undefined && s.metrics.pps >= minPps)),
  );
  const values = pick(eligible, gate.metric, true);
  let value: number | null;
  if (gate.over === "best") value = bestOf(values, gate.metric);
  else {
    const n = Math.max(1, Math.floor(gate.over.recent));
    value = values.length >= n ? averageOf(values.slice(0, n)) : null;
  }
  if (value === null) return { gate, value, met: false, progress: 0 };
  const higher = METRIC_INFO[gate.metric].better === "higher";
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

export function importProgress(text: string): Progress | null {
  try {
    return parseProgress(JSON.parse(text));
  } catch {
    return null;
  }
}
