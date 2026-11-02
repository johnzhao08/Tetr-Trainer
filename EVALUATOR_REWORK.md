# LST evaluator rework checkpoint

Latest resume point: see **Final validation after repair reuse** at the end.

Base: lst-doubling-fractals at 5709356. Keep gameplay, SRS+, reachable paths,
opening fixtures, worker isolation, and previews. Replace finite-mask rejection
and dependency-growth veto with construction-aware evaluation and search.

Acceptance:
- Model required empty cells separately from missing support and free right cells.
- Retain multiple construction interpretations; transform them on actual clears.
- Left L/S needs are geometric construction obligations, not J/Z requirements.
- Use actual visible-piece/hold search to satisfy obligations jointly.
- Preserve overhang consistency, pure/mixed substitutions, corrective Quads,
  and multiple pending cavities (late T); do not require a complete template.
- Rank structural viability ahead of clear rewards and finesse.
- Retain completed search rounds with explicit provisional status on timeout.
- Verify repeated fresh recommendations and report measured limitations.

Planned commits:
1. Construction model and independent positive/negative fixtures.
2. Integrate construction state, prioritized ranking, and search diversity/cache.
3. Progressive search/UI evidence, repeated-play verification and documentation.

Status: construction model implemented; 18 focused tests pass.
Next: integrate carried construction hypotheses and prioritized evidence into search.
The model infers at most two lower TSD residues initially (bounded inference),
then tracks actual clears without rephasing. Unknown structures must not be
reported as impossible. Local piece fits remain optimistic; search proves paths.

Deferred: hidden-queue access (never), sampled unseen futures, exhaustive proof,
and unrestricted non-LST recovery coaching. A bounded search is not proof of
impossibility; diagnostics must distinguish timeout from no retained solution.

Checkpoint 2: integrated construction propagation and lexicographic structural
ranking. Removed dependency-growth veto; added per-search reachability/evaluation
caches, 24 first-placement groups and eight continuations per group for LST.
Completed-round callback and provisional result contract added to core. Existing
9-0 timeout contract unchanged. 31 integration/regression tests pass, including
fresh recommendation playback through all three researched bags; TypeScript passes.
Next: wire progress/evidence UI, add deadline and repeated-seed tests, measure
limitations, then run full checks. Cross-job tree reuse is not implemented yet.

Checkpoint 3: worker streams completed rounds; timeout retains only a completed
round as explicitly provisional (never a partial root/round). UI distinguishes
recognized, unresolved and unrecognized structures, and no longer says no line
proves failure. Construction traces are reused across fresh jobs through a bounded
64-board cache; requests still terminate stale workers. This is interpretation
reuse, not a complete retained search tree. Added actual-control benchmark script.
159 tests, lint, production build pass. Browser verified real LST worker and cards.
Three seeds at 30 placements each reached four TSDs without stopping; mean analysis
326/649/480 ms locally, seed 2 had one provisional result. These timings are not
portable performance guarantees. Longer 60-placement sample is running.

Remaining limits: initial inference explores two lower clear residues and can
miss an unrepresented structure; carried interpretations avoid re-inference when
following searched continuations. Piece-fit obligations are optimistic until an
actual searched sequence satisfies them. Finesse and SRS+ paths unchanged. No
sampled unknown bags or full cross-job tree retention. Multiple pending cavities
are represented, but general Fractal strategy is not exhaustively verified.

## Current resume point

Core rework and integration are committed and runnable. Final checks: 160 tests,
lint, TypeScript and production build pass. Actual browser worker emitted complete
rounds at depths 1–6 with provisional status, then a final completed result; app
cards and evidence labels verified. Added reachable asymmetric two-cavity fixture
with two consecutive full TSDs. A symmetric roof blocks entry and must not be
used as a positive reachability example.

Longer actual-control benchmark, seeds 1–3, 60 locks, 1500 ms/job:

| Seed | Placements | Full TSDs | Mean ms | Stop |
| --- | ---: | ---: | ---: | --- |
| 1 | 44 | 5 | 425 | No retained continuation |
| 2 | 60 | 8 | 648 | Test lock limit |
| 3 | 40 | 5 | 418 | Unresolved construction |

All three longer runs had zero provisional jobs on this local run. Results are
bounded-heuristic evidence, not proof of arbitrary-bag sustainability. Seed 1's
stop does not establish an impossible board; seed 3 is deliberately not advertised
as a verified continuation. The 30-lock sample alone would hide these failures.

