# Tetr Trainer

A zero-gravity practice board with verified TETR.IO SRS+ rotations, configurable handling, and controls saved on your device. Hard drop locks; soft drop never does.

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

`src/core/` owns the browser-independent engine and settings normalization. `src/ui/` owns canvas drawing, browser input, and the settings dialog. `src/App.tsx` composes the free-play screen.

No gravity, automatic locking, drills, solver, scoring, or multiplayer. Final handling feel should be accepted by the user before adding drills. This is an independent trainer, not an official TETR.IO application.
