# Tetr Trainer

A zero-gravity learning trainer with verified TETR.IO SRS+ rotations, configurable handling, and controls saved on your device. Hard drop locks; soft drop never does.

The home screen is a catalog of learning modules grouped into Beginner, Intermediate, and Advanced. Modules that need a solver are listed as planned and describe what they will do. Curriculum sources are in [docs/LEARNING_RESEARCH.md](docs/LEARNING_RESEARCH.md).

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

`src/core/` owns the browser-independent engine, settings normalization, and the module catalog (`catalog.ts`). `src/ui/` owns canvas drawing, browser input, the settings dialog, and module screens (`ModuleScreen.tsx` maps catalog ids to screens). `src/App.tsx` switches between home, freeplay, and modules.

No gravity, automatic locking, solver, scoring, or multiplayer. This is an independent trainer, not an official TETR.IO application.
