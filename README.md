# Tetr Trainer

A zero-gravity learning trainer with verified TETR.IO SRS+ rotations, configurable handling, and controls saved on your device. Hard drop locks; soft drop never does.

The app is a staged curriculum of scored drills, built on the plan in [reports/Competitive Tetris learning progression.md](reports/Competitive%20Tetris%20learning%20progression.md).

- **Stages and drills.** The home screen lists the stages in order (controls, clean stacking, downstacking, TSD in random play, B2B economy, pressure). Each stage has a rank band, a focus, and a few short drills played on the random 7-bag with feedback on every placement.
- **Gates.** A stage is passed when its gate bars are met (for example pieces per garbage line, APP at a target PPS). Gates are soft: every drill is open to play at any time, and the recommended stage is highlighted and expanded.
- **Your level.** The top card estimates your rank from the PPS and APP of your recent saved runs and jumps to the first unpassed drill of the recommended stage. Efficiency (APP) matters most below the median rank; speed (PPS) matters most from SS upward.
- **Saved progress.** Finished drills are saved in this browser. The Your data section exports progress as JSON (download or clipboard), imports it back with validation, and resets it. Freeplay is never saved.
- **Season 2 scoring.** Attack, B2B charging and Surge follow TETRA LEAGUE Season 2 ([GAMEPLAY_SPEC.md](GAMEPLAY_SPEC.md)). Drills report PPS, APP, APM, finesse and related metrics.
- **Optional pressure.** Some drills add league gravity and a scripted attacker. Freeplay has a Pressure selector (off, league gravity, gravity plus a 30 APM opponent) and a stats panel with the coach chip for your last placement.
- **Side track: openers.** TKI, DT Cannon, T-spin triple entry and the perfect clear opener are optional and matter less than midgame play. The PCO is low priority because all clears send 5 lines in Season 2.
- **Reference.** The T-spin kick puzzles and finesse fundamentals are unscored warm-ups.

Curriculum sources are in [docs/LEARNING_RESEARCH.md](docs/LEARNING_RESEARCH.md).

## Run

Use Node.js 22.12+ (tested with Node 24).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Click the board to focus it. Adjust **Settings** to taste; Apply saves your changes, then Resume starts play again.

Default controls: ←/→ move, ↑ clockwise, Z counterclockwise, A 180°, ↓ soft drop, Space hard drop, C hold, Backspace undo, R restart, Escape pause/resume.

## Verify

```sh
npm run check
```

Tests cover deterministic bags and input timing, exact kicks, mirrored T-spin triples, S/Z spins with and without walls, negative/blocked rotations, line clearing, top-out, hold, resets, and settings recovery. Build output is `dist/`; `npm run preview` serves it locally.

- [Gameplay rules](GAMEPLAY_SPEC.md)
- [Rotation source, tables, and independent fixtures](REFERENCE_NOTES.md)
- [Original agreed build plan](BUILD_PLAN.md)

`src/core/` owns the browser-independent engine, settings, the curriculum (`curriculum.ts`), saved progress (`progress.ts`), the coach (`coach.ts`) and the opener/reference catalog (`catalog.ts`). `src/ui/` owns canvas drawing, browser input, the home screen, drill and module screens (`ModuleScreen.tsx` maps catalog ids to screens). `src/App.tsx` switches between home, freeplay, drills and modules.

Gravity, automatic locking and incoming garbage are optional per drill and off by default. There is no solver, no multiplayer, and no account: progress lives in your browser. This is an independent trainer, not an official TETR.IO application.