Next strengthening work, if resumed: reproduce seed 1 near lock 44 and seed 3 near
lock 40 with scripts/lstBenchmark.ts, capture full positions, distinguish beam
pruning from actual support conflicts, and add targeted regressions before tuning.
Do not reinstate the finite-pattern whitelist or dependency-growth veto. Consider
adaptive beam diversity/extension based on those failures; full cross-job tree
retention and sampled unseen futures are still deferred, not implemented claims.

## Follow-up: successor readiness

Committed capture tooling and exact baseline failures in a7a0e37. Investigated
beam widths 8/32/256 and multiple supply/height/diversity experiments. Broader
supply penalties and new balance/diversity choices regressed other seeds and
were discarded; they are not production behavior.

Kept fix: construction recognition had replaced generic cavity evaluation and
lost the required freestyle support for the next full double. Count all sixteen
support cells and one roof requirement. Rank readiness after existing structural
risks, credit each completed TSD by 18 so clearing a ready slot remains progress,
and give an all-clear board zero outstanding debt. Captured Quad-first choice now
uses a full TSD first. 162 tests, lint and build pass, including source TSDs,
corrective Quad and new support/roof tests.

Generous-budget 60-placement sample: seeds 1/2/3 now reach 51/60/60 placements and
7/9/8 TSDs, versus baseline 44/60/40 and 5/8/5. Normal 1500ms-budget validation is
finishing; seed 1 still has a retained-search dead end at placement 51. This is
progress, not proof of sustainable arbitrary-bag LST. Capture that exact remaining
failure before the next iteration; avoid claiming global reliability from three
seeds or increasing a penalty to hide the failure.

## Captured continuation after readiness fix

Normal 1500 ms budget reproduced 51/60/60 placements and 7/9/8 TSDs for seeds
1/2/3 (one provisional job on seed 1). The remaining seed-1 state is saved in
`tests/fixtures/lst-after-readiness.json`; its earlier L decision at index 48 is
`lst-before-boundary-trap.json`. These snapshots contain visible state only.

Investigation: right-boundary completion ignored adjacent column 6 and the next
roof row. In the failure, each missing cell has an individual geometric fit, but
fills for the lower support and next roof can compete for the same space. Stronger
pairwise evidence is being tested; do not conflate it with a full queue proof.
Current uncommitted work explores that check and a non-T packing-freedom tie-breaker.
The earlier broad supply/balance weight experiments were discarded.

## Completion/flexibility checkpoint (2026-11-02)

Implemented adjacent-column/next-roof completion evidence and pairwise checks for
mutually incompatible fills. The captured index-51 field has individual options
for every missing cell but one conflicting pair. Added a fast right-packing type
count as a soft tie-breaker after structural risks and TSD progress. This improves
choice flexibility; it is not a hard legality rule or a sampled future-bag proof.
Deduplicated geometric candidates avoid repeating O/I/S/Z rotational aliases.

164 tests, lint and production build pass. Final normal-budget seeded runs:

| Seed | Placements | TSDs | Mean ms | Provisional jobs | Stop |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 60 | 8 | 566 | 2 | Test limit |
| 2 | 60 | 9 | 763 | 0 | Test limit |
| 3 | 60 | 8 | 657 | 4 | Test limit |

This surpasses the previous 51/60/60 sample without treating unrecognized or
unresolved lines as successes. Three unused seeds (4–6) are the next validation.
Use `--start-seed=4` with scripts/lstBenchmark.ts to avoid rerunning earlier seeds.

## Repair continuity checkpoint (2026-11-02)

Unused-seed validation exposed a receding-horizon pruning failure: seed 6 had a
complete repair before placement 10, then discarded its remaining repair after
following that placement. Retain up to three tails per cached board and revalidate
them through the actual visible queue, hold and SRS+ placement search. Preserve
validated prefixes inside the normal beam. Shallow progress cannot erase longer
known tails; cache remains bounded to 64 boards. This is candidate reuse, not an
exhaustive retained search tree or a guarantee beyond visible pieces.

Regression checks cover the captured repair through actual Game inputs, an
unavailable piece, unavailable hold, and a deadline during seed validation.
168 tests pass across the full suite plus corrected focused replay assertion;
lint, TypeScript and production build pass. The assertion accounts for the game
retaining its last event indicator after a non-clearing lock.

Normal 1500 ms/job, unused seeds 4–6, 60-placement limit:

