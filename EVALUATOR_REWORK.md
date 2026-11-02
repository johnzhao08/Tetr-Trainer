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
