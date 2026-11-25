// Fastest of several timed batches. Scheduling noise from other processes
// only ever makes a batch slower, so the minimum is the stable measure of a
// function's own cost.
export function bestBatchMs(run: () => void, batches = 3): number {
  let best = Infinity;
  for (let b = 0; b < batches; b++) {
    const t = performance.now();
    run();
    best = Math.min(best, performance.now() - t);
  }
  return best;
}