| Seed | Placements | TSDs | Mean ms | Provisional jobs | Stop |
| --- | ---: | ---: | ---: | ---: | --- |
| 4 | 21 | 2 | 561 | 0 | Unresolved construction |
| 5 | 52 | 7 | 896 | 14 | No retained continuation |
| 6 | 16 | 2 | 569 | 0 | No retained continuation |

Previously seed 6 stopped at 10 placements/one TSD; seeds 4/5 stopped at the same
points. Therefore the captured pruning defect is fixed, but arbitrary-bag LST
remains unsolved. Earlier-readiness baseline e4ed075 reached 60 on seed 5, so the
completion/flexibility changes also have a known broader-run weakness to diagnose;
do not hide this behind the passing first three seeds. Rechecking seeds 1–3 now.

Next work: capture the earliest decisions leading to these unused-seed stops,
distinguish structural-model limits from ranking/pruning, and add a regression
before changing preferences. Do not silently increase budgets or label unresolved
construction evidence as safe.

## Hold refresh and cache regression correction (2026-11-02)

The first repair-cache checkpoint exposed a regression on seed 3: merging old
projected clear interpretations with newer traces changed the index-21 J decision
and stopped the run at 31 locks. Captured the position and both interpretation
sets in `lst-stale-construction.json`. Restore latest-trace replacement (the
pre-cache behavior) instead of reviving superseded interpretations. Retain longer
repair paths separately. Exact move-choice regression now passes; normal-budget
seed 3 again reaches 60 placements/eight TSDs (730 ms mean, eight provisional jobs
in a run overlapping targeted tests; timings vary with machine load).

Retain the current plan as well as successor tails so holding does not erase it.
Validation recognizes an already-performed first hold and still regenerates all
legal moves. Unavailable pieces/holds remain rejected. Only construction-preserving
lines contribute repair tails. Fresh search runs first and uses a retained repair
only if it loses such a continuation and has budget remaining; retries share the
same total budget and supplement, rather than displace, their normal candidates.

170 tests pass; lint, TypeScript and production build pass. Browser verified real
worker requests after lock and hold with retained plans and correct canHold state,
followed by completed analysis cards. Benchmark now feeds streamed completed rounds
into the cache exactly as the hook does. The final six-seed 60-lock/1500-ms results are recorded below.


## Final validation after repair reuse

Implementation checkpoint: 6167389 (after 2cb7b5e). Clean checks: 170 tests, lint,
TypeScript and production build. Browser smoke check on final code confirmed
analysis after actual lock and hold, with no worker error. No changes to SRS+,
user bindings, hidden queue access, or the 9–0 search contract.

Final benchmark uses streamed completed-round cache updates, matching the UI,
with 60 locks maximum and the existing 1500 ms total budget per analysis:

| Seed | Placements | TSDs | Mean ms | Provisional jobs | Stop |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 60 | 8 | 573 | 2 | Test limit |
| 2 | 60 | 9 | 765 | 0 | Test limit |
| 3 | 60 | 8 | 661 | 4 | Test limit |
| 4 | 21 | 2 | 579 | 0 | Unresolved construction |
| 5 | 53 | 7 | 920 | 15 | No retained continuation |
| 6 | 17 | 2 | 667 | 1 | No retained continuation |

Three earlier passing runs remain passing. Repair reuse improves seed 6 from
10 placements/one TSD to 17/two, and seed 5 from 52 to 53 placements. It does not
solve arbitrary random bags. Seed 4's stop had no timeout, so adding time alone
cannot explain all failures. Seed 5 remains weaker than the e4ed075 readiness-only
baseline's 60 placements; the boundary/flexibility ranking needs further work.

Exact final failing snapshots, including cached construction and repair hints,
are saved in `tests/fixtures/lst-remaining-limits.json`. To reproduce fresh jobs,
use each entry's snapshot.position plus snapshot.initialConstructions/seedPlans
as analyze options with mode "lst" and budgetMs 1500. Use now: () => 0 to separate
pruning/model limits from deadlines. Full runs can be recreated with:

    node /tmp/lst-benchmark.cjs 6 60 1500 --capture

Bundle the script as described in SOLVER.md first. Full per-lock captures remain
in /tmp/lst-seed-N.json for this session; the committed final snapshots survive
usage interruptions. Next strengthening work should trace decisions before the
remaining stops, especially seed 4 without timeouts and seed 5's ranking weakness.
Do not reinstate blanket dependency vetoes or present unresolved evidence as safe.
