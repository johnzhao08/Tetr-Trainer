# Tetr Trainer gameplay specification

## Scope

Desktop keyboard free play with zero gravity. Only hard drop locks. No lock delay, automatic locking, scoring, solver, multiplayer, or replay UI. The starting settings are editable defaults. The engine has no browser dependencies.

## Board and coordinates

The field is 10 columns by 20 visible rows plus 20 hidden rows. x increases right; y increases upward from the visible bottom row (0). Coordinates outside x=0..9 or y=0..39 collide. Three buffer rows are rendered above a dashed boundary so initial zero-gravity spawn pieces can be seen; those rows are not part of the 20-row field.

JLSTZ shapes use 3x3 grids and integer center origins. I uses a 4x4 grid with a half-cell center. O cells remain in place across rotations, but its orientation advances. Authored grids are top-down and converted to y-up once. Spawn positions reproduce initial occupied cells in the reviewed TETR.IO client: JLSTZ/O anchor (4,21); I anchor (4,20). Rotation always starts at orientation 0 on spawn and after hold.

## Rotation

SRS+ 90-degree and 180-degree candidates are transcribed from the official TETR.IO public client, reviewed 2026-09-20. Exact hash, tables, origin conventions, independent fixtures, and links are in [REFERENCE_NOTES.md](REFERENCE_NOTES.md). Every rotation tests the unshifted pose, then offsets in the listed order. The first noncolliding candidate wins. If none fit, position/orientation are unchanged. I has its own 90-degree priorities and shorter 180-degree tables. 180 is one direct rotation, never two 90-degree rotations.

Mirrored T-spin triples, open S/Z doubles, and walled S/Z doubles are verified through actual runtime input sequences. Tests also cover negative cases, blocked rotations, I-specific kicks, and collision invariants. T-spin feedback also checks three occupied diagonal corners and that the last successful movement was a rotation. Mini and full T-spins have distinct labels; points and spin bonuses are not implemented.

## Session and randomizer

A seeded Mulberry32 PRNG feeds Fisher–Yates shuffling of independent seven-piece bags. Each bag contains one of each type. Queue replenishment preserves bag order; five upcoming pieces are shown. The seed is displayed and can be copied with settings. Restart chooses a fresh browser-generated seed and resets board, hold, queue, statistics, and all input/timing state; settings persist.

Hold is allowed once per active piece. Empty hold consumes the next piece; occupied hold swaps types without consuming the queue. The held piece spawns in its original orientation/position. Hard drop restores hold availability for the next piece.

Hard drop projects to the lowest reachable y without passing through occupied cells, writes the four cells, removes all complete rows simultaneously, and fills empty rows at the top. After line clearing, spawn the next piece at its normal position and test collision (block-out). This is the only game-over condition, including when hold brings in a piece. Locking partly or entirely above the visible field does not end the game as long as the next piece can spawn normally. No automatic upward spawn rescue is used. These explicit trainer top-out rules do not claim to reproduce every TETR.IO mode/preset. Game over accepts restart but no piece movement.

## Zero gravity and soft drop

No piece falls due to elapsed time. Floor/stack contact never locks. Hard drop alone locks, once per physical press.

Finite soft drop moves one row on press, then repeats at 1000/speed milliseconds per row. Speed is cells per second, not TETR.IO SDF. Instant soft drop projects immediately without locking and stays active while held, including after movement, rotation, hold, and spawning. This permits sliding and spinning into slots. Finite soft-drop timing carries across spawn while the key remains held.

## Horizontal handling and DCD

Settings use milliseconds, independent of monitor refresh. DAS defaults to 110 ms; ARR defaults to 0 ms; DCD defaults to 0 ms. Soft drop defaults to instant, with 40 cells/s stored for finite mode. Allowed ranges are DAS 0–500 ms, ARR 0–100 ms, DCD 0–200 ms, finite speed 1–200 cells/s.

Pressing a direction moves one cell immediately. After DAS, movement repeats every ARR milliseconds. ARR=0 moves to the furthest legal cell after DAS. DAS=0 starts repeat behavior immediately. Most recently pressed horizontal direction wins. Releasing it while the other remains held activates that direction immediately with a fresh DAS charge. Direction changes reset DAS. Held direction and its existing DAS charge carry across spawn/hold; no new press is synthesized.

A failed horizontal movement sets the wall-contact flag (including stack contact); successful movement clears it. After successful rotation or at spawn, DCD applies only if that flag is set. Next horizontal repeat waits the greater of remaining DAS and DCD, then shifts immediately without an extra ARR interval. Spawn clears the outgoing piece's wall flag after applying the cut. A failed rotation does not cut DAS. O rotation does. The trainer's single active direction policy is explicit; the entire TETR.IO input-options matrix is not implemented.

