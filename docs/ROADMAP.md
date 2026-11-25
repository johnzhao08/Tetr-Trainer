# Roadmap: teaching every technique the research endorses

Source: `reports/Competitive Tetris learning progression.md` and the research notes behind it. This file lists what the app still has to teach, the exact specs implementers work from, and the order. Each phase is one PR under 1,000 added lines.

## Gaps (from the 2026-11-25 gap analysis)

Done: Season 2 attack and All-Mini+ spins, incoming garbage with travel time and cap, stacking coach (holes, overhangs, T-slots, spikes, wells), key moments with retry, saved progress and gates, TSD hunt, B2B chain, finesse on a real stack, quads-only and no-hold 40L.

Missing or partial:
- **T-spin vision**: overhangs from all 7 pieces, forecasting, skimming, dead boards, floating T-spins; timed recognition runs.
- **Donations**: Kaidan, SZ prop, STMB Cave, Shachiku Train, Parapet. The coach also penalises the well cover a donation needs.
- **Named structures**: STSD, TST (beyond a one-piece puzzle), Triple Double / C-Spin, Fractal, Imperial Cross, Cut Copy, DT-STSD.
- **Dig rules** (Hard Drop): know the next hole, blocks over holes cost lines, I only on garbage, hold the piece the hole needs, garbage doubles early, own lines vs garbage; multi-hole and clean garbage; combos for digging; efficiency = (sent + dug) / built.
- **Tempo**: opener phase (double cancel for 14 pieces), garbage multiplier ramp after 3:00, an opponent with height and B2B that receives your attack, B2B-gap warning at 8, cancel vs send.
- **B2B/Surge decisions**: all-mini spins as B2B keepers, when to break and release Surge.
- **Puzzles**: positions harvested from your own sessions, themes, Glicko rating, spaced review of failures.
- **Openers**: spaced repetition per first bag, mirror, fail-fast, continuation bags graded by the coach.
- **Tools**: handling setup wizard (ARR 0, DAS stepped down from 130 ms), stat glossary, opt-in freeplay saving with weekly APP/PPS trends, audio metronome and PPS cap, a greedy sparring bot.
- **Coach**: side well that blocks a T-slot, look-ahead over the next bag, dead-board detection.
- Intentionally left out (traps per the research): ST stacking, 4-wide, 20TSD.

## Sourced structure fixtures

**Rule: every structure or setup shape comes from a researched diagram with its source cited. The engine only verifies a sourced shape (`chainSearch` in `src/core/structures.ts`); it never generates or finds one.** If no diagram exists for something, leave it out. Never keep a shape because a search produced it.

Shapes are decoded from the fumen diagrams in the four.lol pages (top-down rows, 10 wide, `X` filled). Diagram numbers count the page's fumens from 0.

| Structure | Source | Chain the engine verifies |
| --- | --- | --- |
| TSD | https://four.lol/srs/t-spin, diagram 0 | full 2 |
| TST | https://four.lol/methods/tspin-triple, diagram 0 | full 3 |
| STSD | https://four.lol/methods/stsd, diagram 0 | full 2, full 2 |
| Triple Double | https://four.lol/methods/triple-double, diagram 0 | full 3, then full 2 |
| Fractal | https://four.lol/methods/fractal, diagram 0 | full 2, full 2 |
| Imperial Cross | https://four.lol/methods/imperial-cross, diagram 0 | full 2, full 2 |
| Kaidan | https://four.lol/methods/kaidan, diagram 0 (stair, Z, I roof) | full 2, then the well is quad-ready |

```
TSD            TST             STSD           Triple Double
XXXX......     XXXX......      ..XXXXXXXX     XXXX..XXXX
XXX...XXXX     XXX.......      ...XXXXXXX     XXX...XXXX
XXXX.XXXXX     XXX.XXXXXX      XX.XXXXXXX     XXX.XXXXXX
               XXX..XXXXX      X..XXXXXXX     XXX..XXXXX
               XXX.XXXXXX      X..XXXXXXX     XXX.XXXXXX
                                              XXXX.XXXXX

Fractal        Imperial Cross  Kaidan
XXX.......     XXXX..XXXX      ...XXXX...    (I roof; the page draws the
XX...XXXXX     XXX...XXXX      XXXXXX...X     stair and Z only. The bottom
XXX.XXXXXX     XXX.XXXXXX      XXXXXXX.XX     two well rows are the well
XX...XXXXX     XX...XXXXX      XXXXXXXXX.     running on, so the quad is
XXX.XXXXXX     XXX.XXXXXX      XXXXXXXXX.     ready after the spin.)
                               XXXXXXXXX.
                               XXXXXXXXX.
```

Lesson builds use the pieces of the same pages' build diagrams: Kaidan diagrams 0 and 4 (Z over the well, I or L roof), TST diagrams 1 and 2 (L or J overhang), STSD diagrams 1 and 4 (J, then I or Z), Triple Double diagrams 1 to 3 (the J and L of the C-Spin). No four.lol build diagram ends in the Fractal or Imperial Cross headline board, and none other than the C-Spin ends in the Triple Double one, so those guided steps start from the ready board and only the spins remain.

