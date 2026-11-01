# LST reference and implementation notes

Verified 2026-10-31. This is research evidence for the live LST trainer, using the same y-up coordinates and rotation convention as REFERENCE_NOTES.md. No TETR.IO implementation is copied.

## Sources and reproduction

The primary practitioner references are [FOUR: LST Stacking](https://four.lol/stacking/lst/) and [FOUR: TKI](https://four.lol/openers/tki/). FOUR credits kazu for many LST examples and FireStorm58 for the long flat-top continuation replay. The precise diagrams are available in the public [LST page data](https://four.lol/page-data/stacking/lst/page-data.json) and [TKI page data](https://four.lol/page-data/openers/tki/page-data.json). The page text explains the method; the embedded fumen fields establish the factual cell coordinates below.

Raw page-data SHA-256 at retrieval:

- LST: b38677cbfd66d311b6c5c352e1b4e5643bd4fbc8e1cfd0057727e9b126ae3f89
- TKI: 087ff45c74a2ff9029e3c8539fefceed2dc34157140094b14f470f4d33905377

Diagrams were decoded in /tmp using [knewjade/tetris-fumen](https://github.com/knewjade/tetris-fumen), version 1.1.3. This dependency is not required by the app. Most source fumens contain already-colored field snapshots, not operation records: do not mistake their page order for an explicit piece queue. Tables below reconstruct complete tetromino placements from those cells. Piece order and engine input validation are independent work, explicitly identified below.

FOUR embeds [this LST video](https://www.youtube.com/watch?v=uDE9E7tjQUE). The video was identified, but its contents were not independently inspected or transcribed; no additional claim below relies on it.

## Sourced technique facts

LST alternates L and S on the left and uses T for doubles. Its basic construction alternates L/J overhangs and S/Z overhangs, filling the remaining structure after the T-spin when useful. A late T permits a Fractal. Flat-top TKI supplies the first two doubles; LST starts with the third. The right structure has both pure substitutions and substitutions crossing construction bands. FOUR illustrates mistakes leaving an unfillable continuation cell. [LST reference](https://four.lol/stacking/lst/)

TKI requires an early I and has queue-dependent continuations. The flat-top page shows several second-double layouts, including late-O donations. A third bag beginning Z J can obstruct straightforward LST and motivate a different continuation. Its example bags are Z I O L T S J / J T I O L S Z / S I L T J O Z; that example is not a universal script. [TKI reference](https://four.lol/openers/tki/)

## Coordinate conventions

All tables below use trainer pivots: x=0..9, y=0 at the floor, y increases upward. Rotations 0/R/2/L mean 0/1/2/3. O keeps its occupied cells at every rotation. The trainer I anchor differs from the fumen horizontal I position; the listed values have already been converted to the trainer's offsets. Prefer exact occupied-cell comparison over assuming external anchor conventions.

Board diagrams below are top-down. In masks, # means occupied regardless of color, and . means empty. Gray X cells in source diagrams stand for previously built material; they do not imply newly placed garbage.

## Flat-top TKI: first double

Source: [first flat-top diagram](https://fumen.zui.jp/?v115@Ahi0DeglBeBtg0Q4CeglCeBtR4RphlAezhQ4RpJeAgH) (also TKI flat-top section).

The source's other first-bag diagram is [a different flat-top piece arrangement](https://fumen.zui.jp/?v115@AhQ4BtDeglBeR4BtCeglCeQ4i0RphlAezhg0RpJeAgH); it reaches the same structural residue. The first arrangement is simpler for a fixed teaching bag.

Independent reconstruction and engine-verified placement order:

| Order | Piece | Rotation | Pivot x,y |
| --- | --- | --- | --- |
| 1 | I | 0 | 4,-1 |
| 2 | L | R | 0,1 |
| 3 | Z | 0 | 4,1 |
| 4 | S | R | 6,1 |
| 5 | O | 0 | 8,0 |
| 6 | J | 2 | 4,3 |
| 7 | T | 2 | 2,1 |

Thus a favorable preset is I L Z S O J T. The pre-T field is:

```text
...JJJ....
L..ZZJS...
L...ZZSSOO
LL.IIIISOO
```

J must be at reverse(4,3). The existing basic T-spin drill's J spawn(8,2) makes a different TKI variant and cannot be substituted while retaining this continuation.

T occupies (1,1),(2,1),(3,1),(2,0), clearing rows 0 and 1. Residue:

```text
...JJJ....
L..ZZJS...
```

Independent input checks: I hard-drop; L CW then wall-left; Z hard-drop; S right twice then CW; O wall-right; J 180; hard-drop each. T can use wall-left, CW, instant soft-drop, CW, hard-drop. The final T rotation followed by a zero-distance hard-drop gives full T-spin geometry, with three occupied corners and both front corners occupied.

## Second double: exact continuation fixture

Source: [second-double layout A](https://fumen.zui.jp/?v115@5gwhFeBtAewhi0Q4CeBtwhRpg0R4AeC8whRpglA8Q4AeD8ilJeAgH). It uses the preceding residue.

| Example order | Piece | Rotation | Pivot x,y |
| --- | --- | --- | --- |
| 1 | S | R | 0,1 |
| 2 | L | 0 | 8,0 |
| 3 | O | 0 | 7,1 |
| 4 | I | R | 5,2 |
| 5 | J | 2 | 8,3 |
| 6 | Z | 0 | 4,2 |
| 7 | T | 2 | 2,2 |

The independently verified example bag is S L O I J Z T. It is a regression fixture, not a required second bag. Before T:

```text
......I...
...ZZ.IJJJ
S...ZZIOOJ
SS.JJJIOOL
LS.ZZJSLLL
```

T occupies (1,2),(2,2),(3,2),(2,1), clearing rows 1 and 2. Exact residue:

```text
......I...
...ZZ.IJJJ
LS.ZZJSLLL
```

T entry: left twice, CCW, instant soft-drop, CCW, hard-drop. The Z at (3,3) supplies the roof; the left side need not supply one. The two front corners are (1,1) and (3,1).

Other source second-double shapes retain the left S and a right roof but rearrange the right stack:

- [layout B](https://fumen.zui.jp/?v115@5gg0FeBtAei0whQ4CeBtilwhR4AeC8glRpwhA8Q4AeD8RpwhJeAgH): I at the right wall, L over O, J on top.
- [layout C](https://fumen.zui.jp/?v115@5gwhFeBtAewhg0RpQ4CeBtwhi0R4AeC8whilA8Q4AeD8glRpJeAgH): center-right I with L/J/O repacked.
- [layout D](https://fumen.zui.jp/?v115@4gglGeilBtAewhQ4Cei0BtwhR4AeC8g0RpwhA8Q4AeD8RpwhJeAgH): the upper L and Z shift right.
- [layout E](https://fumen.zui.jp/?v115@ygwhIewhCeBtBeRpwhQ4CeBtg0RpwhR4AeC8i0glA8Q4AeD8ilJeAgH) and [layout F](https://fumen.zui.jp/?v115@ygwhIewhCeBthlBewhQ4CeBtglh0whR4AeC8glg0RpA8Q4AeD8g0RpJeAgH): taller right-wall I arrangements.

Independent implementation implication: the second-double evaluator must allow several right-side packings. A single entire-board template would reject source-valid continuations. The left slot and access path are the useful constraints. A predetermined first bag does not make every second bag follow one fixed placement order.

## Third double: LST entry fixture

Source: [FireStorm58 continuation diagram](https://fumen.zui.jp/?v115@5gwhFeBtAewhi0Q4ywBtwhRpg0R4wwC8whRpglA8Q4AeD8ilJeAgHvhAAAAwgAtEeQ4AewhBtRpglBeR4whAtg0RpglywQ4whAei0hlwwBewhXeAAAvhAAAAegwhDeg0DewhDeg0RpBewhCeh0RpBtwhQ4ywilAeBtR4wwAeglFeQ4beAAAvhAAAAagwhDeQ4DewhDeR4Cewhi0AeglQ4CewhBtg0AeglywCeBtAehlwwkeAAAvhAAAA2fwhIewhGehlwhCeRpBeAtglwhglBeRpAeBtglwhglywR4AtRpwhhlwwR4Aeg0RpwhAeywAtAei0whBewwBtHeAtjeAAAvhAAAAsfwhIewhIewhGeg0AewhDeg0Rpi0Deg0TpDeh0R4RpAeQ4ywR4AtCeR4wwBeBtDeQ4CeAtreAAAvhAAAA+fRpFeglAeRpAeQ4Degli0AeR4CehlAeg0AeglQ4HeglywFehlww4eAAAvhAAAAjgAtHeBtHeAtHewhIewhIewhIewhQeAAAvhAAAAZgAtHeDtAeRpglBeAtg0Q4BtRpglCeg0R4CehlAeh0AeQ4qeAAAvhAAAA), first three snapshots after the second-double setup. This is a long field-snapshot replay, not a bag-operation list. The following seven placements are independently reconstructed between its snapshots and checked with the trainer movement code.

Starting from layout A's second-double residue:

| Example order | Piece | Rotation | Pivot x,y |
| --- | --- | --- | --- |
| 1 | L | R | 0,2 |
| 2 | I | R | 4,2 |
| 3 | S | R | 3,3 |
| 4 | J | 0 | 8,2 |
| 5 | O | 0 | 8,3 |
| 6 | Z | R | 6,4 |
| 7 | T | 2 | 2,2 |

Example bag: L I S J O Z T. Before T:

```text
.......Z..
...S.IZZOO
L..SSIZJOO
L...SIIJJJ
LL.ZZIIJJJ
LS.ZZJSLLL
```

The T clears rows 1 and 2. Residue:

```text
.......Z..
...S.IZZOO
L..SSIZJOO
LS.ZZJSLLL
```

T entry: wall-left, CW, instant soft-drop, CW, hard-drop. The roof is S at (3,3). The left rail is L; its upper cell survives the clear. This is an explicit counterexample to requiring a roof on the left, literal J tetrominoes in every boundary segment, or a complete symmetric structure before clearing.

FOUR also gives [two third-double S placements](https://fumen.zui.jp/?v115@tgAtHeBtEeglBeAtQ4EeglCeR4A8CehlAeB8Q4F8AeG8JeAgHtgAPHeQpAPwhGeQpAewhIegHIegHXeAgH) and [their hidden-J structure](https://fumen.zui.jp/?v115@tgA8HeB8EeA8BeA8g0EeA8Ceg0B8CeB8Aeh0G8AeG8JeAgHtgAAIeAAA8IeA8reAgWAA). One puts S at R(4,2), plus Z at R(3,4); the other uses S at R(3,3) beside a vertical I in column x=5. The complete right support can be a J-shaped region assembled from earlier pieces.

## Repeating geometry and piece distribution

The following is independent cell analysis of [the canonical repeating pattern](https://fumen.zui.jp/?v115@FfglIeglIehlHeQ4CeAtE8R4AeBtE8glQ4AeAtg0E8glCeg0E8hlAeh0E8Q4CeAtE8R4AeBtE8glQ4AeAtg0E8glCeg0E8hlAeh0E8Q4CeAtE8R4AeBtF8Q4AeAtF8JeAgH). Its lower complete rows repeat every five rows with this x0..4 occupancy, listed bottom-up:

```text
y0 ##.##
y1 ##.##
y2 #...#
y3 ##.##
y4 #...#
(repeat)
```

The canonical geometric split is 2 + 1 + 2 + 5:

| Columns (zero based) | Function |
| --- | --- |
| 0,1 | Alternating L/S left rail |
| 2 | I well and downward T stem |
| 3,4 | Shaped right boundary, canonically J/Z |
| 5..9 | Free stacking that completes the clear rows |

A canonical L/J band uses L at R(0,h+1) and J at L(4,h+1): bottom row LL.JJ, then two rows L...J. An S/Z band uses S at R(0,h+1) and Z at R(3,h+1): bottom x1 S / x3 Z, middle SS.ZZ, top S...Z. Parts overlap existing tails across band boundaries. Do not treat each band as an isolated rectangle.

These are occupancy targets for evaluating continuation, not a rigid recipe. The source alternate diagrams show that adjacent freestyle columns can participate in the shaped boundary.

Independent material accounting: a complete seven-bag contributes 28 cells. One TSD removes 20, so that bag leaves 8 extra cells. If every T makes a double and no other clears occur, height cannot remain bounded. An ideal steady cycle of five seven-bags needs five TSDs plus one Tetris: 140 input cells = 100 + 40 cleared cells. This arithmetic explains why retaining a reachable I well and allowing Tetrises matters; it is not a guarantee that arbitrary five bags admit an exact loop.

Over two TSDs, the canonical left rail uses one L and one S; the canonical right boundary uses one J and one Z. Remaining non-T pieces must be packed into the right region, saved, or substituted into the structure. There are two of every piece across two complete bags, so insisting that all L/S stay left or all J/Z stay at the boundary would be wrong.

## Two local phases, before and after a double

These are independently extracted full symmetric masks. Source [L/J overhang step](https://fumen.zui.jp/?v115@pgQpIeQpIeRpHeA8CeH8AeI8AeG8JeAgHIhywHewwaeAAAvhAAAA), [complete its band](https://fumen.zui.jp/?v115@9gQpIeQpIeRpHeB8AeG8JeAgHBhVpDeVpCeWpTeAAA), [S/Z overhang step](https://fumen.zui.jp/?v115@9gQpCeWpCeXpAeWpB8AeG8JeAgHpgglIehlIeglveAAAIhywHewwaeAAA), [complete its band](https://fumen.zui.jp/?v115@9gglIehlHeQpglBeVpB8AeG8JeAgHBhllCemlCeglZeAAA).

All strings are x0..4 only and listed bottom-up. Row 0 is an existing residual row. T is reverse at pivot(2,2), so it clears rows 1 and 2.

| Relative row | L/J overhang, before T | S/Z overhang, before T |
| --- | --- | --- |
| 0 | ##.## | ##.## |
| 1 | ##.## | ##.## |
| 2 | #...# | #...# |
| 3 | ##.## | ##.## |
| 4 | #...# | ##.## |
| 5 | #...# | #...# |

After the clear:

| Relative row | L/J overhang residue | S/Z overhang residue |
| --- | --- | --- |
| 0 | ##.## | ##.## |
| 1 | ##.## | ##.## |
| 2 | #...# | ##.## |
| 3 | #...# | #...# |

At least one roof corner must be present, but both are unnecessary. Source steps expressly permit doing the TSD before the remaining band is filled. A useful evaluator should reward alignment and reachable completion, permit missing future cells, and strongly penalize already-occupied cells in protected empty regions. Treating every missing # as a fatal error prevents legitimate intermediate positions.

## Alternative boundary packings

The following coordinates are direct cell reconstructions from the source's colored alternatives. They describe local tetrominoes in a snapshot; surrounding gray cells are pre-existing support. They are not all interchangeable from the same complete board or in every arrival order.

| Source | Colored local pieces, trainer pivots | What the geometry demonstrates |
| --- | --- | --- |
| [pure S/Z](https://fumen.zui.jp/?v115@VgA8IeB8HeB8BeQ4F8CeR4F8AeBtQ4E8CeBtF8AeI8AeG8JeAgH) | Z0(4,2), S R(4,4) | Two pieces can build a boundary spanning adjacent bands. |
| [pure O](https://fumen.zui.jp/?v115@VgA8IeB8HeB8BeRpE8CeRpF8AeH8CeH8AeI8AeG8JeAgH) | O0(4,4) | O can supply the upper boundary. |
| [pure J](https://fumen.zui.jp/?v115@VgA8IeB8HeB8Beg0F8Cei0E8AeH8CeH8AeI8AeG8JeAgH) | J0(5,4) | A horizontal J can supply upper support. |
| [pure Z/L](https://fumen.zui.jp/?v115@VgA8IeB8CeAtDeB8BeBtE8CeAtglF8AeilE8CeH8AeI8AeG8JeAgH) | L0(4,3), Z R(4,5) | L contributes a three-cell ledge. |
| [pure I/J/Z](https://fumen.zui.jp/?v115@VgA8IeB8CeAtDeB8BeBtE8CeAti0D8Aezhg0C8CeH8AeI8AeG8JeAgH) | I0(4,2), J2(6,4), Z R(4,5) | A horizontal I can help build the boundary. |
| [pure S/J](https://fumen.zui.jp/?v115@VgA8Deg0DeB8Ceg0DeB8Beh0E8CeR4F8AeR4F8CeH8AeI8AeG8JeAgH) | S0(4,3), J L(5,6) | Flat S plus a vertical J forms an alternative. |
| [mixed S/O](https://fumen.zui.jp/?v115@ZgA8HeRpEeA8BeRpF8CeR4F8AeR4F8CeH8AeI8AeG8JeAgH) | S0(4,3), O0(3,5) | O can cross the canonical band boundary. |
| [mixed Z/J](https://fumen.zui.jp/?v115@ZgA8Hei0DeA8BeBtg0E8CeBtF8AeH8CeH8AeI8AeG8JeAgH) | Z0(4,4), J2(4,6) | Roof and lower support can be built together. |
| [mixed S/J](https://fumen.zui.jp/?v115@ZgA8Heg0A8EeA8Bei0E8CeR4F8AeR4F8CeH8AeI8AeG8JeAgH) | S0(4,3), J0(4,5) | The orientation of J changes the supported cells. |
| [mixed S](https://fumen.zui.jp/?v115@ZgA8HeQ4A8EeA8BeR4F8CeQ4G8AeH8CeH8AeI8AeG8JeAgH) | S R(3,5) | A vertically shifted S bridges the bands. |

The table's cell coordinates were checked against tetromino offsets; their full SRS entry paths were not exhaustively checked against all source snapshot backgrounds. The two opener bags and third-double fixture above were checked for reachability.

## Holes, failure cases, and evaluator implications

The following are implementation deductions, not source claims about a particular solver.

1. A column-hole count sees the intended T cavity as bad. Recognize the exact planned T cells and preserve a spawn-reachable rotation path into them before assigning a generic hole penalty.
2. A three-corner shape alone is insufficient. The actual path must end with a successful rotation and a zero-distance lock/drop, and the lock must clear two rows. Search states need rotation history if they rank spin results.
3. Keep column x=2 open below the active T. Filling it can block later T stems and the corrective I Tetris.
4. A higher stack can align with another vertical phase of the same five-row pattern. Normalize by the well or search offsets; do not anchor all future templates to the original floor.
5. Free-stack holes are still undesirable. Exempt only geometrically understood planned cavities, not every hole in x0..4 or every temporarily covered cell.
6. Generic maximum-height reduction is not enough: completing the current TSD can leave a structural dead end. Score the successor field's continuation too.

A source negative fixture is [the unfillable continuation cell](https://fumen.zui.jp/?v115@tgglHewwglEeQpBeglWpCeXpAeWpB8AeG8JeAgH4gQ41eAAA). Before annotation, its occupied rows are:

```text
....#.....
....#.....
#..#######
#...######
##.#######
##.#######
```

The source marks (3,4) as the missing cell. The current lower T cavity can still clear, but continuation into the desired next band is broken: packing that square with a tetromino conflicts with the neighboring occupied structure or the protected space. This is a more useful regression than simply testing a board with no T-spin cavity. The nearby [common wrong right-boundary examples](https://fumen.zui.jp/?v115@tgg0Ieg0EeglBeh0EeglCeAtE8hlAeBtG8AeAtF8JeAgHtgwhIewhQ4GehWQ4IeAPGeBtHeAtPeAAA) also show that having recognizable J/Z or S/Z colors does not establish the correct shape.

## Verification boundary

Independent local verification reconstructed the first three bags in /tmp using the repository's board.ts, spawn, reachablePlacements, cells, classifyTSpin, and lock. Every target was spawn-reachable with instant soft drop; each T had full corner classification and cleared exactly two lines. The displayed T paths end in a rotation before the final zero-distance hard drop. The parent implementation is also verifying the fixtures through actual Game input rather than accepting a pose assignment as proof of a T-spin.

The source diagrams establish valid strategy geometry, not success for every random queue. Later bags should remain normal seven-bag output; favorable later sequences in this document are deterministic acceptance fixtures only. A live recommendation engine must inspect the current board, current/held piece, and queue, and allow source-supported alternatives or a clear fallback when the desired continuation cannot be constructed.

## Pure/mixed completion regression (2026-10-31)

The evaluator's original repeating-mask penalty was insufficient: a TSD reward could outweigh it, and minimizing the phase mismatch did not check whether missing structural cells could ever be filled. `lstPatterns.ts` now transcribes the full occupancy of the eight pure and four mixed examples (page-data diagram indices 25–32 and 34–37). Tests retain their right-side support, not just their left-five masks.

`lstStructure.ts` derives the structural masks and residues after TSD row removal. It requires a compatible phase on both sides of the central well. Missing structural cells beneath a taller neighboring column must admit at least one non-T tetromino without collision or intrusion into the well/protected empty cells. The known unfillable-cell source fixture fails this check, although its current TSD remains possible. All twelve positive source diagrams pass.

This is an optimistic geometric completion check, not exhaustive proof of a future queue solution: it checks possible pieces individually, not joint tiling or arrival order. Actual search placements still require SRS+ reachability. The finite pattern family can conservatively reject unrepresented techniques. Such rejection now produces no recommendation rather than presenting a known incompatible branch as an LST plan.

The user screenshot's occupied board and damaging vertical I in column x=4 were reconstructed as another regression. Its original queue is not visible, so the full-search regression uses an explicitly representative queue; it does not claim an exact reproduction of the original score or ordering.


## Preserve the overhang across placements

L/S are the intended left-side piece dependencies. The right boundary is part of
right-side freestyle construction: J/Z are examples of packings, not required
piece identities. Its alternating overhang geometry must survive each placement,
including when another piece supplies it.

The O regression exposed an alignment bug: raising the boundary also raised the
structural check's starting row. Lower conflicting cells were then ignored, and a
new phase could make the damaged overhang appear valid. The check now includes
all unfinished rows from the floor. It may skip only complete four-row bands
filled everywhere except the I well, which the corrective Quad removes intact.
Actual line clears already compact the board;
raising the surface does not justify discarding earlier geometry. Full-height
canonical repetitions supplement the finite pure/mixed masks and their residues.

The screenshot reconstruction tests the first Z followed by the offending O,
before the later TSD. The O is SRS-reachable but must fail structural validation;
a live-search regression excludes it while retaining alternative suggestions.
The screenshot does not expose the original queue; the test queue is explicitly
representative. Existing source pure/mixed fixtures and actual-control first-three
TSD tests remain the positive references. Tall canonical stacks and buried damage
are also covered. This remains a conservative pattern-family check: it does not
prove arbitrary tall mixed packings or queue sustainability, and can withhold
suggestions for unrepresented valid structures.
