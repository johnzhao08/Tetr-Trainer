# Captured LST continuation failures

Captured from commit 411efe2 using the actual-control benchmark, seeds 1–3,
60-lock limit, 10,000 ms per job (no timeouts). JSON contains only the solver
snapshot and carried constructions, not hidden future pieces or randomizer state.

- lst-before-quad.json: seed 1 before lock 42 (zero-based index 41). Active I,
  held T. Baseline chooses a Quad followed by spending S on the right. Later
  stops at lock 44 after five TSDs. A TSD-first line exists that preserves S.
- lst-crowded-right.json: seed 3 at index 40. Baseline finds only unresolved
  six-lock lines. Increasing beam width from 8 to 32 and 256 at this position
  still leaves a hole: the weak decision is earlier, not simply this job's timer.

Capture all analyzed states with:

```
node /tmp/lst-benchmark.cjs 3 60 10000 --capture
```

The script writes /tmp/lst-seed-N.json. Follow the bundling command in its header.
These are regression evidence, not claims that a particular move is uniquely
optimal or that a stopped position is mathematically unsolvable.

- lst-after-readiness.json: seed 1 at index 51 after e4ed075, seven TSDs.
  Captured with 10,000 ms/job and no timeouts; this is the next unresolved
  continuation target, not a passing move-choice regression.
- lst-before-boundary-trap.json: the preceding L decision at index 48 on the
  same e4ed075 run. Use it to evaluate prevention, not just rejection at index 51.

- lst-lost-repair.json: b53e1aa seed 6, snapshots before index 9 and after
  index 10. Before holding L, a six-placement line repairs temporary holes.
  Recalculating after that placement pruned its repair tail. Regression checks
  preserve that tail and replay the resulting continuation through Game controls.

- lst-stale-construction.json: seed 3 before lock 22 (index 21). The repair-cache
  prototype merged superseded clear interpretations into the latest trace. The
  extra interpretation favored J on the right and the run stopped at lock 31,
  versus the baseline's 60. `oldStates` is the baseline's latest trace; `newStates`
  records the erroneous union. The regression replaces that union with the latest
  trace and checks the original central J placement.