Not sourced, so not shipped: STMB Cave, Shachiku Train, Parapet and SZ prop shapes (no fixture; see the cue-only notes below), and Cut Copy / DT-STSD.

Values with B2B active and no combo: TSD 5, TST 7, TSS 3, quad 5, non-T mini double 2.

- **TSD**: the default attack.
- **STSD**: two TSDs; build over Tetris columns or recover from a misdrop. Needs T pieces soon or it leaves a hole; often misused.
- **TST**: from a notch, a two-step stair, S/Z one-step stairs, or a converted TSD. Leaves overhang to clean; sometimes a TSD is better.
- **Triple Double**: a TST first, then a TSD (12 lines with B2B); midgame setup from a notch or two-step stair; the J/L build is called C-Spin.
- **Fractal**: when no I is coming, usually built on an existing TSD.
- **Imperial Cross**: after TKI or to fix a bad overhang when a Fractal cannot be built; slow.
- **Donations** (rules from the notes; shapes must come from a four.lol diagram, then be verified by the two-spin search before shipping): a TSD whose cleared rows include cells placed over a well or hole, leaving the rows underneath untouched so the well reopens. Kaidan: TSD donated from the edge of a stair, fixes parity, a subset of SZ prop. STMB Cave: S/Z hung over a 3-wide gap between two equal columns, then an air T-spin under it. Shachiku Train: TSD into TSD from a 2x4 empty space, can chain. A donation can leave a worse stack than plain stacking.

## Recognition cues (board predicates)

1. TSD slot: `findTsdSlots`.
2. STSD: a 3x3 empty space with a roof on one side and a 1-wide shaft offset one column going 2 rows deeper.
3. TST / TD: a notch (a 3-deep shaft whose middle row is 2 wide, roof two rows above); TD is that with a TSD slot on top.
4. Kaidan: a two-step stair next to a well.
5. STMB: two equal-height columns with an empty 3-wide gap.
6. Dead board: no reachable T-spin, no quad path, none creatable within 2 placements.
7. Overhang from each piece: placements of a type that create cells a T can spin into (`reach().spin`).
8. Forecasting: a slot exists by the time the previewed T arrives.
9. Floating T-spin: a slot whose clear leaves non-full rows beneath it.

## Dig rules as per-placement checks

G = rows containing garbage; h = the hole column of the topmost garbage row.
- `next-hole-blocked`: the lock adds cells in column h above that row without clearing it.
- `cost-lines`: covered cells over garbage holes increase (+n lines to dig).
- `wasted-i`: an I locks, clears no garbage, and garbage exists.
- `hold-fit`: the held or next piece has a placement that clears a garbage row, and this lock covers h instead.
- `own-line`: the lock clears lines, none of them garbage, while garbage exists.
- Metrics: early garbage doubles (locks clearing 2+ garbage rows in the first 20 pieces); efficiency = (sent + dug) / (pieces x 0.4).

## Phases

| # | Phase | Key pieces |
|---|---|---|
| 1 | Position and puzzle core | `core/position.ts`, `core/puzzle.ts`, goals (tspin, spinClear, dig, keepB2b, noFlag, buildSlot), `PuzzleScreen` |
| 2 | Spin finder and structure library | `core/spins.ts` (all reachable T and mini spins), `core/structures.ts` with fixtures, cues and notes |
| 3 | T-spin vision core | `core/placements.ts`, seeded realistic stack generator, question types (findSlot, whichPiece, isDead, forecast) |
| 4 | T-spin vision UI | `VisionScreen` with streak and 3-minute timed runs, saved and gated |
| 5 | Donations | coach exemption for covered cells a reachable spin clears, lesson framework (guided build, recognition, drill), Kaidan/STMB/Shachiku |
| 6 | Structure lessons | STSD, TST, TD/C-Spin, Fractal, Imperial Cross lessons with gated drills |
| 7 | Dig coach | dig flags and metrics above, multi-hole and clean garbage |
| 8 (done) | Season 2 tempo | opener phase, garbage multiplier ramp, reactive opponent, B2B-gap warning |
| 9 | Surge and all-mini drills | break-or-keep prompts, mini-spin B2B keepers |
| 10 | Saved logs and harvested puzzles | progress v2 with replayable placement logs, puzzles from your mistakes |
| 11 | Rating and spaced repetition | Glicko per theme, Leitner review queue |
| 12 | Opener side track | mirror, fail-fast, continuation bags, spaced repetition |
| 13 | Handling, glossary, trends | handling wizard, stat explanations, opt-in freeplay saving, weekly trend chart |
| 14 | Pacing and sparring | audio metronome, PPS cap, greedy sparring bot |

## Risks

- Deeper searches (dig optimizer, Surge evaluation) need pruning and short puzzles (6 pieces or fewer).
- No sourced Surge-release theory: score outcomes against a scripted opponent instead of prescribing rules.
- SRS+ 180 kicks may not mirror; test before shipping mirrored openers.
- Placement logs: about 0.7 MB for 600 sessions of 150 pieces, fits in localStorage.
- Puzzles and spaced repetition are not proven to transfer; the weekly trends in phase 13 measure it.
