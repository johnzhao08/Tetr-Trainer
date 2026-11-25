import { useEffect, useState } from "react";
import { REFERENCE, SIDE_TRACK } from "../core/catalog";
import type { ModuleInfo } from "../core/catalog";
import { recommendedStage } from "../core/curriculum";
import { nextDueAt } from "../core/review";
import type { ReviewItem } from "../core/review";
import { DataSection } from "./DataSection";
import { GlossarySection } from "./GlossarySection";
import { LevelCard } from "./LevelCard";
import { ModuleCard } from "./ModuleCard";
import { readProgress, readTraining } from "./progressStorage";
import { ReviewCard } from "./ReviewCard";
import { SettingsButton } from "./SettingsButton";
import { StageList } from "./StageList";
import { TrendsSection } from "./TrendsSection";

export function HomeScreen({
  onFreeplay,
  onOpen,
  onDrill,
  onSettings,
  onHandling,
}: {
  onFreeplay: () => void;
  onOpen: (id: string) => void;
  onHandling: () => void;
  onDrill: (id: string) => void;
  onSettings: () => void;
}) {
  const [progress, setProgress] = useState(readProgress);
  const [training, setTraining] = useState(readTraining);
  const now = useNow(training.review);
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
        <ReviewCard training={training} now={now} />
        <GlossarySection />
        <DataSection
          progress={progress}
          training={training}
          onChange={(p, t) => {
            setProgress(p);
            setTraining(t);
          }}
        />
      </main>
    </>
  );
}

// setTimeout cannot wait longer than this (about 24.8 days).
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** The current time, refreshed at the next due time and when the tab returns. */
function useNow(items: ReviewItem[]): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  useEffect(() => {
    const nextDue = nextDueAt(items, now);
    if (nextDue === null) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(MAX_TIMEOUT_MS, nextDue - now) + 5,
    );
    return () => clearTimeout(timer);
  }, [items, now]);
  return now;
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
