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

Status: planning checkpoint committed; implementation not started.
Next: derive a compact overhang/rail model from researched local phases and
validate all pure/mixed fixtures before replacing the production filter.

Deferred: hidden-queue access (never), sampled unseen futures, exhaustive proof,
and unrestricted non-LST recovery coaching. A bounded search is not proof of
impossibility; diagnostics must distinguish timeout from no retained solution.
