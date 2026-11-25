import { useMemo, useState } from "react";
import { REFERENCE, SIDE_TRACK } from "../core/catalog";
import type { ModuleInfo } from "../core/catalog";
import { recommendedStage } from "../core/curriculum";
import { HARVEST_EXPLAIN, SET_SIZE, themeCounts } from "../core/harvest";
import type { Progress } from "../core/progress";
import type { PuzzleDef } from "../core/puzzle";
import { puzzleGroups } from "../core/puzzles";
import { DataSection } from "./DataSection";
import { MiniBoard } from "./MiniBoard";
import { GlossarySection } from "./GlossarySection";
import { LevelCard } from "./LevelCard";
import { ModuleCard } from "./ModuleCard";
import { readProgress, readPuzzles } from "./progressStorage";
import { SettingsButton } from "./SettingsButton";
import { StageList } from "./StageList";
import { TrendsSection } from "./TrendsSection";

export function HomeScreen({
  onFreeplay,
  onOpen,
  onDrill,
  onPuzzle,
  onPuzzleSet,
  onSettings,
  onHandling,
}: {
  onFreeplay: () => void;
  onOpen: (id: string) => void;
  onHandling: () => void;
  onDrill: (id: string) => void;
  onPuzzle: (id: string) => void;
  onPuzzleSet: (set: PuzzleDef[]) => void;
  onSettings: () => void;
}) {
  const [progress, setProgress] = useState(readProgress);
  return (
    <>
      <header className="site-header">
        <h1 className="brand">Tetr Trainer</h1>
        <nav className="header-actions" aria-label="Modes">
          <button className="button" onClick={onFreeplay}>
            Freeplay
          </button>
          <SettingsButton onClick={onSettings} />
        </nav>
      </header>
      <main className="home-layout">
        <LevelCard progress={progress} onDrill={onDrill} />
        <StageList
          progress={progress}
          recommendedId={recommendedStage(progress).id}
          onDrill={onDrill}
          onHandling={onHandling}
        />
        <PuzzleGroups onPuzzle={onPuzzle} />
        <YourPuzzles progress={progress} onSet={onPuzzleSet} />

        <TrendsSection progress={progress} />
        <ModuleGroup
          id="side-track"
          title="Side track: openers"
          blurb="Openers are optional and matter less than midgame play. Learn them after the stages above feel comfortable."
          modules={SIDE_TRACK}
          onOpen={onOpen}
        />
        <ModuleGroup
          id="reference"
          title="Reference"
          blurb="Kick puzzles and finesse warm-ups to dip into any time. They are not scored or saved."
          modules={REFERENCE}
          onOpen={onOpen}
        />
        <GlossarySection />
        <DataSection progress={progress} onChange={setProgress} />
      </main>
    </>
  );
}

function PuzzleGroups({ onPuzzle }: { onPuzzle: (id: string) => void }) {
  return (
    <section className="level-section" aria-labelledby="puzzles">
      <div className="level-heading">
        <h2 id="puzzles">Puzzles</h2>
        <p>Fixed boards with one goal each. Solve them to learn when a structure applies.</p>
      </div>
      {puzzleGroups().map(({ theme, puzzles }) => (
        <div key={theme}>
          <h3>{theme}</h3>
          <div className="module-grid">
            {puzzles.map((puzzle) => (
              <button
                key={puzzle.id}
                className="module-card"
                onClick={() => onPuzzle(puzzle.id)}
              >
                <MiniBoard rows={puzzle.position.rows} />
                <strong>{puzzle.title}</strong>
                <span>{puzzle.prompt}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function YourPuzzles({
  progress,
  onSet,
}: {
  progress: Progress;
  onSet: (set: PuzzleDef[]) => void;
}) {
  // Re-runs after an import, so restored sessions get harvested too.
  const puzzles = useMemo(() => readPuzzles(progress), [progress]);
  const counts = themeCounts(puzzles);
  const set = puzzles.slice(0, SET_SIZE);
  return (
    <section className="level-section" aria-labelledby="your-puzzles">
      <div className="level-heading">
        <h2 id="your-puzzles">Your puzzles</h2>
        <p>{HARVEST_EXPLAIN}</p>
      </div>
      {puzzles.length === 0 ? (
        <p className="step-note">
          None yet. Finish a drill and its mistakes will show up here.
        </p>
      ) : (
        <>
          <ul className="theme-counts" aria-label="Your puzzles by theme">
            {counts.map(({ theme, count }) => (
              <li key={theme}>
                <strong>{count}</strong> {theme}
              </li>
            ))}
          </ul>
          <button className="button primary" onClick={() => onSet(set)}>
            Practise your last {set.length} mistake{set.length === 1 ? "" : "s"}
          </button>
        </>
      )}
    </section>
  );
}

function ModuleGroup({
  id,
  title,
  blurb,
  modules,
  onOpen,
}: {
  id: string;
  title: string;
  blurb: string;
  modules: readonly ModuleInfo[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="level-section" aria-labelledby={id}>
      <div className="level-heading">
        <h2 id={id}>{title}</h2>
        <p>{blurb}</p>
      </div>
      <div className="module-grid">
        {modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            onOpen={() => onOpen(module.id)}
          />
        ))}
      </div>
    </section>
  );
}