## Time and input order

The core receives explicit action down/up transitions and tick(dtMs), with no real timers. Input boundaries advance the simulation to that timestamp first. Inside a tick, repeat events execute chronologically; horizontal precedes finite soft drop on ties. Then the explicit input is processed. Rotation/drop/hold occur once on down until up. Negative or non-finite elapsed time is rejected.

Browser input suppresses OS-repeat and duplicate down events. Session actions restart/pause/undo are routed outside the piece engine. Browser frames render the current state and do not define simulation speed. Keyboard controls do not act while editing fields or interacting with buttons. The board can be focused with keyboard or pointer.

Focus loss, hidden tabs, pause, and opening settings clear held inputs. Resume is explicit; background time is not accumulated. Closing or applying settings leaves the session paused so users can resume deliberately. Reconfiguration clears timing state before further input.

## Settings

All supported actions can be rebound. Conflicting assignments require a visible confirmation and swap both keys so no action is left unbound. Escape cancels binding capture. Default bindings are arrows for movement/CW/soft drop, Z=CCW, A=180, Space=hard drop, C=hold, R=restart, Escape=pause.

The settings dialog edits a draft. Apply validates and atomically installs values; Cancel discards the draft. Browser localStorage stores a versioned key; invalid numeric values recover/clamp and malformed or duplicate binding maps revert to defaults. Denied/quota-full storage does not stop play and produces a session-only settings notice. Restore defaults changes the draft until Apply.

## Acceptance

`npm run check` runs deterministic engine/runtime/settings tests, lint, TypeScript, and production build. Browser verification covers real keyboard play, pause/resume, top-out/restart, editing/binding conflict resolution, persistence, focus loss, and responsive layout. Final gameplay feel remains subject to the user's hands-on acceptance. The first fixed drill is authorized as the next scope increment; randomized drills and solver work remain deferred.

## Session feedback

The session clock counts active play time from start/restart, pauses during pause/settings/focus loss, stops at game over, and resets on restart. It displays minutes and seconds, updating once per second while idle.

After a lock, the session card shows Single, Double, Triple, or Quad for 1–4 cleared lines. T-spins require a T piece, at least three occupied diagonal pivot corners (boundaries count), and a successful rotation as the last successful movement. A real drop or horizontal translation invalidates the rotation; failed inputs and a zero-distance locking hard drop preserve it. Detection happens before line removal. Zero-line spins display T-spin; line clears combine labels, e.g. T-spin Triple. Minis use the T-spin Mini label. The last event remains until the next clear/spin or restart, and repeated events retrigger the visual indicator.

## Combo and B2B counters

Both counters are shown in This Session. The first qualifying clear starts a chain at 0; the second shows 1. No chain is stored as -1 internally and displayed as 0.

Combo increments once per consecutive piece that clears any number of lines, including spin clears. A locked piece that clears no lines resets combo, including a zero-line T-spin.

B2B increments for Quads, spin clears and all clears (see Scoring). Pieces clearing no lines preserve it. Ordinary Singles/Doubles/Triples break the chain. Mini and full T-spin clears both qualify for B2B.

Hold, movement, rotation, pause, settings, and failed inputs do not independently change chains. Restart resets both counters.

## Undo

Backspace (rebindable) and the Undo button restore the state immediately before the most recent hard drop. Repeated undo steps backward through earlier placements. The restored piece starts at its normal spawn position and orientation, with rotation history cleared. Restored state includes board, hold availability, next queue, randomizer, line/piece counts, Combo/B2B and clear feedback. This also recovers from top-out. Held inputs and repeat timers are cleared. Undo while paused stays paused; undo after game over resumes play. Settings are retained. The game clock (`elapsedMs`) is restored to its value at that placement. Restart clears undo history.

Existing saved bindings are retained when adding undo. Backspace is assigned if free; if already used, undo receives an unused key (prefer U) shown in Settings.

## All-clear and mini feedback

After a line clear leaves no locked blocks anywhere on the board (including the hidden buffer), “all clear” pops up at the center of the 20-row playfield and fades over two seconds. The active piece and ghost do not count as locked blocks. Undo and restart dismiss it; consecutive all clears replay the animation. Reduced-motion mode fades without scaling.

T-spins require a final successful rotation and three occupied pivot corners. Both front corners occupied means full; otherwise mini, except the fifth rotation test upgrades to full. Full spins retain the “T-spin” label; minis use “T-spin Mini”, each followed by the line-clear name when applicable.


## T-spin learning progression

