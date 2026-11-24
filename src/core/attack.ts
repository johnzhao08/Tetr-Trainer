export type Spin = "full" | "mini" | null;

/**
 * TETR.IO publishes no official attack table. These values come from the
 * halp1/triangle engine (src/engine/utils/damageCalc, TETRA LEAGUE preset,
 * Season 2 rules with spin bonuses "all-mini+"). Tables are indexed by lines
 * cleared (0-4).
 */
export const ATTACK_RULES = {
  base: {
    none: [0, 0, 1, 2, 4],
    mini: [0, 0, 1, 2, 10],
    full: [0, 2, 4, 6, 10],
  },
  /** Flat bonus while the B2B counter is above zero. */
  b2bBonus: 1,
  /** Combo multiplier is 1 + comboBonus * combo, floored by log1p(comboLog * combo) past combo 1. */
  comboBonus: 0.25,
  comboLog: 1.25,
  /** Added when a cleared row held garbage and the clear was a spin or a quad. */
  garbageBonus: 1,
  /** Surge is released when a B2B chain of at least this length breaks. */
  surgeMin: 4,
  allClear: 5,
} as const;

export type AttackInput = {
  lines: number;
  spin: Spin;
  /** Counter values before this lock; -1 means no chain. */
  b2b: number;
  combo: number;
  garbageCleared: boolean;
  allClear: boolean;
};

export type AttackResult = {
  /** Separate garbage packets in send order: surge parts, clear, all clear. */
  parts: number[];
  total: number;
  /** Counters after this lock. */
  b2b: number;
  combo: number;
  surge: number;
};

export function attackFor(input: AttackInput): AttackResult {
  const { lines, spin, allClear } = input;
  if (lines <= 0)
    return { parts: [], total: 0, b2b: input.b2b, combo: -1, surge: 0 };
  let b2b = input.b2b;
  let brokeFrom = -1;
  if (allClear || lines >= 4 || spin !== null) b2b++;
  else {
    brokeFrom = b2b;
    b2b = -1;
  }
  const combo = input.combo + 1;
  const c = Math.max(combo, 0);
  let g: number = ATTACK_RULES.base[spin ?? "none"][Math.min(lines, 4)];
  if (b2b > 0) g += ATTACK_RULES.b2bBonus;
  g *= 1 + ATTACK_RULES.comboBonus * c;
  if (c > 1) g = Math.max(Math.log1p(ATTACK_RULES.comboLog * c), g);
  const special =
    input.garbageCleared && (spin !== null || lines >= 4)
      ? ATTACK_RULES.garbageBonus
      : 0;
  const sent = Math.floor(g + special);
  const parts: number[] = [];
  const surge = brokeFrom >= ATTACK_RULES.surgeMin ? brokeFrom : 0;
  if (surge) {
    const third = Math.round(surge / 3);
    parts.push(third, third, surge - 2 * third);
  }
  if (sent > 0) parts.push(sent);
  if (allClear) parts.push(ATTACK_RULES.allClear);
  return {
    parts,
    total: parts.reduce((a, b) => a + b, 0),
    b2b,
    combo,
    surge,
  };
}
