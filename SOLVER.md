# 9–0 live solver

Open **9–0 stacking** from the home screen. It owns a separate free-play Game instance and uses the existing input, settings, hold, pause, undo, restart and top-out rules. Settings remains the shared rightmost header button. Suggestions never play moves into the user's game.

## Information and update boundary

Analysis captures the board, active pose, hold availability/piece, and **only the five displayed next pieces**. It never receives a randomizer seed or hidden queue. A hold of an empty slot consumes one visible piece; a swap does not. Search stops when the next active piece is unknown. This can shorten a continuation to five placements when a known piece remains in hold.

Entry, locks, hold, undo and restart produce analysis snapshots. Movement, rotation, soft drop, elapsed time and pause do not. Suggestions remain relative to the last snapshot even after the player moves the piece. Changing well mode or soft-drop mode also recomputes analysis.

Each job runs in a Web Worker with a 1,500 ms search budget. New input snapshots terminate obsolete workers, and request IDs/cleanup guards reject stale responses. Errors leave gameplay operational. Returning Home stops the worker and retains the isolated paused game in memory; reload discards it.

## Reachable placements

A breadth-first search explores left/right, CW, CCW, 180 and soft-drop transitions using `board.ts` directly. With finite soft drop it also explores single-row descent. Every proposed lock is grounded and reached from the starting pose; arbitrary geometric fits are not accepted. Grounded movement and SRS+ kicks allow tucks and spins of every piece, without introducing any spin-score bonus.

Input effort now uses shortest-path **tap/DAS finesse**: a tap, horizontal DAS to an obstruction, CW/CCW/180 rotation, or soft-drop hold costs one input. Hard drop adds one, and hold adds one when used. The final descent is hard drop, not an extra soft drop. Finite soft drop may stop after any reachable number of rows for one held input; instant soft drop goes to rest. Unit-cost BFS minimizes this count for each occupied-cell placement and preserves its executable action path, including tucks and spins. The displayed continuation total sums those minima and holds.

This is a standard discrete finesse model, not timing simulation: it does not model charged DAS continuing through rotations, input carryover between pieces, or precisely timed partial horizontal auto-repeat. It does not count the player's actual mistakes. Standard finesse references often exclude hard drop; this UI includes hard drop and hold in its minimum-input total.

## Search and ranking

Search retains up to 16 distinct first placements and two continuations per first placement, expanding through up to six locks. Occupied-cell-equivalent first placements count as one alternative, even if different hold routes reach them. Equivalent board/hold/queue states are merged. If any required search round is interrupted, the result is marked incomplete and contains no recommendation lines. The UI withholds preview cards instead of falling back to a shallower completed round. Exhausting the visible queue legitimately (including empty hold) is distinct from timing out.

This is a bounded heuristic beam search, not exhaustive proof or a trained evaluator. Pruning can miss the best repair, and a shorter known-piece continuation may be compared with a deeper one; each card reports its actual depth. If the time budget cannot find a safe continuation, the UI says so rather than inventing a move.

Intermediate surfaces now accumulate roughness (3 per height difference) half the dependency penalty, and four times the whole-stack height imbalance at each lock, so placement order affects rankings even when continuations finish similarly. Terminal evaluation also penalizes single-column surface notches: depth two costs 24; depth three costs 80, plus 40 for each additional row. The intended edge well is excluded. These are geometric dependency heuristics (including J/L-shaped edge access and I-sized deep slots), not claims that only one tetromino can ever repair every cavity; the reachable-move search still determines actual repairs.

Height imbalance is the sum of squared deviations from the mean of the nine stack heights (the intended well is excluded). Unlike adjacent roughness, it distinguishes a tall ramp from a level stack. It is charged throughout the path so a near-term Quad does not cheaply erase a spiky build-up. Terminal imbalance has weight two; this remains a heuristic tradeoff, not a hard rule against tall placements when needed for survival.

Current lower-is-better penalties:

| Feature                                             |                       Penalty |
| --------------------------------------------------- | ----------------------------: |
| Empty cell below a filled cell in its column        |                         2,000 |
| Occupied cell in the chosen edge well               |                           650 |
| Height above row 14                                 |   250 × excess height squared |
| Sum of nine stack heights                           |                       2 × sum |
| Maximum height                                      |                    4 × height |
| Adjacent height differences across the nine columns |          3 × total difference |
| Whole-stack height imbalance                        | 2 × sum of squared deviations |
| Quad                                                |                          −240 |
| Other clears                                        |                     90 × rows |
| Temporary holes in intermediate states              |     12 per hole per placement |
| Minimum tap/DAS inputs                              |                0.5 per action |