Four steps are directly selectable, with no unlocking or saved completion history. Switching steps creates a new attempt, clears the old session's held inputs/listeners, and focuses the new board. The module remains isolated from free play and never persists settings. Each attempt copies the user's current bindings and handling. Shared input safeguards, pause and focus-loss behavior apply to every step.

1. **Rotate and lock:** the original prepositioned T0 fixture. One lock ends the attempt; only a full T-spin succeeds. Minis and ordinary locks require retry.
2. **Drop into the setup:** the same locked board, with T0 at its normal spawn. Move left once, soft-drop and release, move right once, rotate CW, and hard-drop. Hold and undo remain disabled in these first two one-piece steps.
3. **Build the overhang:** empty board, preset opening bag I L Z O S J T, then a deterministic continuation of complete seven-piece bags. Restart reproduces the same sequence. Hold, previews and undo are available. Ordinary placements and minis continue the attempt; the first full T-spin succeeds. The optional example explains the Z overhang and gives a playable TKI layout, but any engine-confirmed full T-spin is accepted.
4. **Three full T-spins:** empty board and randomly seeded seven-piece bags, including a new seed on retry. The third full T-spin in the same attempt succeeds. They need not be consecutive or clear lines. Minis, ordinary locks and line clears never increment progress or reset it. Hold and undo are available; top-out ends an unfinished attempt.

GameState.fullTSpins counts engine-classified full spins at lock time. Rotation alone never increments it. Undo restores the count along with the board and queue; replaying an undone spin cannot double-count progress. A completed attempt freezes further input/undo until retry or step selection. All attempts offer Home and retry, and top-out reports failure. Full-spin recognition, kick tables and free-play Combo/B2B rules are unchanged.

Free play remains a separate in-memory instance, paused on returning Home, and resumes explicitly when reopened. Reloading discards sessions. This progression adds no generator, solver, scoring, or persistent progress.


## Scoring (Season 2)

The engine scores locks with the TETRA LEAGUE Season 2 rules. TETR.IO publishes no official attack table; the values come from the halp1/triangle engine (`src/engine/utils/damageCalc`, league preset, spin bonuses "all-mini+") and live in `ATTACK_RULES` in `src/core/attack.ts`.

- Spins are checked only when the last successful action before the hard drop was a rotation. T pieces use the three-corner test (full or mini); a T that fails it but cannot move left, right, up or down is a mini. I, J, L, S and Z are minis when immobile in all four directions. O never spins.
- B2B increments on a quad, any spin clear (full or mini) and any all clear, and breaks on other clears. Non-clearing locks leave it alone. Combo increments per clearing lock and resets on a non-clearing lock.
- Base attack by lines cleared (0 to 4): none 0,0,1,2,4; mini 0,0,1,2,10; full spin 0,2,4,6,10. B2B above 0 adds a flat 1. The result is multiplied by 1 + 0.25 x combo, and for combo above 1 is raised to at least log(1 + 1.25 x combo).
- Clearing a garbage row with a spin or quad adds 1 after the multiplier. The total is floored.
- Breaking a B2B chain of 4 or more sends a surge equal to the chain length, split in three parts, before the clear's own attack.
- An all clear adds a separate 5-line part, not multiplied.

Session stats (attack, keys, finesse faults, garbage cleared, max B2B and combo, surges, spins) live in game state and follow undo. Finesse faults compare presses with the shortest route to the landing on the real board; holding resets a piece's press count. Press convention: each tap or DAS hold-to-wall is one press and soft drop counts once as a drop to the floor; partial-DAS releases and intermediate soft drops are not modelled. The search starts from the piece's actual starting pose. Every placement is also appended to `Game.log`, which undo truncates and restart clears. `Game.rewindTo(index)` restores the state before placement `index`. Derived rates (APM, PPS, APP, VS, KPP, finesse, pieces per garbage line) come from `competitiveMetrics`.

## Pressure (optional)

Everything here is off by default, so drills without options behave as zero-gravity manual-lock play. Options are the third `Game` constructor argument or `setOptions`. Gravity, lock and garbage values apply immediately; a changed `opponent` applies from the next restart. All timing uses the game clock (`elapsedMs`), advanced on a persistent 60 Hz frame clock (frame k ends at k*1000/60 ms), so results do not depend on how time is chunked into `tick` calls and nothing moves while paused or over. The lock timer starts when the piece touches the stack. Undo restores the clock, queued garbage and opponent together.

Source: halp1/triangle TETRA LEAGUE preset. Frames convert at 60 fps.

