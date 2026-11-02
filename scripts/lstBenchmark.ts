import {
  constructionBoardKey,
  type Construction,
} from "../src/core/solver/lstConstruction";
// Run with: npx esbuild scripts/lstBenchmark.ts --bundle --platform=node --outfile=/tmp/lst-benchmark.cjs
// node /tmp/lst-benchmark.cjs [seed-count=10] [locks=100] [budget-ms=1500]
import { LSTGame } from "../src/core/lst";
import { analyze } from "../src/core/solver/search";
import { solverSnapshot } from "../src/core/solver/snapshot";
import type { Action } from "../src/core/settings";
const seeds = Number(process.argv[2] ?? 10);
const locks = Number(process.argv[3] ?? 100);
const budgetMs = Number(process.argv[4] ?? 1500);
for (let seed = 1; seed <= seeds; seed++) {
  const game = new LSTGame(seed);
  const constructions = new Map<string, Construction[]>();
  let provisional = 0,
    ms = 0,
    placed = 0;
  let stopped = "lock limit";
  for (; placed < locks; placed++) {
    const result = analyze(solverSnapshot(game.state), "right", {
      mode: "lst",
      budgetMs,
      initialConstructions: constructions.get(
        constructionBoardKey(game.state.board),
      ),
    });
    for (const line of result.lines)
      for (const hint of line.constructionTrace ?? [])
        constructions.set(hint.boardKey, hint.states);
    ms += result.elapsedMs;
    if (!result.complete) provisional++;
    const first = result.lines[0];
    if (!first) {
      stopped = result.stopReason ?? "no line";
      break;
    }
    if (first.evidence !== "construction") {
      stopped = first.evidence ?? "unknown evidence";
      break;
    }
    const move = first.moves[0];
    if (move.useHold) {
      game.keyDown("hold");
      game.keyUp("hold");
    }
    for (let i = 0; i < move.path.length; i++) {
      const input = move.path[i];
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
    }
    if (!game.state.active) {
      stopped = "top out";
      break;
    }
  }
  console.log(
    JSON.stringify({
      seed,
      placed,
      tsds: game.state.fullTSpinDoubles,
      provisional,
      meanMs: Math.round(ms / (placed + Number(placed < locks))),
      stopped,
    }),
  );
}
