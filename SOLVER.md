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

LST uses the same worker, visible-only snapshot, hold handling and three
preview cards as 9–0, but its own engine. Its game presets only the first bag
(`I L Z S O J T`); every later bag is a normal seeded bag. Full T-spin doubles
(not minis or ordinary doubles) advance the stage counter. Source diagrams and
the reconstructed opening placements are in [LST_RESEARCH.md](LST_RESEARCH.md).

### Why it was replaced (2026-11-12)

The previous LST evaluator carried a set of "construction" hypotheses from
position to position and hard-rejected anything outside them: no T placement
except a ready double, no clear except a double or Quad, no recommendation at
all for a board it could not classify. In seeded self-play five of eight seeds
ran out of recommendations within 17–53 placements, typically after stacking
the right side into a tower and dropping an O on the rail. That code
(`lstConstruction`, `lstEvaluation`, `lstStructure`, `lstPatterns`,
`continuationCache`) is gone.

### Engine

- `bitboard.ts` stores each row as a 10-bit mask and generates every resting
  placement reachable with left/right, the three rotations (SRS+ kicks) and
  soft drop, including the T-spin class of the final rotation. It is the same
  closure as `placements.ts` without input paths; randomized tests compare the
  two for both soft-drop modes.
- `lstEval.ts` reads the structure directly from the board on every call.
  Nothing is carried between positions, so any board the player reaches is
  evaluated on its own terms.
- `lstSearch.ts` runs a 140-wide beam over every visible piece: active, five
  previews and hold, up to seven placements (the last may swap an unseen piece
  into hold). Positions with the same stack, hold and queue index are merged.
  The six best first placements always keep a few candidates so three distinct
  alternatives survive. Chosen lines are replayed on the real board through
  `reachablePlacements`, which supplies the exact input path; a line that
  cannot be reproduced is dropped.

A typical analysis expands 30–40 thousand positions in roughly 60 ms on the
development machine, against a 1,500 ms worker budget. Completed rounds are
streamed only when a search runs longer than 150 ms; a timeout keeps the last
completed round as provisional and never publishes a partial round.

### How the board is read

Zero-based columns: 0–1 are the L/S rail, 2 is the open well, 3–4 the boundary
and 5–9 free stacking. A slot at pivot row `p` is the reverse T at
`(1..3, p)` and `(2, p-1)`.

- **Rail and slots.** A slot row is a rail row whose column 1 is empty. It is
  usable when its base row exists, the well is open, `(3, p)` is empty and a T
  can still get in: from the right when the rail roofs it (column 3 must be
  empty above), or from the left when the boundary roofs it at `(3, p+1)`.
  Slots are checked top-down, because a slot stacked directly on another uses
  the lower slot's roof row as its own base and clears it first.
- **Holes.** Any covered empty cell outside the well and outside a usable
  slot. A slot that cannot be used (boundary cell filled, both roofs, column 3
  built over it) is therefore counted as a hole.
- **Debt.** Every empty right-side cell at or below the next slot row, plus
  the missing roof. This is what stops the rail racing ahead of the stack.
- **Deficit and trench.** After the pending doubles, the boundary dictates the
  lowest row the next slot can use. If the rail's next piece would open a slot
  below that, the difference is charged as rows of filler. A base cell in
  column 3 that column 4 has already walled off is a trench.
- **Surface and height.** Roughness, cliffs and deep wells on columns 4–9,
  total and maximum height, the right side standing well above the rail, and a
  quadratic danger term above row 11. Completed well-only rows count as
  progress toward a corrective Quad.

### Path costs

| Event in a line                                        | Cost |
| ------------------------------------------------------ | ---: |
| Full T-spin double                                     | −900 |
| Quad                                                   | −650 |
| Any other line clear                                   | +160 |
| T placed anywhere but a double                         | +450 |
| Piece other than L/S touching the rail columns         | +500 |
| Placement that needs a tuck or slide instead of a drop |  +30 |

Equal-cost lines keep the beam's order, which favours the line whose earlier
positions were better; an explicit "fewer holds" tie-break measurably hurt
play and is only used to order the forced opener.

These are costs, not bans. With nothing better available the engine still
recommends the least damaging move, and the card says the line is a recovery
line (it ends with a hole, blocked well, broken rail or trench).

While the board is still a prefix of the flat-top diagram and no double has
been scored, only the diagram's placements are searched. After a misdrop the
general search takes over immediately.

### Measured behaviour

`scripts/lstBenchmark.ts` follows the first suggestion through real game
inputs:

```sh
npx esbuild scripts/lstBenchmark.ts --bundle --platform=node --outfile=/tmp/lst-benchmark.cjs
node /tmp/lst-benchmark.cjs 8 300
```

| Run                                   | Result                                             |
| ------------------------------------- | -------------------------------------------------- |
| Previous solver, seeds 1–8, 100 locks | 3 seeds reached 100; 5 stopped at 17–53 placements |
| New engine, seeds 1–8, 300 locks      | all reached 300; 36–40 doubles and 6–9 Quads each  |
| New engine, seeds 1–40, 500 locks     | no top-outs; 13.0 doubles per 100 pieces; max height 16 |

One T arrives every seven pieces, so 14.3 doubles per 100 is the ceiling.
About 9% of T pieces are still placed without a spin and roughly two non-LST
line clears happen per 100 pieces, usually when the rail's next L or S arrives
late in a bag. Seeds 21–40 were never used for tuning and score the same as
seeds 1–20. Timings are from one machine and are not portable guarantees.

### Limits

The search sees only the visible pieces and scores the leaf heuristically; it
does not sample unseen bags. Weights were tuned on seeded self-play, not on
human games. Finesse is not part of the search score beyond the tuck cost; the
displayed input count is computed afterwards for the chosen lines. The engine
does not try to preserve back-to-back beyond the fixed cost on non-LST clears.