| Option | Default | League preset |
| --- | --- | --- |
| `gravity` (cells per frame) | 0 (off) | 0.02 |
| `gravityIncrease` (per second) | 0 | 0.0035 |
| `gravityMarginMs` | 120000 | 7200 frames (120 s) |
| `lockDelayMs` | 500 | 30 frames |
| `lockResets` | 15 | 15 |
| `garbageCap` (lines per lock) | 8 | 8 |
| `garbageMessiness` | 0.3 | n/a, trainer value |
| `receive` delay | 333 ms | garbagespeed 20 frames |

Gravity at time t is `gravity + gravityIncrease * max(0, t - margin) / 1000`. While gravity is on and the piece rests on the stack, a lock timer runs. A successful move or rotation that leaves the piece grounded restarts it, up to `lockResets` times. When it expires the piece locks through the same path as hard drop, except that no hard-drop key press is counted. A fall changes the pose, so a piece that fell after its last rotation is not a spin. Soft drop and hard drop behave as before.

`receive(lines, delayMs)` queues an entry in `state.incoming` (`pendingLines` sums it). A lock that clears lines first spends its attack on the queue, oldest entries first; `stats.cancelled` counts those lines and `stats.sent` the rest, while `stats.attack` stays the total produced. A lock that clears nothing inserts entries whose delay has passed (in arrival order, skipping entries not yet ready) at the bottom, at most `garbageCap` lines per lock; an entry can be split and the remainder stays queued. Each entry has one hole column, and the next entry changes column with probability `garbageMessiness`, drawn from a seeded generator kept in the state. Garbage cells are `X`. Existing rows move up; if a filled cell would pass the top row or the next piece cannot spawn, the game is over. Undo restores the queue and generator exactly.

`GameOptions.opponent` (`seed`, `apm`, optional `burst` spike sizes) feeds a scripted attacker into `receive` during `tick`. Each attack of n lines is followed by `n * 60000 / apm` ms, so the long-run rate is exactly `apm`. Sizes are mostly 1 to 4, with occasional `burst` sizes. Its state is part of the game state and undo restores it.

### Versus tempo (Season 2)

| Option | Default | League preset |
| --- | --- | --- |
| `openerPhase` (pieces) | 0 (off) | 14 (`openerphase`) |
| `garbageMultiplier` | 1 | 1 |
| `garbageIncrease` (per second) | 0 | 0.008 |
| `garbageMarginMs` | 180000 | 10800 frames (180 s) |

Opener phase. Patch notes (Beta 1.1.0): "First 14 pieces: if pending garbage is greater than garbage sent, you will be able to cancel double the lines." Interpretation: while the piece count including the one just locked is at most `openerPhase`, and the lines queued exceed the attack the lock sends (after the multiplier), each attack line cancels 2 queued lines, so the lock spends `ceil(cancelled / 2)` attack lines and the rest is sent. If the queue is not larger than the attack, cancelling is the normal 1 to 1. `stats.cancelled` counts queued lines removed. The rule has no effect on garbage insertion.

Multiplier ramp. Patch notes (Infdev 0.4.0): "Garbage Increase: the amount added to the garbage multiplier every second, after margin time is over." The multiplier at game time t is `garbageMultiplier + garbageIncrease * max(0, t - garbageMarginMs) / 1000`, applied linearly (the research notes could not confirm linear versus compounding; linear gives about 1.48 at 4:00). Outgoing attack of a lock becomes `floor(attack * multiplier)` before cancelling and sending, and opponent attacks are scaled the same way. `stats.attack` stays the unscaled total so APP and APM do not inflate; the +1 clear bonus of Beta 1.3.0 is not modelled separately.

Simulated opponent. `state.opponent` holds `height` (its own stack, capped near 10 rows, plus landed garbage), `b2b` (-1 when none), `pending` (your sent lines not yet landed) and `alive`. It still attacks on the APM schedule, but each attack either keeps its B2B (85%) or breaks it; with `surge: true` a break at B2B 4 or more adds a Surge equal to its B2B to that attack. Each attack clears lines from its board, garbage first, which is how it digs, and cancels its own pending garbage before anything is sent. Your `stats.sent` is received after 333 ms, lands up to 8 lines per 600 ms, and at height 20 it tops out (`alive` false; `DrillDef.end.opponentKO` then completes the drill as a win). The opponent does not get opener-phase doubling. Its state is in the undo snapshot.

Versus helpers (`core/versus.ts`): B2B gap is opponent B2B minus yours (both floored at 0); the warning shows at a gap of 8 or more (TETR.IO shows a warning in 1v1 at 8 behind); the spike window shows while the opponent is alive at height 12 or more.

`paceDelta(pieces, elapsedMs, targetPps)` returns pieces ahead (positive) or behind (negative) a steady target pace.
