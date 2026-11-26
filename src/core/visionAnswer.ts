/**
 * Decides when the find-slot board counts as answered. The first lock after
 * the question is on screen is the answer; a Reset piece (no locks yet) re-arms
 * it. Locks seen before the question is shown are never answered, so they
 * cannot silence later play.
 */
export function stepAnswerLatch(
  latched: boolean,
  ready: boolean,
  state: { pieces: number; status: string },
): { latched: boolean; judge: boolean } {
  if (state.pieces < 1 && state.status !== "over")
    return { latched: false, judge: false };
  if (!ready || latched) return { latched, judge: false };
  return { latched: true, judge: true };
}
