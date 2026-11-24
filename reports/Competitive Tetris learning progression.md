# Train the Midgame, Not the Opener

The most reliable route into competitive TETR.IO runs through clean, hole-free stacking, then efficient digging, then T-spin Doubles found in random-piece play, then keeping back-to-back (B2B) chains alive under Season 2's Surge rules, and only then raw speed and spike timing. Openers are an optional late add-on; expert guides and the 2024 rule changes both put them at the bottom of the list. Official rank data explains the order. Average attack per minute rises about **27-fold from D to X+**, and attack per piece (APP) and pieces per second (PPS) each account for roughly half of that rise. Efficiency is the bigger lever below the median, and speed is the bigger lever from SS upward. The practice methods strong players endorse share one design. They keep the random 7-bag and the decision problem intact, narrow the objective, and score efficiency (pieces per garbage line, APP at a target speed) instead of completion. Deliberate review of your own games sits on top. Fixed-sequence grinding of openers, perfect-clear openers and "20TSD" is repeatedly called a trap. Tetr Trainer trains almost the inverse. Most of its 11 playable modules end on one engine event on a fixed or empty board with zero gravity, judge success by that event rather than by decisions, and save nothing between sessions. Every feature that would grade judgment sits on a "planned" page or an unmerged branch. The fix is a different unit of practice, not more lessons: random-queue midgame drills graded placement by placement, Season 2-correct attack and B2B scoring, adjustable pressure, and saved progress gated on measured APP and PPS. That is also where the market is empty: at least five free web apps already drill openers, while no widely used tool reviews a player's own placements.

## Efficiency and speed split the D-to-X+ climb almost evenly

The best evidence on what matters comes from TETR.IO's own rank statistics. On 24 November 2026 the research team pulled the official per-rank averages for about 36,000 ranked TETRA LEAGUE players from the TETRA CHANNEL API. They broke the averages down with the community Tetra Stats formulas ([TETRA CHANNEL API](https://ch.tetr.io/api/labs/league_ranks); [TetraStats formulas](https://github.com/dan63047/TetraStats/blob/HEAD/lib/data_objects/nerd_stats.dart)). Average APM climbs from **6.9 at D to 183.5 at X+**. APM equals APP × PPS × 60, so that climb splits into **PPS ×4.9 and APP ×5.4**: speed and efficiency contribute almost equally across the whole ladder. The mix shifts with level. Below the median, **56–62% of APM growth comes from efficiency**. From U to X to X+, **63–66% comes from raw speed** ([TETRA CHANNEL API](https://ch.tetr.io/api/labs/league_ranks)). In a stratified sample of 1,800 players, APM tracks rating at Spearman ρ ≈ 0.98, and PPS and APP each at about 0.94 ([TETRA CHANNEL API – users by league](https://ch.tetr.io/api/users/by/league)).

| Rank (lower edge, % from top) | PPS | APP | APM | Garbage dug per piece | Median 40L PB | 40L finesse-perfect | Median hours played |
|---|---|---|---|---|---|---|---|
| D (100%) | 0.71 | 0.16 | 6.9 | 0.04 | 167 s | 34% | 10 |
| C (90%) | 0.89 | 0.24 | 12.9 | 0.06 | 106 s | 45% | 34 |
| B (70%) | 1.07 | 0.30 | 19.3 | 0.09 | 79 s | 59% | 67 |
| A (46%, contains median) | 1.27 | 0.38 | 28.6 | 0.11 | 80 s | 66% | 129 |
| S (23%) | 1.60 | 0.49 | 46.8 | 0.13 | 53 s | 72% | 335 |
| SS (11%) | 1.98 | 0.61 | 72.6 | 0.15 | 36 s | 85% | 624 |
| U (5%) | 2.36 | 0.70 | 98.8 | 0.16 | 29 s | 93% | 881 |
| X (1%) | 2.92 | 0.79 | 139.4 | 0.16 | 23 s | 97% | 1,158 |
| X+ (0.2%) | 3.50 | 0.87 | 183.5 | 0.17 | 18 s | 99% | 1,776 |

