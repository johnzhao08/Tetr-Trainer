# Learning curriculum research

> Note: the current curriculum (stages, scored drills, gates, saved progress) follows [reports/Competitive Tetris learning progression.md](../reports/Competitive%20Tetris%20learning%20progression.md). This file records where the opener and reference modules came from. Its module table and the "success is judged by events" rule below describe those modules only; the planned solver pages and the quad, cheese and finesse-test modules it lists have been removed.

Retrieved 2026-11-24. This note records where the module content comes from, so drills teach real technique rather than shapes recalled from memory.

## Prior work already in this folder

- `REFERENCE_NOTES.md` / `GAMEPLAY_SPEC.md`: verified TETR.IO SRS+ kicks (including 180), spawn rules, DCD, and independently built T-spin triple and S/Z spin fixtures. Every module reuses this engine unchanged.
- The basic T-spin module already uses the TKI shape Hard Drop calls "Fonzie" (J horizontal over S/O; `L..ZZ.SJJJ` / `L...ZZSSOO` / `LL.IIIISOO`), https://harddrop.com/wiki/TKI_3_Opening.
- `../lst-solver` (Rust, 2026-11-12): exact and bag-level search for sustained LST stacking. Strict LST was not shown to be sustainable; most losses had a T stuck in hold. This is the groundwork for the planned **ST stacking solver** module.
- Unmerged branches `lst-stacking`, `lst-construction-evaluator`, `9-0-solver`: an earlier in-app LST evaluator and a finesse/attack stats tracker. They are not on `main`, so the learning revamp starts from `main` and leaves solver work as planned modules.

## External sources

Hard Drop wiki, read as raw wikitext (`https://harddrop.com/wiki?title=<page>&action=raw`) so board diagrams could be transcribed cell by cell:

| Page | Used for |
| --- | --- |
| Perfect Clear Opener | First-bag shape (L/J/O rectangle, T/S/Z trapezoid, I held or vertical), 84.6% PC odds with I held, S/Z/L/J spin tips |
| TKI 3 Opening | First-bag TKI shapes and the T-spin double slot |
| Double Triple Cannon Setups | DT Cannon empty-field shape (TSD then TST) |
| Finesse | Definition: fewest key presses to reach a placement; DAS to a wall counts as one press |
| MKO Stacking, Super T-Spin Double, Albatross Special, Mountainous Stacking | Considered; deferred because their continuations depend on the second bag or need a solver to teach well |

Diagrams with `G` (any garbage) or `P` (T placement) cells were treated as: `P` = the T-spin slot, `G` = cells the player fills freely.

## Curriculum

The home screen groups modules into three levels. Playable modules only use the engine; anything that needs search or evaluation is listed as **planned** with a description of what it will do.

| Level | Module | Kind | Skill |
| --- | --- | --- | --- |
| Beginner | Basic T-spin setup | Ready | Overhangs, full vs mini T-spins |
| Beginner | Finesse fundamentals | Ready | Minimal inputs, with hints |
| Beginner | Quad practice | Ready | Clean stacking with a well |
| Beginner | Cheese basics | Ready | Digging single-hole garbage |
| Beginner | Stacking coach | Planned | Needs a board evaluator |
| Intermediate | Finesse test | Ready | Minimal inputs, no hints, timed |
| Intermediate | TKI-3 opener | Ready | First-bag TSD opener |
| Intermediate | Perfect clear opener | Ready | First-bag PCO and a 4-line PC |
| Intermediate | T-spin triple entry | Ready | The SRS+ TST kick |
| Intermediate | Cheese race 10L | Ready | Messy garbage, timed |
| Intermediate | Perfect clear finder | Planned | Needs a PC solver |
| Intermediate | Cheese dig optimizer | Planned | Needs a downstack search |
| Advanced | DT Cannon | Ready | TSD into TST |
| Advanced | Cheese race 18L | Ready | Sustained messy digging |
| Advanced | ST stacking solver | Planned | Needs an ST/LST solver |
| Advanced | Opener continuation planner | Planned | Needs multi-bag search |

## Design rules

- Shape guides are advice, not a template match. Success is judged by events the engine already reports (full T-spin with N lines, all clear, garbage lines cleared), so any correct build passes.
- Every opener shape is checked in tests by building it piece by piece with the real engine and performing its spin through key inputs.
- Finesse optimal counts come from a breadth-first search over press actions (tap, DAS to wall, CW, CCW, 180) on an empty board. This is not a solver for play; it only measures one placement.
