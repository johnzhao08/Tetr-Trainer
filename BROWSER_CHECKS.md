# Browser acceptance — 2026-09-20

Verified locally in Chromium with agent-browser against the running Vite application:

- Page renders without Vite error overlay or browser console/page errors.
- Actual keyboard movement, rotation, soft drop, hard drop, and rebound hold work. Two hard drops produced exactly two placed pieces.
- Pause blocks Space/hard drop; piece count remains unchanged. Focus loss pauses and presents Resume.
- Repeated hard drops reach the game-over screen. Restart returns to zero pieces, empty hold, fresh seed, and playing state.
- Changing DAS from 110 to 140 ms, swapping Hold onto Z with explicit confirmation, and applying settings survives reload; counterclockwise receives the previous hold key C.
- Controls and handling displays reflect saved values.
- At 1280×720, the complete board ends at approximately y=645 and action buttons at y=700.
- At 390px width, page width remains 390px without horizontal overflow; canvas remains proportionate.
- Settings uses a native modal with labeled controls and visible Apply/Cancel actions.

Pure engine/runtime regressions additionally exercise exact SRS+ outcomes, both mirrored T-spin triple entry paths, both rotation directions for S/Z slots, negative cases, frame-independent input timing, and settings recovery. Run `npm run check`.

Still awaiting the user's hands-on acceptance of handling feel before adding drills.
