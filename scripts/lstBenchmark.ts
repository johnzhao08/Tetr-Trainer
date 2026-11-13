// Seeded self-play: follow the LST solver's first suggestion through the real
// game inputs and report how long it sustains the structure.
//
//   npx esbuild scripts/lstBenchmark.ts --bundle --platform=node --outfile=/tmp/lst-benchmark.cjs
//   node /tmp/lst-benchmark.cjs [seed-count=10] [locks=300] [budget-ms=1500] [--start-seed=N]
//
// Only the visible snapshot (board, active, hold, five previews) is analyzed.
import { LSTGame } from "../src/core/lst";
import { analyze } from "../src/core/solver/search";
import { solverSnapshot } from "../src/core/solver/snapshot";
import type { Action } from "../src/core/settings";
import { tsdReady } from "../src/core/solver/lstSearch";
import { toRows } from "../src/core/solver/bitboard";

const seeds = Number(process.argv[2] ?? 10);
const locks = Number(process.argv[3] ?? 300);
const budgetMs = Number(process.argv[4] ?? 1500);
const startSeed = Number(
  process.argv.find((arg) => arg.startsWith("--start-seed="))?.split("=")[1] ??
    1,
);
for (let seed = startSeed; seed < startSeed + seeds; seed++) {
  const game = new LSTGame(seed);
  let placed = 0,
    ms = 0,
    quads = 0,
    otherClears = 0,
    wastedT = 0,
    tSpinOther = 0,
    heldTStuck = 0,
    recoveryLines = 0,
    provisional = 0,
    maxHeight = 0,
    stopped = "lock limit";
  for (; placed < locks; placed++) {
    const result = analyze(solverSnapshot(game.state), "right", {
      mode: "lst",
      budgetMs,
    });
    ms += result.elapsedMs;
    if (!result.complete) provisional++;
    const line = result.lines[0];
    if (!line) {
      stopped = result.stopReason ?? "no line";
      break;
    }
    if (line.evidence !== "construction") recoveryLines++;
    const move = line.moves[0];
    const double = move.spin === "full" && move.cleared === 2;
    const otherSpin = move.piece.type === "T" && move.spin === "full";
    if (move.cleared === 4) quads++;
    else if (otherSpin && move.cleared && !double) tSpinOther++;
    else if (move.cleared && !double) otherClears++;
    if (move.piece.type === "T" && !move.cleared) wastedT++;
    if (move.useHold) {
      game.keyDown("hold");
      game.keyUp("hold");
    }
    move.path.forEach((input, i) => {
      game.settings.das = input.startsWith("wall") ? 0 : 110;
      const action: Action =
        i === move.path.length - 1
          ? "hardDrop"
          : input === "drop"
            ? "softDrop"
            : input === "wallLeft"
              ? "left"
              : input === "wallRight"
                ? "right"
                : (input as Action);
      game.keyDown(action);
      game.keyUp(action);
    });
    if (game.state.hold === "T" && !tsdReady(toRows(game.state.board)))
      heldTStuck++;
    maxHeight = Math.max(
      maxHeight,
      game.state.board.findIndex((row) => row.every((cell) => cell === null)),
    );
    if (!game.state.active) {
      placed++;
      stopped = "top out";
      break;
    }
  }
  console.log(
    JSON.stringify({
      seed,
      placed,
      tsds: game.state.fullTSpinDoubles,
      quads,
      otherClears,
      wastedT,
      tSpinOther,
      heldTStuck,
      recoveryLines,
      provisional,
      maxHeight,
      meanMs: Math.round(ms / Math.max(1, placed)),
      stopped,
    }),
  );
}
