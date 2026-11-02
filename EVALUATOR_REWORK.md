# LST evaluator rework checkpoint

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
