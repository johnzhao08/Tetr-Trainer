# Rotation and handling reference

Verified on 2026-09-20 from the publicly served [TETR.IO client](https://tetr.io/js/tetrio.js).
The downloaded source SHA-256 was `2d74c7ec207e8266f6fcf39013b164fa7e53206b67c869d1ce431140d6d655d7`.
The URL is mutable, so the hash and retrieval date identify the reviewed version. No TETR.IO implementation code is included in this project; factual shape/kick offsets were transcribed, and the engine is independently implemented.

The official [mechanics FAQ](https://tetrio.github.io/faq/mechanics.html#srs) links its SRS+ reference and explains S/Z spin direction. The [maintainer comment from 2020](https://github.com/tetrio/issues/issues/506#issuecomment-703215344) attributes the original SRS+ table to osk. Its original Discord image is no longer available; the current client data, not that dead image, is the verification source.

## Coordinates and kick priority

The client represents matrix rows with y increasing downwards, and rotations as 0, 1, 2, 3 (spawn, right, reverse, left). The trainer uses y increasing upwards. Every source kick's y is negated exactly once; x and candidate order are retained. A legal unshifted rotation is attempted before the source's nonzero offsets.

JLSTZ use a 3x3 matrix with its middle cell as rotation origin. The I uses a 4x4 matrix and rotates around its geometric center. In this trainer its matrix offsets are authored relative to bottom-left grid position (1,1), making its center offset (0.5,0.5); CW transforms `(x,y)` into `(y,1-x)`. The O's occupied cells stay fixed across rotations and it has no kick candidates.

The following complete candidate lists already use **y-up** and include the unshifted test. Priority is left to right.

| Transition | JLSTZ offsets                                 |
| ---------- | --------------------------------------------- |
| 0→R, 2→R   | (0,0), (-1,0), (-1,1), (0,-2), (-1,-2)        |
| R→0, R→2   | (0,0), (1,0), (1,-1), (0,2), (1,2)            |
| 2→L, 0→L   | (0,0), (1,0), (1,1), (0,-2), (1,-2)           |
| L→2, L→0   | (0,0), (-1,0), (-1,-1), (0,2), (-1,2)         |
| 0→2        | (0,0), (0,1), (1,1), (-1,1), (1,0), (-1,0)    |
| R→L        | (0,0), (1,0), (1,2), (1,1), (0,2), (0,1)      |
| 2→0        | (0,0), (0,-1), (-1,-1), (1,-1), (-1,0), (1,0) |
| L→R        | (0,0), (-1,0), (-1,2), (-1,1), (0,2), (0,1)   |

| Transition | I offsets                            |
| ---------- | ------------------------------------ |
| 0→R        | (0,0), (1,0), (-2,0), (-2,-1), (1,2) |
| R→0        | (0,0), (-1,0), (2,0), (-1,-2), (2,1) |
| R→2        | (0,0), (-1,0), (2,0), (-1,2), (2,-1) |
| 2→R        | (0,0), (-2,0), (1,0), (-2,1), (1,-2) |
| 2→L        | (0,0), (2,0), (-1,0), (2,1), (-1,-2) |
| L→2        | (0,0), (1,0), (-2,0), (1,2), (-2,-1) |
| L→0        | (0,0), (1,0), (-2,0), (1,-2), (-2,1) |
| 0→L        | (0,0), (-1,0), (2,0), (2,-1), (-1,2) |
| 0→2        | (0,0), (0,1)                         |
| R→L        | (0,0), (1,0)                         |
| 2→0        | (0,0), (0,-1)                        |
| L→R        | (0,0), (-1,0)                        |

The I-specific 180 list is intentionally shorter than the JLSTZ list. SRS+ also changes I 90-degree test priority from ordinary SRS; matching just the unordered set is insufficient.

## Spawn and hidden rows

The reviewed client defines default width 10, visible height 20, buffer 20. Its spawn anchor is x=4, yDown=buffer−2.04; occupied rows are evaluated with `ceil(yDown)`. At strict zero gravity this yields:

- JLSTZ: pivot (4,21), occupied rows y=21 and y=22.
- I: occupied x=3,4,5,6 at y=21. The trainer's I anchor is (4,20) because its horizontal row has offset y=1.
- O: occupied x=4,5 at y=21,22.

These are initial zero-gravity cells, before any automatic descent. The trainer does not simulate fractional gravity. Its display can show the spawn buffer above the 20-row playfield without changing collision coordinates.

## DCD

The [official handling FAQ](https://tetrio.github.io/faq/mechanics.html#dcd) gives the player-facing explanation: pauses associated with rotation and spawn. The current client adds precise conditions:

- A failed horizontal movement sets a wall-contact flag, including collision with the stack.
- Successful horizontal movement clears it. Spawn clears it after applying DCD to the outgoing piece's flag.
- After a successful rotation, and before spawning, DCD runs only when that wall-contact flag is set and DCD is nonzero. Failed rotations do not apply it.
- The DAS charge for each direction becomes at most DAS−DCD. ARR charge is set to its configured threshold. Accordingly a fully charged direction waits DCD, then immediately shifts; an incompletely charged direction waits the greater of its remaining DAS and DCD. It does not add ARR afterward.
- Rotating the O succeeds with unchanged occupied cells, so its rotation can also apply DCD.
- Source handling units are 60 Hz frames. The trainer exposes milliseconds; 1 reference frame = 1000/60 ms.

## Independently constructed spin fixtures

These fixtures were constructed by checking occupied cells and each earlier candidate independently. They are not generated from the engine's kick table. `#` denotes an occupied cell and `.` empty; rows below are listed **bottom-up**. All unlisted cells are empty. Piece positions are rotation pivots for JLSTZ.

### T-spin triple, clockwise

```
y0 ####.#####
y1 ####..####
y2 ####.#####
y3 ..........
y4 ....#.....
```

Move a spawn T to x=7 and instant-soft-drop to y=3. Move left twice beneath the overhang to orientation 0, pivot (5,3). Dropping directly at x=5 hits the roof and cannot enter. CW must yield R at (4,1), using (-1,-2), the fifth test including the base test. The base test collides at (5,2); the next two hit the overhang (4,4); the fourth hits (5,0). The fifth fits (4,0), (4,1), (4,2), (5,1). Hard drop clears exactly three lines.

### T-spin triple, counterclockwise mirror

```
y0 #####.####
y1 ####..####
y2 #####.####
y3 ..........
y4 .....#....
```

T0 at (4,3), CCW → L at (5,1), kick (1,-2); hard drop clears three. Enter by instant soft drop at x=2, then move right twice beneath the roof to x=4.

### S-spin double

```
y0 ###..#####
y1 ####..####
```

S0 at x=3: CW → R; instant soft drop → pivot (3,2); CW → 2 at (4,1), kick (1,-1). The first two candidates hit (3,1); the destination cells are (3,0), (4,0), (4,1), (5,1). Hard drop clears two. The opposite pair of rotations does not enter this slot.

### Z-spin double, mirrored

```
y0 #####..###
y1 ####..####
```

Z0 at x=6: CCW → L; instant soft drop → pivot (6,2); CCW → 2 at (5,1), kick (-1,-1); hard drop clears two. This mirrors the S case.

The S/Z sequences agree with the official [S/Z spin explanation](https://tetrio.github.io/faq/mechanics.html#zspins). These tests prove placement and line clearing, not scoring or spin-bonus classification, which are outside this milestone.

### S/Z doubles with two walls

Add a third row `y2 ...#..#...` to each S/Z board above. The entry rotation directions reverse, matching the second example in the official FAQ:

- S: start S0 at x=5; CCW → L; instant soft drop → L(5,2); CCW → 2(4,1), kick (-1,-1). The base candidate hits (6,2), the second hits (3,1), and the third fits. Hard drop clears two.
- Z mirror: start Z0 at x=4; CW → R; instant soft drop → R(4,2); CW → 2(5,1), kick (1,-1). Hard drop clears two.

Together the open and walled fixtures exercise both rotation directions for each of S and Z.

## T-spin feedback

The reviewed client's `IsTSpin` checks grounded state, rotation history, and at least three occupied corners. The trainer evaluates this at lock time before rows are cleared. Full and mini T-spins are announced separately, optionally followed by the clear name. No points or spin bonus calculation is added.

Mini classification verified against the public TETR.IO client on 2026-10-28: its corner test counts the two orientation-facing corners, labels fewer than two as mini, and promotes kick index 3 to normal. The client indexes only displaced kicks; this trainer includes the base test, so the equivalent index is 4 (also for 180-degree rotations). Existing last-successful-movement checks remain in effect.