Terminal holes carry the full penalty. An actual searched repair can remove that terminal penalty; cavities receive no speculative discount just because a spin might exist. Ordinary clears remain available for survival. Known next-piece spawn collisions are rejected. Unknown-piece outcomes cannot be proven safe. Weights are initial engineering heuristics, not calibrated playing-strength claims.

Auto well selection defaults right. A clear established edge well is retained; the opposite side is selected only when its gap and relative height give strong evidence. Left/Right overrides bypass inference. Geometry is evaluated directly; kick tables are never mirrored heuristically.

## Previews

Three cards show different first-placement alternatives with translucent colored SVG pieces and move numbers. Overlays lift each later placement by the cumulative number of cleared rows, keeping it visible relative to the original stack. They are **not a simultaneous final board** when lines clear. The piece sequence marks clears. Hover, keyboard focus, or touch reveals playback controls. Playback alternates between the planned placement and the exact board after locking/clearing, and shows hold and action-path instructions. Overlay restores the default composite view. Preview interactions do not send gameplay shortcuts.

## Verification and deferred work

Run `npm run check`. Tests replay reachable paths, cover the independent T/S/Z spin fixtures and sealed cavities, visible-only queues, hold consumption, ranking priorities, left/right inference, deadlines, snapshot timing, and spin-based hole repair. Browser checks cover actual workers, rapid refresh, cancellation, independent playback, override controls, keyboard isolation, responsive layout and error recovery.

No run review, persisted analysis history, automatic placement, configurable scoring weights, solver service or external dependency is introduced. Search strength and weight tuning should be evaluated against representative user positions before treating the suggestions as coaching authority.

## LST module

LST uses the same worker, visible-only queue, hold search, finesse paths and three previews. Its separate game presets only `I L Z S O J T`; every later bag is a normal seeded bag. Restart restores that first bag; undo restores the full-TSD count. Full TSDs, rather than ordinary doubles or minis, advance the opening stage. The source diagrams, independently reconstructed placements, alternatives and known structural traps are documented in [LST_RESEARCH.md](LST_RESEARCH.md).

The first stage uses the source flat-top piece roles. The second guides the left-side T cavity while leaving the right five columns free. Thereafter the evaluator searches candidate central TSD cavities, preserves column 3 (one-based), softly favors the five-row LST scaffold, and penalizes unrelated holes and uneven right-side stacking. Search tracks actual rotation outcomes through the shared classifier; only a full T-spin clearing two rows receives the TSD reward. Corrective Quads remain available.

This is a bounded heuristic LST planner, not an exhaustive LST solver. The researched three-bag acceptance example reaches three full TSDs by following fresh recommendations after every lock. Random later bags, advanced substitutions, Fractal timing, and the source's future-continuation traps are not all guaranteed solved. Partial-cavity evaluation is a construction heuristic; a spin reward always requires an actual reachable rotation/lock. The interface states this limitation and allows normal undo/restart. No hidden future bag is supplied to analysis.

## Construction evaluator (2026-11-01)

The following supersedes the historical finite-pattern and dependency-growth
filters described in earlier commits. Production search no longer imports
`lstStructure.ts`; that file remains only as a legacy regression reference.

`lstConstruction.ts` represents several possible scaffolds using support cells
and protected empty cells. It derives repeating phases and lower TSD residues,
not a whitelist of complete pure/mixed boards. Right-side piece identities are
unrestricted. Local missing left-rail cells consider L/S; right support considers
all non-T pieces. These fits are optimistic geometry, not a proof of reachability
or a promise that the visible queue supplies the needed pieces.

Each search node carries its constructions. A placement that violates every
carried interpretation is excluded. Actual completed rows transform the remaining
support/cavity coordinates; the search cannot select a new phase to excuse a
conflicting placement. Multiple pending cavities are represented. A positive
asymmetric-roof fixture reaches two successive full TSDs through real SRS+ paths;
a symmetric blocked roof is not an executable substitute.

At an unfamiliar starting board, inference is bounded to two lower clear residues
in the first eight rows above complete I-Quad bands. Failure to recognize a board
is explicitly unknown, not proof that LST is impossible. Unrecognized candidates
can be explored but are labeled exploratory. Recognized constructions with
unfillable support or unintended holes are labeled unresolved. The UI never calls
either class a verified continuation.

