# LST regression positions

`lst-positions.json` holds visible solver snapshots (board rows bottom-up,
active piece, hold, five previews, full T-spin double count) captured from
seeded benchmark games. They contain no hidden queue or randomizer state.

Most are positions where the previous LST solver returned no usable
recommendation; `tests/lstEngine.test.ts` checks that the current engine
always offers a line on them. They are regression inputs, not claims that a
particular move is optimal.
