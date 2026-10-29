Tetr Trainer — Final Free-Play Build Plan
Build a reliable zero-gravity free-play trainer before adding drills. Use verified TETR.IO SRS+ rotation behavior, including 180-degree kicks. All controls and handling settings are editable in the app; initial values are convenient defaults.
Scope: Free play, rotation, movement, hold, next queue, ghost piece, line clears, top-out, restart, and persistent settings.
Deferred: Gravity, automatic locking and lock-delay mechanics, drills, solver, undo, scoring, garbage, multiplayer, and replay UI. Pieces lock only when hard-dropped. Soft drop moves pieces without locking them.
Stage 1: Gameplay specification and pure engine
Objective: Establish exact gameplay rules and implement the board mechanics independently of the UI.
Implementation
- Scaffold Vite, React, TypeScript, Vitest, and linting.
- Keep src/core/ independent of React, DOM, browser timers, and storage.
- Write GAMEPLAY_SPEC.md documenting board dimensions, hidden rows, spawn positions, piece orientations/origins, rotation rules, hold, top-out, and the order of locking, clearing, and spawning.
- Use a 10-column, 20-visible-row board. Verify hidden-row and spawn behavior against the selected TETR.IO reference.
- Use y-up coordinates consistently: y = 0 is the bottom visible row.
- Implement collision, movement, rotation, hard-drop projection, locking, simultaneous line clears, and readable board serialization.
- Store active-piece state separately from locked board cells.
Rotation requirements
Use the verified TETR.IO SRS+ tables, including applicable I-piece differences and 180-degree kicks. Do not substitute generic SRS or treat a 180-degree rotation as two 90-degree rotations.
Before implementation:
1. Identify and record an exact reference source, version or retrieval date, and coordinate convention.
2. Verify rotation origins, transition direction, kick offsets, and kick priority.
3. Resolve conflicting references before calling the implementation TETR.IO-compatible.
Represent kick tables as explicit data. Test candidates in the specified order and accept the first valid result. A failed rotation leaves the piece unchanged.
Verification
- Board boundaries, spawn positions, collision, serialization, and simultaneous line clears.
- Exact expected positions/orientations for clockwise, counterclockwise, and 180-degree rotations.
- Wall and floor kicks, I-piece cases, O-piece behavior, and blocked rotations.
- Verified T-spin triple entry fixtures, including mirrored cases where supported.
- Verified S/Z spin fixtures, including mirrored cases and negative examples where rotation must fail.
- Cases with multiple available kicks to verify priority.
Expected results must come from independently checked fixtures, not calculations using the same tables being tested. A broad “rotation never overlaps the board” test supplements these cases; it does not replace them.
Done when: The documented rules are implemented and tested, including the required spin placements. Spin scoring/classification is outside this milestone.
Stage 2: Playable zero-gravity free play
Objective: Connect the engine to a complete, minimal play session.
Implementation
- Seeded standard 7-bag randomizer.
- Active piece, next queue, and hold.
- Left/right movement, clockwise/counterclockwise/180-degree rotation, soft drop, and hard drop.
- DAS, ARR, DCD, and soft-drop handling, driven by an explicit settings object.
- Canvas rendering of the board, active piece, ghost, next queue, and hold.
- Playing, paused, and game-over states.
- Restart through a button and bindable action.
Zero-gravity rules
- Pieces never fall automatically.
- Contact with the floor or stack never locks a piece.
- Hard drop moves to the landing position and locks exactly once.
- Finite soft drop moves downward at a configured speed without locking.
- Instant soft drop moves to the landing position without locking, allowing subsequent movement and spins.
Because gravity is zero, finite soft drop uses a clearly labeled cells-per-second speed, not a factor multiplied by gravity. Do not label this control “TETR.IO SDF.” Offer a separate instant-soft-drop option.
Runtime and input rules
- Advance gameplay through explicit input transitions and elapsed time.
- Keep rendering independent of simulation.
- Define ordering for simultaneous actions and timing boundaries.
- Suppress operating-system key repeat.
- Define both-directions-held behavior, direction switching, and held movement across spawn and hold.
- Implement DCD behavior from a verified reference; it must affect runtime movement.
- A single hard-drop press cannot also drop the next piece.
- Pause and clear held inputs on focus loss or a hidden tab. Resume without applying background elapsed time.
- Restart resets board, hold, queue, input state, and timing state while retaining settings.
Verification
Test bag contents, seed reproducibility, hold restrictions, ghost/hard-drop agreement, soft drop without locking, top-out, and restart. Confirm identical results for the same seed and timestamped inputs under different render-frame schedules.
Done when: A full session works from opening the app through top-out and restart, with no automatic falling or locking.
Stage 3: Editable controls, handling, and persistence
Objective: Let users configure the trainer themselves without code changes.
Implementation
Provide settings for:
- DAS, ARR, and DCD.
- Finite soft-drop speed and instant soft drop.
- Bindings for left, right, clockwise, counterclockwise, 180-degree rotation, soft drop, hard drop, restart, and pause.
Support ARR zero correctly. Use explicit units, sensible ranges, and validated values. Choose usable defaults; matching one person’s initial setup is not a prerequisite.
Use one action map. Route restart and pause to session control, and piece actions to gameplay.
Settings behavior
- Pause gameplay while settings or binding capture is open.
- Do not process gameplay shortcuts while editing controls.
- Detect binding conflicts and offer explicit reassignment.
- Apply settings together and clear held-input/timing state.
- Persist settings and bindings to localStorage.
- Recover from missing, malformed, or invalid saved data.
- Keep the app usable when storage is unavailable.
- Include “Restore defaults.”
- Use labeled, keyboard-accessible controls.
Verification
Check timing boundaries and runtime effects for DAS, ARR, and DCD; finite and instant soft drop; direction switching; movement across spawn/hold; rebinding; conflicts; persistence; and invalid-data recovery.
Done when: Users can change every supported control and handling value, immediately test the result, and retain the configuration after reloading.
Stage 4: Stabilization and acceptance
Objective: Verify the complete free-play experience before starting drills.
Acceptance checks
- T-spin triple and S/Z spin fixtures work through the actual input/runtime path, not only direct engine calls.
- Rotation results and kick priority match the verified reference.
- Rapid movement, rotation, hold, and drop combinations do not lose or duplicate actions.
- Instant soft drop still permits the movements and rotations required by supported spin setups.
- No piece falls or locks without the appropriate user action.
- Line clearing, hidden-row behavior, and top-out follow the specification.
- Restart, pause, focus changes, and settings cannot leave stale inputs or timers active.
- Ghost, board, hold, and next queue remain synchronized with engine state.
- Resizing preserves board alignment and usable controls.
Keep the seed and relevant settings available for reproducing bugs. Use deterministic input sequences in regression tests; do not build a replay product.
Run tests, type checking, linting, and a production build. Verify the browser flow and compare representative rotation/handling scenarios against TETR.IO, accounting for the trainer’s deliberate zero-gravity and manual-locking behavior.
Done when: Automated checks pass, required spins work in the playable app, no known blocking gameplay bugs remain, and you approve the feel after adjusting the settings.
Build rule: Complete and verify each stage before advancing. Introduce the first fixed drill only after stage 4 passes; randomized drills and solver work remain separate later milestones.

Authorized follow-up: one fixed basic T-spin learning module, using the existing engine and input path. No randomized drills, generator, solver, catalog, or scoring. Fixture proof and current behavior are documented in REFERENCE_NOTES.md and GAMEPLAY_SPEC.md.

Authorized progression follow-up: expand the fixed T-spin module to four directly selectable steps: original rotation drill, spawn-to-slot entry, an empty-board preset-bag overhang exercise, and random-bag free play with a three-full-T-spin goal. Board generators, solvers, and scoring remain deferred.