*PPS, APP, APM and dig rate are official rank averages ([league_ranks](https://ch.tetr.io/api/labs/league_ranks)). The 40L and finesse columns are medians from 10 sampled players per rank ([user summaries](https://ch.tetr.io/api/users/)). Hours are medians from about 100 players per rank ([users by league](https://ch.tetr.io/api/users/by/league)). APP, the dig rate and all medians are the research team's own calculations.*

Three more patterns shape what a trainer should teach. First, downstacking efficiency (garbage dug per piece) quadruples from D to U and then flattens. It correlates with rating at **ρ 0.57 within D–B+ but only 0.32 within S+–X+**. Digging separates the low and middle tiers and becomes a baseline at the top ([TETRA CHANNEL API – users by league](https://ch.tetr.io/api/users/by/league)). Second, VS/APM sits at about 2.0–2.1 at every rank. The offense-versus-defense mix barely changes up the ladder; what changes is throughput per piece and per second ([TETRA CHANNEL API](https://ch.tetr.io/api/labs/league_ranks)). Third, finesse rises from about a third of pieces at D to two-thirds at A and 97–99% at X and X+. The median player carries a finesse debt that is cheap to repay, and finesse becomes close to mandatory higher up. Sprint times match the APM breakdown. Median 40-line PBs barely move from C+ to A (around 80 seconds), then fall steeply to 18 seconds at X+, so pure speed work pays little below the median. Popular sprint tiers are badly calibrated as a result: a 2026 guide calls a 1:20 sprint "beginner", which is the level of the median ranked player ([Mythras sprint guide](https://gamertagmythras.com/blog/tetris/tetris-sprint-40-lines-guide)).

Expert writing reaches the same conclusion. winterNebs's widely used FAQ states that "learning openers is not as important as learning how to play the mid game" and that "T-spinning comes back to stacking". It also warns that in versus you should "never compromise your stack for T-spins" ([winterNebs – Versus](https://winternebs.github.io/TETRIS-FAQ/versus); [winterNebs – T-Spin Guide](https://winternebs.github.io/TETRIS-FAQ/tspin)). four.lol, which the same FAQ calls the only accurate wiki for versus, calls donations "essential" given "the recent emphasis on maintaining high stacking efficiency". It also says openers like MKO and C-Spin get better "the better you get at stacking" ([four.lol – Donation](https://four.lol/mid-game/donation); [four.lol – Practical Openers](https://four.lol/openers/practical-openers)). Time accounting agrees. At the median player's 1.2 PPS, TETR.IO's 14-piece opener phase lasts **about 12 seconds** ([TetrisWiki – TETR.IO](https://tetris.wiki/TETR.IO)). Meanwhile the median A-rank player has logged **about 130 hours**, S about 335 and X+ about 1,780. A few hours of opener memorization cannot explain gaps measured in hundreds of hours.

These figures are correlational and come from one day's snapshot. Rating comes from wins, APM partly reflects the opponent, hours include time played after reaching a rank, and the sprint and finesse columns rest on ten players per rank. Even so, the stats, the expert texts and the time accounting all point the same way. What decides games is the quality of thousands of midgame placements made at rising speed. In order of importance, the things to learn are:

1. Stack evaluation and midgame continuity: always having a next TSD, quad or spin available without creating piece dependencies.
2. Efficiency held up as speed rises.
3. B2B and Surge management.
4. Garbage reading and efficient digging.
5. Recognition of named midgame structures.
6. Versus tempo.
7. Openers.

## Season 2 made back-to-back the currency of attack

TETR.IO's Season 2, live since 16 August 2024, rewired the attack economy, and the TETRA LEAGUE ruleset has not changed since January 2025. The core change is **B2B charging**. B2B still sends one extra line per clear "like Guideline", but from B2B×4 the game "starts charging up a huge Surge Attack". The Surge is released when the chain breaks, split into three separate attacks. Season 2 also changed three other rules ([TETR.IO patch notes](https://tetr.io/about/patchnotes/notes.json)):

- **All-Mini spins.** Spins by every piece now count as minis. They "do not send, but they do add (and keep) Back-to-Back".
- **All Clears.** They were cut from 10 lines to **5** and now count as B2B.
- **Opener phase.** During the first 14 pieces, a defender who is behind cancels incoming lines at double rate.

Beta 1.3.0 (September 2024) added a flat **+1 line for quads and spins that clear garbage**. Beta 1.5.0 (January 2025) added All-Mini+: immobile T-spins that fail the three-corner rule now count as minis. Every patch since, up to Beta 1.7.8 on 1 April 2026, touches only Quick Play, events, the client or rating mechanics ([TETR.IO patch notes](https://tetr.io/about/patchnotes/notes.json)). The 2026 TETR.IO World Series format reportedly still references Tetra League Season 2 ([Liquipedia – TWS 2026](https://liquipedia.net/tetris/TETR.IO_World_Series/2026)).

The research team ran the community-reimplemented attack table over a garbage-free board, where one line costs 2.5 pieces. The per-piece values explain the meta ([triangle damageCalc](https://github.com/halp1/triangle/blob/HEAD/src/engine/utils/damageCalc/index.ts)). With B2B active, a T-spin Double yields about **1.0 attack per piece**, a T-spin Single 1.2 and a T-spin Triple 0.93. A quad yields 0.5, a plain triple 0.27 and a double 0.2. Each bag holds exactly one T, so a TSD every bag tops out near **0.71 APP**. The X+ average is 0.87, so top players must be adding Surge, the garbage-clear bonus and cheap digging on top. Digging is cheap because a garbage row needs one cell to clear rather than ten: a quad through four clean garbage rows can cost a single I piece and send 4 + 1 (B2B) + 1 (garbage bonus) = 6. Combos multiply a base value instead of adding lines, and a singles-only combo sends just ln(1 + 1.25x), about 1.8 lines at a 4-combo before rounding down ([TetrisWiki – TETR.IO](https://tetris.wiki/TETR.IO)). That is one reason 4-wide, already "a big noob trap since it is so broken" in winterNebs's words, pays poorly here ([winterNebs – Versus](https://winternebs.github.io/TETRIS-FAQ/versus)). These per-piece figures are the research team's own derivation from a community engine. TETR.IO publishes no official attack table.

The developers name the consequence themselves. When adding the garbage bonus, garbo wrote that "Surge as the primary win condition puts too much of an emphasis on speed". They added that 1:1 cancelling produced exchanges "with 0 advantage" ([TETR.IO patch notes](https://tetr.io/about/patchnotes/notes.json)). The 1v1 interface warns a player who falls **8 or more B2B behind** ([TetrisWiki – TETR.IO](https://tetris.wiki/TETR.IO)), so the game itself treats the B2B gap as the main tempo indicator. The central versus decision is therefore when to break B2B and release Surge. That depends on the opponent's height, the garbage waiting to enter, and your own chain. Long games also get harsher: in the league preset, gravity rises after two minutes and the garbage multiplier after three ([triangle presets](https://github.com/halp1/triangle/blob/HEAD/src/classes/room/presets.ts)). Openers lost ground accordingly. A 2026 Japanese community survey of Season 2 openers rates the opening perfect clear one star for brute force and zero for B2B, and rates TKI's opening TSD low on both. It puts B2B-oriented templates such as Lazy TSS and Chargespin v3 at the top, though its author calls the weighting subjective ([61bi – Season 2 openers](https://note.com/61bi_234469/n/n2778ae5420e2?hl=en)).

Stacking, finesse, TSD and downstacking fundamentals carry over unchanged. Much of the English-language canon, though, predates these rules. The winterNebs FAQ dates from 2021 and four.lol from 2018–2022, and four.lol still lists the PCO as sending 10 lines ([four.lol – Practical Openers](https://four.lol/openers/practical-openers)). The advice that "breaking back to back to get another T-Spin double is not that bad" ([winterNebs – Versus](https://winternebs.github.io/TETRIS-FAQ/versus)) now ignores the stored Surge that breaking throws away. The case against perfect-clear openers is stronger than when it was written, because their payoff halved. Season 2 also merges two skills that older curricula kept apart. All-Mini spins let a player keep B2B while digging, so downstacking and attack maintenance become one decision. The weak spot is theory. The research found **no sourced high-level analysis of when to release Surge**, only tournament VODs it could not open. A trainer should therefore teach Surge timing as decision drills with measurable outcomes, not as fixed rules.

## Stack, dig, spin, chain, then speed up

Every guide that commits to an order puts clean, flat, hole-free stacking with a well first, and openers late or optional. The Tetris Effect: Connected community guide counts the well-known player-researcher Kirby703 among its contributors. Its chapters run from stacking ("one of the side columns needs to be empty") to SRS kicks, downstacking, T-spins, and then openers, about which it says "you don't really need to learn them if you don't want to!" ([Tetris Effect community guide](https://tetriseffect.game/beginners-community-guide/)). winterNebs sets a hard gate: if you cannot finish a Tetris-only 40-line sprint in under 1:15 on fast games like Jstris (1:30 in the slower Puyo Puyo Tetris), work on that before versus technique ([winterNebs – Versus](https://winternebs.github.io/TETRIS-FAQ/versus)). A post-Season 2 rank-by-rank study guide prescribes a drill set for each rank and treats openers as optional throughout ([Avergrove – Rank Studies](https://avergrove.github.io/avergroves-learning-notes/docs/tetris/rank_studies)):

- **C:** no-hold and Tetris-only sprints.
- **B:** quad-only sprints and finesse.
- **A:** column stacking with 9-0 through 5-4 wells, downstack practice, and first T-spins ("Do not compromise your stack for a TSD").
- **S:** spiking timed to the opponent's height.

Within the T-spin stage, the order runs from noticing to building to planning. winterNebs starts with opportunistic T-spins on shapes that happen to form. Next comes building overhangs on purpose ("The more you build the less you will have to rely on chance"), then forecasting, height difference and skimming as a fix. Last come donations, floating T-spins and spotting dead boards ([winterNebs – T-Spin Guide](https://winternebs.github.io/TETRIS-FAQ/tspin)). The structures strong players actually use mid-game include donations such as Kaidan and STMB, STSD, Fractal, Imperial Cross after TKI, and TSTs or Triple Doubles from notches and stairs. Players build them opportunistically from sub-shapes they recognize. As four.lol puts it, "most STSDs are built by recognizing a 3-column, 3-row empty space" ([four.lol – STSD](https://four.lol/methods/stsd); [four.lol – Triple Double](https://four.lol/methods/triple-double)). Repeating stacking loops are a different matter: ST stacking is "not used in multiplayer because you cannot quickly clear your accumulated lines" ([four.lol – ST Stacking](https://four.lol/stacking/st)).

Sources disagree in three places, and the data settles two of them. The first is finesse. Galactoid wants it automated in the first one to two weeks, warning that "you could spend years habituated to an inefficient set of keypresses". Hard Drop says many players pick it up "subconsciously", and winterNebs notes that "lots of top players do not have 'perfect finesse'" ([Galactoid – Speed and Finesse](https://howtotetris.com/the-whys-of-speed-and-finesse/); [Hard Drop – Finesse](https://harddrop.com/wiki/Finesse); [winterNebs – General](https://winternebs.github.io/TETRIS-FAQ/general)). The rank data shows that most players do not learn finesse early but nearly all top players have it. Drilling it early is cheap insurance rather than a prerequisite. The second is whether digging or T-spins comes first. The Tetris Effect guide puts downstacking first, and the data backs it, because dig efficiency matters most at low ranks. The third is about rigid rules. Galactoid calls "never waste a T" a "cargo cult" tenet that left them stacking dirty over holes for months ([Galactoid – Order of Progression](https://galactoidtetris.wordpress.com/2025/08/10/an-optimized-and-grounded-order-of-tetris-progression/)). That argues for judging T-spin play by stack health, not by T-spin count.

The research team combined these sources with the rank averages into the staged roadmap below. It is their synthesis, not a published consensus. Placing spike and Surge timing after S rank is an inference, because no verifiable source orders those skills. Two features matter for app design. Speed and efficiency rise together at every tier, so stages overlap rather than replace one another. And each exit signal can be measured, which is what makes it usable as a gate.

| Stage | Rank band | Typical PPS / APP | Core skills | Signal to move on |
|---|---|---|---|---|
| 0. Controls | D | 0.7–0.8 / 0.16–0.20 | Hold, both rotations, handling settings, SRS basics | Rarely tops out from misdrops; no holes in a calm 40L |
| 1. Clean stacking | C | 0.8–0.95 / 0.22–0.26 | Flat stack with a well, no holes, Tetrises, hold to avoid bad placements | Survives garbage by digging, not luck |
| 2. Downstacking + first TSD | B | 1.0–1.13 / 0.28–0.32 | Digging messy garbage, TSD recognition and building, finesse cleanup | Garbage dug per piece ≈0.08–0.09; TSDs arise naturally |
| 3. B2B economy | A | 1.2–1.37 / 0.35–0.41 | Continuous TSD/quad B2B, all-mini spins as B2B keepers, combos for digging; one or two openers optional | APP ≈0.4; can hold B2B ≥4 to charge Surge |
| 4. Efficient attack + speed | S | 1.47–1.75 / 0.45–0.54 | STSD, TST, Fractal, spike construction, Surge timing; finesse ≈80% | APP ≈0.5 at ≥1.6 PPS |
| 5. Pressure and decisions | SS–U | 2.0–2.4 / 0.61–0.70 | Opponent reading, when to break B2B, defend vs. counter-spike, cancel timing | APP ≥0.6 sustained at 2+ PPS |
| 6. Elite | X–X+ | 2.9–3.5 / 0.79–0.87 | Speed while holding APP near 0.8; 97–99% finesse | — |

*Synthesized by the research team from the guides above; benchmarks from the official rank averages ([TETRA CHANNEL API](https://ch.tetr.io/api/labs/league_ranks)).*

## Drills that work keep the random bag and count pieces

The drills strong players endorse have one shape in common. They keep the random 7-bag and the decision problem intact, narrow the objective, and score efficiency. Downstacking is the clearest case. The Hard Drop downstacking guide opens with "playing normally is not enough". It prescribes a 10-line dig race in which you "try to get as many garbage doubles as you can" early ([Hard Drop – Downstacking Guide](https://harddrop.com/wiki/Downstacking_Guide)). Its rules are worth building into an app directly:

- Know what the next garbage hole looks like.
- Every block over a hole costs a line to clear.
- Spend I pieces only on garbage lines.
- Hold the piece the next hole needs.

Its efficiency metric is lines sent plus lines dug, divided by lines built. A player who describes themselves as usually around high SS practices on Jstris's 100-line cheese race. They score it by **fewest pieces, not time**: their best is 244 pieces, and they finish under 300 only about 30% of the time. That works out to roughly **2.4–3.0 pieces per garbage line**. They also offer a self-check: if your replay shows you mostly clearing colored, self-built lines, you are "just removing your own stacking" ([61bi – cheese race tips](https://note.com/61bi_234469/n/n2bc3b17b27a1?hl=en)). winterNebs states the general rule: decide the objective first, and "to improve cheese efficiency, focus on placing the fewest blocks" ([winterNebs – Fundamentals](https://winternebs.github.io/TETRIS-FAQ/fundamentals)). The same logic runs through constrained sprints (Tetris-only, no-hold, quad-only into a chosen well). It also runs through T-spin practice, where the drill is to "take a look at all 7 pieces in the game, and see what kind of overhangs you can build" ([winterNebs – T-Spin Guide](https://winternebs.github.io/TETRIS-FAQ/tspin)).

Speed comes after efficiency, not instead of it. Galactoid argues that "speed should hence be trained only after efficiency training", because speed multiplies the rate of mistakes. Galactoid reports that their own speed rose sharply only after they dropped unsafe methods ([Galactoid – Speed and Finesse](https://howtotetris.com/the-whys-of-speed-and-finesse/)). The pacing tools that exist point the same way:

- A 2026 sprint guide recommends a metronome set just above comfortable pace, and lowering DAS and ARR only once the current setting feels effortless ([Mythras sprint guide](https://gamertagmythras.com/blog/tetris/tetris-sprint-40-lines-guide)).
- Jstris runs a Slow Room capped at 1.5 PPS ([TetrisWiki – Jstris](https://tetris.wiki/Jstris)).
- TETR.IO's Mochbot and ZZZTOJ bots set their speed from your league stats, so sparring stays just within reach ([TETR.IO wiki – Bots](https://tetrio.wiki.gg/wiki/Bots)).

No source documents a tested speed-capped practice routine, so the right pace targets are still an open design question.

Reviewing your own games is endorsed more consistently than any single drill. winterNebs ties improvement to playing and reviewing, and warns that "there also is a difference between getting a new personal best and actually improving" ([winterNebs – General](https://winternebs.github.io/TETRIS-FAQ/general)). One detailed VOD-review method picks close matches ("ones where you pop off, but it was still close") that last into the midgame. It looks for repeated habits such as **panic downstacking** rather than single misdrops. It retraces why key decisions were made, and it calls in a peer or coach when no problem is visible ([iverhang – VOD review](https://sites.google.com/view/iverhang/articles/how-you-can-vod-review-and-improve)). Paid TETR.IO coaching follows the same arc. One four-week package spends a week each on attack, defense, review of a ranked game, and consolidation ([Metafy – Wumbo](https://metafy.gg/@wumbo/sessions/complete-training-package-eFDMs558YZX)).

The traps all replace reading the board with a memorized script. winterNebs's verdicts ([winterNebs – T-Spin Guide](https://winternebs.github.io/TETRIS-FAQ/tspin); [winterNebs – Versus](https://winternebs.github.io/TETRIS-FAQ/versus); [winterNebs – General](https://winternebs.github.io/TETRIS-FAQ/general)):

- **20TSD:** grinding this fixed structure means "you will likely just be wasting your time" unless you are an expert.
- **PCO:** "a very common noob trap … Not reliable to execute in vs."
- **BT Cannon:** people "just memorize BT and try and win with the opener".
- **4-wide:** "a big noob trap since it is so broken".
- **Setup lists:** "Looking at setups is a noob trap".

The one endorsed exception is narrow. For perfect clears, Bladewood recommends rebuilding a fixed queue in four-tris "over and over until you commit it to memory". They limit this to "a few very common and strong shapes" plus knowledge of the bag, and notes that beginners who "spam PCO" are "not very strong" ([Bladewood – PC glossary](https://docs.google.com/document/d/19NgsSMKfbu57xu2DPPEr2APZHXxbnufIa2xI6tBT7Vo/export?format=pdf)). This evidence has a known weakness. Most of the trap verdicts come from one prolific pre-Season 2 author who sells coaching. Reddit and Discord, where other players might back them up, were inaccessible to the researchers. The Season 2 rule changes, which shrank opener and perfect-clear payoffs, point the same way regardless.

Lab research on classic Tetris (one preview, no hold, no versus) adds three findings that should carry over:

- **Skill is integrated, not just speed.** Expertise is an "integrated set of processes" that mixes perception, decision and action ([Lindstedt & Gray 2019](https://read.qxmd.com/read/30543908/distinguishing-experts-from-novices-by-the-mind-s-hand-and-mind-s-eye)). Experts are fast because learned strategies let them play "an entirely different game" ([RPI news](https://news.rpi.edu/content/2019/10/07/tetris-gameplay-reveals-complex-cognitive-skills)).
- **Board quality predicts skill quickly.** Features such as matched edges, new and uncovered holes, and filled overhangs separate skill levels. A model built on a player's first 100 placements predicted their skill about as well as one built on all of them ([Lindstedt & Gray 2013](https://escholarship.org/uc/item/9k43n5qr)).
- **Experts plan instead of probing.** Trial-and-error rotation peaks at moderate skill and then drops off as players approach expertise ([Destefano et al. 2011](https://escholarship.org/uc/item/44k7g3vm)). Even world champions slow down as their options multiply (Hick's law) ([Lindstedt 2017](https://dspace.rpi.edu/items/44c84616-17e5-4fb5-ab34-4be043e59a9a)).

Together these support short, scored drills; immediate feedback on board quality after each placement; and a small vocabulary of standard shapes, so there are fewer options to weigh. No Tetris study tests mixed versus repeated practice, spaced repetition, or whether puzzles carry over to real games. Those design choices rest on general learning science and analogy.

## Tetr Trainer grades engine events, not player decisions

The app's foundation is strong. It is a carefully verified TETR.IO SRS+ sandbox with 180° kicks, hold, five previews, a seeded 7-bag, DAS/ARR/DCD handling and full-state undo ([GAMEPLAY_SPEC.md](../GAMEPLAY_SPEC.md); [board.ts](../src/core/board.ts)). On top sit 11 playable modules with 17 selectable steps, plus 5 "planned" pages ([catalog.ts](../src/core/catalog.ts)). Apart from the finesse drills and cheese digs, every module ends on a single named event: one full T-spin, one TSD, one TST, one perfect clear or three quads. Three of them are one-piece puzzles with a known answer: T-spin steps 1 and 2 and the TST entry ([tSpinDrill.ts](../src/core/tSpinDrill.ts); [scenarios.ts](../src/core/scenarios.ts)). The design rule says so outright: "Success is judged by events the engine already reports … so any correct build passes" ([LEARNING_RESEARCH.md](../docs/LEARNING_RESEARCH.md)). In practice that rule has three effects ([scenario.ts](../src/core/scenario.ts); [scenarios.ts](../src/core/scenarios.ts)):

- The TKI random-bag step passes on any TSD within eight pieces, built any way.
- Quad practice accepts any quad, although its notes ask for a right-side well and a flat surface.
- Zero-line T-spins count toward the three-T-spin goal.

Measured against the research, the app spends its content on what experts rank lowest and leaves out what separates ranks:

- **Openers.** Three of the eleven modules are openers, including PCO and DT Cannon, which winterNebs calls a trap and "a little overrated". Each ends at its first spin or clear, before the midgame where games are decided.
- **Finesse.** It is graded only on an empty board that is wiped after every drop ([finesseDrill.ts](../src/core/finesseDrill.ts)).
- **No pressure.** The engine has **zero gravity, manual locking and no time limits**, so the "races" and the "timed" finesse test only count up.
- **Garbage.** It exists only as single-hole cheese that refills after each lock, never as attacks arriving from an opponent ([GAMEPLAY_SPEC.md](../GAMEPLAY_SPEC.md); [garbage.ts](../src/core/garbage.ts)).
- **Season 2 scoring.** `main` has no attack table; no APM, PPS or APP; no non-T spin detection; and no Surge. It cannot score the Season 2 economy at all, and its B2B counter is display-only ([board.ts](../src/core/board.ts)).
- **Progress.** Nothing persists except settings, nothing unlocks, and the "levels" are only a visual grouping ([useTrainer.ts](../src/ui/useTrainer.ts)).

The cheese races come closest to an endorsed drill. They already show pieces per garbage line with a sensible "about 2.5 is strong" note, consistent with the high-SS benchmark above. But they never say which placement was wasteful, or whether the player was clearing garbage or their own lines.

The "too trivial" feeling is built into the design, not a shortage of content. The build plan deferred anything that needs search or evaluation. The learning revamp listed the stacking coach, PC finder, dig optimizer, ST stacking solver and opener continuation planner "as planned pages only; no solver is built" ([BUILD_PLAN.md](../BUILD_PLAN.md)). So the curriculum became whatever an engine can check without search, which is exactly the scripted, single-event content the research ranks lowest. The half that would evaluate decisions lives elsewhere. The unmerged `freeplay-competitive-stats` branch adds freeplay APM, PPS, VS, APP, keys per piece and finesse-fault tracking measured on the real board (commits `7da44dc`, `3996499`). Its attack table, however, is labeled "TETR.IO's classic multiplier table". Reading the branch confirms Season 1 rules: B2B is a logarithmic chaining bonus, All Clears send 10, and there is no Surge or garbage-clear bonus. It needs rebuilding before it can teach the current game. Other branches hold a 9-0 stacking solver module and an LST evaluator.

The market supports this diagnosis. Opener drills are now a commodity:

- **TetrisWorkout** drills TKI, DT Cannon, Hachispin, PCO and MKO on solver-verified boards. It rechecks the opener after every piece and fails the attempt as soon as the solver proves the spin is impossible ([TetrisWorkout](https://github.com/AndrewEmets/TetrisWorkout)). On feedback it already beats Tetr Trainer's opener modules.
- **TETRainer** teaches perfect-clear patterns with spaced repetition and solver analysis of "where you went wrong" ([TETRainer](https://tetrainer.com/)).
- **Downstack Practice** generates puzzles that come with a win condition ([Downstack Practice](https://himitsuconfidential.github.io/downstack-practice/)).

What nobody has shipped is placement-by-placement review of a player's own games. The only attempts are hobby prototypes from the last two months:

- **cc-coach** grades replays against the Cold Clear bot and reported an APP gap of 0.891 for the bot versus 0.616 for the player. Its stated limits include no clock, a bot tuned for Puyo Puyo Tetris, B2B treated as simply on or off, and missing 180° and SRS+ I-kicks ([cc-coach PR](https://github.com/yachi/tetrio-replay-report/pull/34)).
- **blockgame** forgives small losses, yet still flags Cold Clear's own play about once per 100 moves, and its logs do not include incoming garbage ([blockgame PR](https://github.com/thumbjiho/blockgame/pull/2)).

Bots spar without coaching, and stat dashboards report totals without explaining them ([TETR.IO wiki – Bots](https://tetrio.wiki.gg/wiki/Bots); [iverhang – Reading statistics](https://sites.google.com/view/iverhang/guides/reading-statistics)).

## Rebuild the trainer as a diagnose, drill, re-measure loop

The research implies one change to the basic unit of practice. Today it is "produce this event once". It should become "play a short stretch of realistic random-bag Tetris toward a narrow objective, graded on efficiency and decision quality, with the result saved". Every endorsed drill fits that mold. The finding that about 100 placements carry most of the skill signal suggests drills of roughly 50–150 pieces: long enough to measure, short enough to repeat. Progression should be gated on measured numbers, chiefly **APP at a target PPS**. Neither stat alone captures progress, and their relative weight flips around SS.

Feedback is the highest-leverage change, and it should come in three layers.

**1. Instrumentation.** Merge the competitive stats branch after rebuilding its attack table to the Season 2 league preset ([triangle presets](https://github.com/halp1/triangle/blob/HEAD/src/classes/room/presets.ts)):

- B2B charging with Surge from ×4, released in three parts.
- All Clears at 5 lines, counting as B2B.
- The +1 bonus for quads and spins that clear garbage.
- The multiplier combo table, rounded down.

Then add All-Mini+ spin detection, measure finesse on real stacks in every mode, and save every session.

**2. A stacking coach.** Start with cheap, research-grounded rules instead of waiting for a solver. Flag each placement that:

- creates a covered hole;
- leaves a large height difference; or
- creates one of the dependencies winterNebs names: a 2-wide well, an I-only well, or a side well that blocks a T-slot.

Also check whether a T-slot or quad path survives most orders of the next bag ([winterNebs – T-Spin Guide](https://winternebs.github.io/TETRIS-FAQ/tspin); [Lindstedt & Gray 2013](https://escholarship.org/uc/item/9k43n5qr)). When a search engine arrives, group its verdicts into bands and forgive near-equal moves, the way chess.com bands moves from Best to Blunder by expected points lost ([chess.com – move classification](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-and-etc)). Even Cold Clear regularly flags its own moves.

**3. Review.** After each session, show three to five key moments with the better placement and a "retry from here" button. Here the app has an advantage the replay-based prototypes lack: it owns its engine. It can log timing, inputs and garbage state for every placement. Its undo already restores full state, including the random number generator, so retrying from any position is cheap to build ([game.ts](../src/core/game.ts)).

The curriculum should then follow the stage roadmap. Each existing module with a sound core should become a scored, random-queue drill rather than be thrown away. The table maps the stages to concrete drills, metrics and gates taken from the benchmarks above.

| Stage | Drill (what changes in the app) | Scored by | Gate to advance |
|---|---|---|---|
| Controls | Handling setup (ARR 0–1, DAS lowered from ~130 ms until control slips). Keep empty-board finesse as a one- to two-week warm-up, then measure finesse in live play | Finesse-perfect share, keys per piece | Finesse above the A-rank median (~66%), rising toward ~80% |
| Clean stacking | Replace "3 quads" with Tetris-only and no-hold 40L, plus quad-only into a chosen well column | Time, holes created, well blocked | Tetris-only 40L under ~1:15–1:30 |
| Downstacking | Score cheese by pieces per garbage line, share of garbage vs. own lines cleared, and early garbage doubles. Add multi-hole garbage and messy self-built boards; compare against the dig optimizer once it exists | Pieces per garbage line | Under ~3.0, heading toward ~2.5 |
| TSD in random play | Mid-stack recognition drills under random queues (3×3 space → STSD, notch → TST or Triple Double, stairs → Kaidan); "build a TSD within N pieces without creating a hole" | TSD rate, penalized by stack-health flags | Freeplay APP ≈0.4 |
| B2B economy | "Keep B2B through N garbage lines" using all-mini spins; charge to B2B ≥4; dig with quads and spins for the +1 | B2B length, APP | APP ≈0.5 at ≥1.6 PPS |
| Pressure | Optional gravity and 30-frame lock delay, a PPS pacer, incoming garbage with travel time and an 8-line cap, a scripted or bot opponent; break-or-keep-B2B prompts | APP at target PPS, survival | APP ≥0.6 at ≥2 PPS |
| Openers (side track) | Spaced-repetition recall per first bag and its mirror, fail-fast checks, then two to three bags of continuation play | Build success rate, continuation APP | Optional after the TSD stage |

The APP and PPS gates come from TETRA LEAGUE averages, which include garbage. A solo drill without incoming garbage will produce different numbers, so treat the gates as starting points to recalibrate against the app's own data.

Several things should shrink:

- The one-piece kick puzzles belong on a reference page, not in the module list.
- PCO should be demoted. The league All Clear now sends 5 lines, the opener phase doubles the defender's cancelling, and TETRainer already covers perfect-clear study better.
- The planned ST/LST stacking solver deserves the lowest priority of the five planned pages. four.lol says ST stacking is not used in multiplayer. The author's own `lst-solver` work also found strict LST "not shown to be sustainable", with most losses caused by a T stuck in hold ([LEARNING_RESEARCH.md](../docs/LEARNING_RESEARCH.md)).

A defensible build order:

1. Instrumentation and saved progress.
2. Season 2 rules.
3. The rule-based stacking coach and session review.
4. Pressure features.
5. The dig optimizer.
6. A puzzle pipeline that pulls positions from the user's own logged sessions. Tag each puzzle by theme (TSD recognition, dig route, B2B preservation, cancel versus send), and rate both player and puzzle with the Glicko system, as Lichess does ([Lichess – new puzzles](https://lichess.org/blog/X-S6gRUAAGjNX4ki/new-puzzles-are-here)). Spaced review of failed positions and timed recognition runs can come later.

Importing TETR.IO replays can follow once the in-app loop works, after checking the terms for using replays and the TETRA CHANNEL API.

Two limits deserve plain acknowledgement. First, no evidence yet shows that Tetris puzzles, spaced repetition or engine review improve versus results; the chess and fighting-game analogies are persuasive but unproven here. Second, the rank benchmarks are correlations from one day's snapshot. Because the app would log every placement and session, it can partly close this gap itself. It can track whether improving a drill's metric moves the player's freeplay APP and PPS over weeks, turning the trainer into its own evidence base.

## Conclusion

The trainer feels trivial because it was built backwards from what its engine could check cheaply. In Tetris, what is cheap to check (a named event on a known board) is also cheap to learn and matters least in a match. What decides games, the quality of thousands of midgame placements at rising speed, is expensive to judge. Taking on that judging work for the player is the main thing a trainer can add beyond TETR.IO's own practice modes. The research also changes what "progression" should mean in the app. It is not a ladder of topics but two dials, efficiency and speed, whose relative payoff flips around SS rank. Mastery gates should therefore read APP at a target PPS, not module completion.

Season 2 sharpens the point. An engine that detects only T-spins and shows B2B as a plain counter teaches the pre-2024 game, and so does the unmerged Season 1 attack table. In that game perfect clears sent 10 lines and a B2B chain stored nothing. The cheapest high-value work is therefore unglamorous: correct Season 2 scoring, saved stats and per-placement flags. The app's most underused asset is that it owns its engine. Complete logs of timing, inputs and garbage give it the context that replay-based review prototypes lack. That puts it in a position to ship what the community keeps attempting and no one has finished: a "game review plus personal puzzles" loop.
