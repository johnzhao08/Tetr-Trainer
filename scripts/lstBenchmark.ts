import { writeFileSync } from "node:fs";
// Run with: npx esbuild scripts/lstBenchmark.ts --bundle --platform=node --outfile=/tmp/lst-benchmark.cjs
// node /tmp/lst-benchmark.cjs [seed-count=10] [locks=100] [budget-ms=1500] [--capture] [--start-seed=N]
// --capture saves every analyzed snapshot and carried construction to /tmp/lst-seed-N.json.
import { LSTGame } from "../src/core/lst";
import { analyze } from "../src/core/solver/search";
import { solverSnapshot } from "../src/core/solver/snapshot";
import type { Action } from "../src/core/settings";
const seeds = Number(process.argv[2] ?? 10);
const locks = Number(process.argv[3] ?? 100);
const budgetMs = Number(process.argv[4] ?? 1500);
const startSeed = Number(
  process.argv.find((arg) => arg.startsWith("--start-seed="))?.split("=")[1] ??
    1,
);
for (let seed = startSeed; seed < startSeed + seeds; seed++) {
  const game = new LSTGame(seed);
  let provisional = 0,
    ms = 0,
    placed = 0;
  const snapshots: unknown[] = [];
  let stopped = "lock limit";
  for (; placed < locks; placed++) {
    if (process.argv.includes("--capture"))
      snapshots.push({ position: solverSnapshot(game.state) });
    const result = analyze(solverSnapshot(game.state), "right", {
      mode: "lst",
      budgetMs,
    });
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
  if (process.argv.includes("--capture"))
    writeFileSync(`/tmp/lst-seed-${seed}.json`, JSON.stringify(snapshots));
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
