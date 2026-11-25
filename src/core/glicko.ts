// Glicko-2 (Glickman, "Example of the Glicko-2 system", 2013).
export type Glicko = { rating: number; rd: number; vol: number };
export type GameResult = {
  opponent: Pick<Glicko, "rating" | "rd">;
  score: 0 | 0.5 | 1;
};

export const TAU = 0.5;
export const DEFAULT_RATING = 1500;
export const DEFAULT_RD = 350;
export const DEFAULT_VOL = 0.06;
/** Storage bounds: update clamps its output so it always persists. */
export const MIN_RATING = 0;
export const MAX_RATING = 4000;
export const MAX_VOL = 1;
const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));
/**
 * Puzzles are measuring sticks, not competitors: once an item has been rated
 * once, its RD is capped here so later attempts nudge it only a little and a
 * few lucky or unlucky players cannot swing it.
 */
export const PUZZLE_RD_CAP = 80;

const SCALE = 173.7178;
const EPSILON = 1e-6;

export function newGlicko(): Glicko {
  return { rating: DEFAULT_RATING, rd: DEFAULT_RD, vol: DEFAULT_VOL };
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / Math.PI ** 2);
const expected = (mu: number, muJ: number, phiJ: number) =>
  1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

function newVolatility(phi: number, vol: number, v: number, delta: number) {
  const a = Math.log(vol * vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (
      (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) -
      (x - a) / (TAU * TAU)
    );
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPSILON; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

/** One rating period. With no results only the RD grows (inactivity). */
export function update(player: Glicko, results: readonly GameResult[]): Glicko {
  const mu = (player.rating - DEFAULT_RATING) / SCALE;
  const phi = player.rd / SCALE;
  if (results.length === 0) {
    const rd = Math.min(
      DEFAULT_RD,
      Math.sqrt(phi * phi + player.vol * player.vol) * SCALE,
    );
    return { ...player, rd };
  }
  let invV = 0;
  let sum = 0;
  for (const r of results) {
    const muJ = (r.opponent.rating - DEFAULT_RATING) / SCALE;
    const phiJ = r.opponent.rd / SCALE;
    const e = expected(mu, muJ, phiJ);
    invV += g(phiJ) ** 2 * e * (1 - e);
    sum += g(phiJ) * (r.score - e);
  }
  const v = 1 / invV;
  const delta = v * sum;
  const vol = newVolatility(phi, player.vol, v, delta);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * sum;
  return {
    rating: clamp(muNew * SCALE + DEFAULT_RATING, MIN_RATING, MAX_RATING),
    rd: Math.min(DEFAULT_RD, phiNew * SCALE),
    vol: Math.min(MAX_VOL, vol),
  };
}

/**
 * A single player-vs-puzzle attempt (score is the player's). Both sides
 * update from the pre-attempt ratings; the puzzle's RD is then capped at
 * PUZZLE_RD_CAP so puzzles move slowly after their first rating.
 */
export function updateBoth(
  player: Glicko,
  item: Glicko,
  score: 0 | 0.5 | 1,
): { player: Glicko; item: Glicko } {
  const itemScore = (1 - score) as 0 | 0.5 | 1;
  const nextItem = update(item, [{ opponent: player, score: itemScore }]);
  return {
    player: update(player, [{ opponent: item, score }]),
    item: { ...nextItem, rd: Math.min(nextItem.rd, PUZZLE_RD_CAP) },
  };
}
