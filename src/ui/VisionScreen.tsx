import { useCallback, useEffect, useRef, useState } from "react";
import { best, recordSession } from "../core/progress";
import type { SessionRecord } from "../core/progress";
import { saveSettings } from "../core/settings";
import type { Settings } from "../core/settings";
import { AsyncFeed } from "../core/visionFeed";
import { drillIdOf, VisionRun } from "../core/visionRun";
import type { VisionMode } from "../core/visionRun";
import { ModuleHeader } from "./ModuleHeader";
import { readProgress, writeProgress } from "./progressStorage";
import { newSessionId } from "./sessionId";
import { createFetcher } from "./visionFetcher";
import { SettingsDialog } from "./SettingsDialog";
import { initialSettings } from "./useTrainer";
import { VisionMenu } from "./VisionMenu";
import { VisionPlay } from "./VisionPlay";
import type { Feedback } from "./VisionPlay";
import { VisionResults } from "./VisionResults";

type Result = { record: SessionRecord; priorBest: number | null; saved: boolean };

export function VisionScreen({
  settings: initial,
  onHome,
}: {
  settings?: Settings;
  onHome: (settings?: Settings) => void;
}) {
  const [settings, setSettings] = useState(() => initial ?? initialSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progress, setProgress] = useState(readProgress);
  const [run, setRun] = useState<VisionRun | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [now, setNow] = useState(0);
  const saved = useRef<VisionRun | null>(null);

  const finish = useCallback((finished: VisionRun) => {
    if (saved.current === finished) return;
    saved.current = finished;
    const before = readProgress();
    const record = finished.record(newSessionId(), Date.now());
    const next = recordSession(before, record);
    const ok = writeProgress(next);
    setProgress(ok ? next : before);
    setResult({
      record,
      priorBest: best(before, drillIdOf(finished.mode), "score", {
        completedOnly: true,
      }),
      saved: ok,
    });
  }, []);

  const start = (mode: VisionMode) => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    // The clock starts in the effect below, once the question is on screen.
    // Questions are built off the UI thread, two ahead of the player.
    const fresh = new VisionRun(mode, seed, null, new AsyncFeed(mode, seed, createFetcher()));
    setRun(fresh);
    setFeedback(null);
    setResult(null);
  };
  const answer = (right: boolean, detail = "") => {
    if (!run?.asking) return;
    const counted = run.answer(right, performance.now());
    if (counted) setFeedback({ right, detail });
    if (run.over) finish(run);
  };
  const next = () => {
    if (!run) return;
    if (run.over) setFeedback(null);
    else {
      run.next();
      setFeedback(null);
    }
  };

  // Take questions as they finish; a run that finds none ends here too.
  useEffect(() => {
    if (!run) return;
    const stop = run.subscribe(() => {
      run.poll();
      setNow(performance.now());
      if (run.over) finish(run);
    });
    run.poll();
    return () => {
      stop();
      run.dispose();
    };
  }, [run, finish]);

  useEffect(() => {
    if (!run) return;
    const frame = requestAnimationFrame(() => {
      const t = performance.now();
      run.show(t);
      setNow(t);
    });
    return () => cancelAnimationFrame(frame);
  }, [run, run?.question]);

  // Storm clock: refresh the display and end the run when time runs out.
  const ticking = run?.mode === "storm" && run.asking;
  useEffect(() => {
    if (!run || !ticking) return;
    const id = setInterval(() => {
      const t = performance.now();
      run.expire(t);
      setNow(t);
      if (run.over) finish(run);
    }, 100);
    return () => clearInterval(id);
  }, [run, ticking, finish]);

  const showResults = run && result && !feedback && run.over;
  const title = run ? `T-spin vision: ${run.mode.replace("practice:", "practice ")}` : "";
  return (
    <div className="app-shell">
      <ModuleHeader
        title="T-spin vision"
        onHome={() => onHome(settings)}
        onSettings={() => setSettingsOpen(true)}
      />
      {!run ? (
        <VisionMenu progress={progress} onStart={start} />
      ) : showResults ? (
        <VisionResults
          title={title}
          record={result.record}
          priorBest={result.priorBest}
          saved={result.saved}
          exhausted={run.exhausted}
          onAgain={() => start(run.mode)}
          onMenu={() => setRun(null)}
        />
      ) : (
        <VisionPlay
          run={run}
          now={now}
          settings={settings}
          suspended={settingsOpen}
          feedback={feedback}
          onAnswer={answer}
          onNext={next}
          onQuit={() => setRun(null)}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          seed={0}
          onApply={(s) => {
            setSettings(s);
            try {
              saveSettings(localStorage, s);
            } catch {
              // Settings stay active for this session.
            }
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
