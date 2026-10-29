# Tetr Trainer gameplay specification

## Scope

Desktop keyboard free play with zero gravity. Only hard drop locks. No lock delay, automatic locking, scoring, drill validation, solver, multiplayer, or replay UI. The starting settings are editable defaults. The engine has no browser dependencies.

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

`npm run check` runs deterministic engine/runtime/settings tests, lint, TypeScript, and production build. Browser verification covers real keyboard play, pause/resume, top-out/restart, editing/binding conflict resolution, persistence, focus loss, and responsive layout. Final gameplay feel remains subject to the user's hands-on acceptance. No drills should be added before that acceptance.

## Session feedback

The session clock counts active play time from start/restart, pauses during pause/settings/focus loss, stops at game over, and resets on restart. It displays minutes and seconds, updating once per second while idle.

After a lock, the session card shows Single, Double, Triple, or Quad for 1–4 cleared lines. T-spins require a T piece, at least three occupied diagonal pivot corners (boundaries count), and a successful rotation as the last successful movement. A real drop or horizontal translation invalidates the rotation; failed inputs and a zero-distance locking hard drop preserve it. Detection happens before line removal. Zero-line spins display T-spin; line clears combine labels, e.g. T-spin Triple. Minis use the T-spin Mini label. The last event remains until the next clear/spin or restart, and repeated events retrigger the visual indicator.

## Combo and B2B counters

Both counters are shown in This Session. The first qualifying clear starts a chain at 0; the second shows 1. No chain is stored as -1 internally and displayed as 0.

Combo increments once per consecutive piece that clears any number of lines, including spin clears. A locked piece that clears no lines resets combo, including a zero-line T-spin.

B2B increments for Quads and T-spin Singles/Doubles/Triples. Pieces clearing no lines preserve it. Ordinary Singles/Doubles/Triples break the chain. Mini and full T-spin clears both qualify for B2B.

Hold, movement, rotation, pause, settings, and failed inputs do not independently change chains. Restart resets both counters.

## Undo

Backspace (rebindable) and the Undo button restore the state immediately before the most recent hard drop. Repeated undo steps backward through earlier placements. The restored piece starts at its normal spawn position and orientation, with rotation history cleared. Restored state includes board, hold availability, next queue, randomizer, line/piece counts, Combo/B2B and clear feedback. This also recovers from top-out. Held inputs and repeat timers are cleared. Undo while paused stays paused; undo after game over resumes play. Elapsed session time and settings are retained. Restart clears undo history.

Existing saved bindings are retained when adding undo. Backspace is assigned if free; if already used, undo receives an unused key (prefer U) shown in Settings.

## All-clear and mini feedback

After a line clear leaves no locked blocks anywhere on the board (including the hidden buffer), “all clear” pops up at the center of the 20-row playfield and fades over two seconds. The active piece and ghost do not count as locked blocks. Undo and restart dismiss it; consecutive all clears replay the animation. Reduced-motion mode fades without scaling.

T-spins require a final successful rotation and three occupied pivot corners. Both front corners occupied means full; otherwise mini, except the fifth rotation test upgrades to full. Full spins retain the “T-spin” label; minis use “T-spin Mini”, each followed by the line-clear name when applicable.
