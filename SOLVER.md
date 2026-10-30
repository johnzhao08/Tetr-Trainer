# 9–0 live solver

Open **9–0 stacking** from the home screen. It owns a separate free-play Game instance and uses the existing input, settings, hold, pause, undo, restart and top-out rules. Settings remains the shared rightmost header button. Suggestions never play moves into the user's game.

## Information and update boundary

Analysis captures the board, active pose, hold availability/piece, and **only the five displayed next pieces**. It never receives a randomizer seed or hidden queue. A hold of an empty slot consumes one visible piece; a swap does not. Search stops when the next active piece is unknown. This can shorten a continuation to five placements when a known piece remains in hold.

Entry, locks, hold, undo and restart produce analysis snapshots. Movement, rotation, soft drop, elapsed time and pause do not. Suggestions remain relative to the last snapshot even after the player moves the piece. Changing well mode or soft-drop mode also recomputes analysis.

Each job runs in a Web Worker with a 500 ms search budget. New input snapshots terminate obsolete workers, and request IDs/cleanup guards reject stale responses. Errors leave gameplay operational. Returning Home stops the worker and retains the isolated paused game in memory; reload discards it.

## Reachable placements

A breadth-first search explores left/right, CW, CCW, 180 and soft-drop transitions using `board.ts` directly. With finite soft drop it also explores single-row descent. Every proposed lock is grounded and reached from the starting pose; arbitrary geometric fits are not accepted. Grounded movement and SRS+ kicks allow tucks and spins of every piece, without introducing any spin-score bonus.

Paths use abstract cell movements, rotations and soft-drop actions. Effort estimates action count, combining repeated finite down steps into a held descent. It is not a minimum physical-keypress or time estimate: DAS/ARR and player timing are not simulated. Users with instant wall-shift handling may need to change handling to execute intermediate-column suggestions.

## Search and ranking

Search retains up to 16 distinct first placements and two continuations per first placement, expanding through up to six locks. Occupied-cell-equivalent first placements count as one alternative, even if different hold routes reach them. Equivalent board/hold/queue states are merged. Interrupted rounds are discarded so early alternatives do not receive extra lookahead simply from iteration order.

This is a bounded heuristic beam search, not exhaustive proof or a trained evaluator. Pruning can miss the best repair, and a shorter known-piece continuation may be compared with a deeper one; each card reports its actual depth. If the time budget cannot find a safe continuation, the UI says so rather than inventing a move.

Current lower-is-better penalties:

| Feature                                             |                     Penalty |
| --------------------------------------------------- | --------------------------: |
| Empty cell below a filled cell in its column        |                       2,000 |
| Occupied cell in the chosen edge well               |                         650 |
| Height above row 14                                 | 250 × excess height squared |
| Sum of nine stack heights                           |                     2 × sum |
| Maximum height                                      |                  4 × height |
| Adjacent height differences across the nine columns |        3 × total difference |
| Quad                                                |                        −240 |
| Other clears                                        |                   90 × rows |
| Temporary holes in intermediate states              |   12 per hole per placement |
| Estimated input effort                              |              0.5 per action |

Terminal holes carry the full penalty. An actual searched repair can remove that terminal penalty; cavities receive no speculative discount just because a spin might exist. Ordinary clears remain available for survival. Known next-piece spawn collisions are rejected. Unknown-piece outcomes cannot be proven safe. Weights are initial engineering heuristics, not calibrated playing-strength claims.

Auto well selection defaults right. A clear established edge well is retained; the opposite side is selected only when its gap and relative height give strong evidence. Left/Right overrides bypass inference. Geometry is evaluated directly; kick tables are never mirrored heuristically.

## Previews

Three cards show different first-placement alternatives with translucent colored SVG pieces and move numbers. Overlays use each move's coordinates at its own turn; they are **not a simultaneous final board** when lines clear. The piece sequence marks clears. Hover, keyboard focus, or touch reveals playback controls. Playback alternates between the planned placement and the exact board after locking/clearing, and shows hold and action-path instructions. Overlay restores the default composite view. Preview interactions do not send gameplay shortcuts.

## Verification and deferred work

Run `npm run check`. Tests replay reachable paths, cover the independent T/S/Z spin fixtures and sealed cavities, visible-only queues, hold consumption, ranking priorities, left/right inference, deadlines, snapshot timing, and spin-based hole repair. Browser checks cover actual workers, rapid refresh, cancellation, independent playback, override controls, keyboard isolation, responsive layout and error recovery.

No run review, persisted analysis history, automatic placement, configurable scoring weights, solver service or external dependency is introduced. Search strength and weight tuning should be evaluated against representative user positions before treating the suggestions as coaching authority.