LST ranking compares recognition, geometric impossibilities, unintended holes,
and well obstruction before weighted board quality, clears, and finesse. Missing
support is a cost rather than immediate rejection. The actual visible-piece/hold
search consumes each piece once and checks reachable locks, so searched repairs
are joint action sequences rather than independent imaginary fills. A terminal
increase in notch penalties no longer deletes a continuation outright. Right-side
roughness, notches, height imbalance and height remain weighted preferences.

LST retains up to 24 distinct first placements and eight candidates per group;
construction identity is included in deduplication. Per-job reachability and
evaluation caches avoid repeating equivalent work. Completed rounds stream from
the worker; timeouts retain the last completed round as provisional. A partial
root or round is never published. This does not alter the 9-0 timeout contract.
The UI distinguishes a time limit, an unresolved construction and no retained
continuation. A completed bounded beam is not exhaustive search.

Construction interpretations for searched successor boards are transferred to
later jobs through a 64-board cache. The cache also retains up to three remaining
placement sequences per board, preferring longer sequences over shallow progress
reports. Each new job rechecks those sequences against the current visible queue,
hold availability, soft-drop mode and reachable SRS+ moves before retaining their
prefixes in the beam. This prevents a fresh search from pruning a previously found
repair solely because its intermediate board looks worse. Stale tails are hints,
never trusted moves; the normal time budget and completed-round rules still apply.
This prevents forgetting clear history and repair paths when following suggestions.
It is not a persistent full search tree. Obsolete
workers are still terminated; stale replies cannot update results or the cache.

### Reproduction and limits

`EVALUATOR_REWORK.md` records commits, verification and remaining work.
Run `npm run check` for regression checks. For repeated actual-control play:

```sh
npx esbuild scripts/lstBenchmark.ts --bundle --platform=node --outfile=/tmp/lst-benchmark.cjs
node /tmp/lst-benchmark.cjs 3 60 1500
```

The script uses only visible previews, follows the first construction-preserving
line (including explicitly provisional lines), and stops at unresolved evidence,
no continuation or the lock limit. It reports TSDs, timings and stop reasons.
A 30-placement sample of seeds 1–3 reached four TSDs on every seed. This is not
proof of sustained play for arbitrary bags. The longer sample and exact observed
limits are recorded in the checkpoint file.

Unseen-future sampling, exhaustive Fractal strategy, unrestricted recovery clears,
and full cross-job tree reuse remain outside this implementation. The six-lock
visible horizon and bounded initial inference can still miss valid continuations.

### Successor readiness

Construction evaluation also counts the cells still needed to complete the next
TSD's two rows, including freestyle columns and at least one roof corner. This
was previously lost when construction evidence replaced the generic cavity cost.
The count is geometric readiness, not proof of a reachable spin; actual spin and
lock validation remain in the move search. Recognition, impossible support,
unintended holes and well obstruction still rank ahead of this measure.

Ranking credits completed TSD milestones before comparing remaining support:
`supportDebt - 18 * fullTSDsCompletedInThisLine`. There are sixteen non-T support
cells plus one roof requirement, so completing a double cannot lose merely for
consuming its ready setup. An all-clear board has zero outstanding support debt,
preserving the corrective I Quad. Among equally viable milestones, readiness
precedes height, roughness, clear rewards and finesse. The captured seed-1
Quad-first position now recommends the available full TSD first.

### Boundary completion and packing flexibility

Boundary evidence now includes the adjacent freestyle column and the next roof
row. Individual fill options are checked in pairs: two missing cells cannot both
claim overlapping different tetrominoes; a single piece may cover both cells.
This is a local simultaneous-completion warning, not a proof that future clears
or every possible queue fail. The search can still resolve it with actual moves.
Candidate geometries are precomputed and rotational duplicates removed.

After structural risks and TSD progress, a soft tie-breaker favors a right side
that admits straightforward hole-free placements for more non-T piece types.
The count uses columns 4–10 (one-based) and includes an available corrective I
Quad. It is optimistic geometry, not SRS reachability, and does not forbid tucks
or spins. A flat floor admits I/J/L/O without holes but still needs shaping for
S/Z; this signal is distinct from flatness. Real recommended paths remain checked
by the existing SRS+ engine.
