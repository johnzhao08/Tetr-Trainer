import { useEffect, useMemo, useRef, useState } from "react";
import { compare, DECISION_PIECES, net, POLICIES, summarize } from "../core/decision";
import type { Line, LineResult } from "../core/decision";
import { decisionRecord, DECISIONS, lessonFor, PUBLISHED } from "../core/decisions";
import { pendingLines } from "../core/incoming";
import { LEAGUE_PRESSURE } from "../core/incoming";
import { Opponent } from "../core/opponent";
import { METRIC_INFO, recordSession } from "../core/progress";
import { saveSettings } from "../core/settings";
import type { Settings } from "../core/settings";
import { SURGE_AT, VersusInfo } from "./DrillHud";
import { MiniBoard } from "./MiniBoard";
import { ModuleHeader } from "./ModuleHeader";
import { PiecePreview } from "./PiecePreview";
import { readProgress, writeProgress } from "./progressStorage";
import { SettingsDialog } from "./SettingsDialog";
import { newSessionId } from "./sessionId";

const LABEL: Record<Line, string> = { break: "Break", keep: "Keep" };
const formatClock = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function DecisionScreen({
  settings,
  onHome,
}: {
  settings: Settings;
  onHome: (settings?: Settings) => void;
}) {
  const [current, setCurrent] = useState(settings);
  const [dialog, setDialog] = useState(false);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Line[]>([]);
  const started = useRef(0);
  const saved = useRef<string | null>(null);
  const done = index >= DECISIONS.length;
  const answered = picks.length > index;
  const scenario = DECISIONS[Math.min(index, DECISIONS.length - 1)];
  const correct = picks.filter((p, i) => p === PUBLISHED[i].answer).length;
  // Played out only once answered, so the key is never computed early.
  const outcome = useMemo(
    () => (answered ? compare(scenario) : null),
    [answered, scenario],
  );

  const answer = (line: Line) => {
    if (answered || done) return;
    setPicks((p) => [...p, line]);
  };
  const next = () => setIndex((i) => i + 1);
  const restart = () => {
    setIndex(0);
    setPicks([]);
    saved.current = null;
    started.current = Date.now();
  };


  useEffect(() => {
    started.current = Date.now();
  }, []);

  useEffect(() => {
    if (!done || saved.current) return;
    saved.current = newSessionId();
    writeProgress(
      recordSession(
        readProgress(),
        decisionRecord(saved.current, Date.now(), correct, DECISIONS.length, Date.now() - started.current),
      ),
    );
  }, [done, correct]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (!answered && key === "b") answer("break");
      else if (!answered && key === "k") answer("keep");
      else if (answered && !done && (key === "enter" || key === "n")) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const opponent = useMemo(
    () =>
      new Opponent(scenario.opponent.seed, {
        ...scenario.opponent,
        surge: true,
        receives: true,
      }).state,
    [scenario],
  );

  return (
    <div className="app-shell">
      <ModuleHeader
        title="Break or keep?"
        onHome={() => onHome(current)}
        onSettings={() => setDialog(true)}
      />
      {done ? (
        <main className="drill-results">
          <p className="eyebrow">Break or keep?</p>
          <h2>Set complete</h2>
          <div className="headline">
            <span className="section-label">{METRIC_INFO.accuracy.label.toUpperCase()}</span>
            <strong>{METRIC_INFO.accuracy.format(correct / DECISIONS.length)}</strong>
            <span className="step-note">
              {correct} of {DECISIONS.length} chose the better line
            </span>
          </div>
          <div className="board-actions results-actions">
            <button className="button primary" onClick={restart}>
              Play again
            </button>
            <button className="button" onClick={() => onHome(current)}>
              Home
            </button>
          </div>
        </main>
      ) : (
        <main className="drill-layout">
          <section className="decision-play" aria-label="Decision">
            <p className="eyebrow">
              {scenario.title} · {index + 1} of {DECISIONS.length}
            </p>
            <div className="decision-board">
              <MiniBoard rows={scenario.rows} label="Your board" className="mini-board decision-grid" />
              <div className="next-slot">
                <div className="section-label">YOUR PIECES</div>
                {scenario.queue.slice(0, 6).map((type, i) => (
                  <div key={i} className="next-piece">
                    <PiecePreview type={type} />
                  </div>
                ))}
              </div>
            </div>
            <p className="decision-prompt">
              You hold a B2B chain with Surge charged. Break it with the first piece
              (releasing Surge), or do not break on it? After that you play on and may release
              later.
            </p>
            <div className="decision-choices">
              <button className="button decision-button" disabled={answered} onClick={() => answer("break")}>
                Break now <kbd>B</kbd>
              </button>
              <button className="button decision-button" disabled={answered} onClick={() => answer("keep")}>
                Do not break <kbd>K</kbd>
              </button>
            </div>
            {outcome && (
              <Result
                outcome={outcome}
                pick={picks[index]}
                lesson={lessonFor(index)}
                last={index === DECISIONS.length - 1}
                onNext={next}
              />
            )}
          </section>
          <aside className="drill-hud" aria-label="Situation">
            <dl className="hud-stats">
              <div>
                <dt>B2B (Surge {scenario.b2b >= SURGE_AT ? "charged" : "off"})</dt>
                <dd>{scenario.b2b}</dd>
              </div>
              <div>
                <dt>Incoming</dt>
                <dd>
                  {pendingLines(scenario.incoming.map((e) => ({ ...e, readyAt: e.delayMs })))}
                  {scenario.incoming[0] &&
                    ` (lands ${(scenario.incoming[0].delayMs / 1000).toFixed(1)} s)`}
                </dd>
              </div>
              <div>
                <dt>Match</dt>
                <dd>
                  Piece {scenario.match.pieces + 1}, {formatClock(scenario.match.ms)}
                  {scenario.match.pieces < LEAGUE_PRESSURE.openerPhase!
                    ? " (opener phase)"
                    : ""}
                </dd>
              </div>
            </dl>
            <VersusInfo state={{ b2b: scenario.b2b, opponent }} />
          </aside>
        </main>
      )}
      {dialog && (
        <SettingsDialog
          settings={current}
          seed={0}
          onApply={(next) => {
            setCurrent(next);
            try {
              saveSettings(localStorage, next);
            } catch {
              /* Settings stay active for this session. */
            }
            setDialog(false);
          }}
          onClose={() => setDialog(false)}
        />
      )}
    </div>
  );
}

function Result({
  outcome,
  pick,
  lesson,
  last,
  onNext,
}: {
  outcome: ReturnType<typeof compare>;
  pick: Line;
  lesson: string;
  last: boolean;
  onNext: () => void;
}) {
  const right = pick === outcome.answer;
  const row = (line: Line, r: LineResult) => (
    <tr key={line} className={line === outcome.answer ? "better" : undefined}>
      <th scope="row">
        {LABEL[line]}
        {line === pick && " (you)"}
      </th>
      <td>{r.sent}</td>
      <td>{r.cancelled}</td>
      <td>{r.received}</td>
      <td>{r.surge}</td>
      <td>{r.ko ? "They topped out" : r.died ? "You topped out" : "-"}</td>
      <td>{net(r)}</td>
    </tr>
  );
  return (
    <section className="decision-result" aria-live="polite">
      <h3 className={right ? "right" : "wrong"}>
        {right ? "Better line" : `${LABEL[outcome.answer]} scored better`}
      </h3>
      <p>{summarize(outcome)}</p>
      <p>{lesson}</p>
      <table>
        <thead>
          <tr>
            <th />
            <th>Sent</th>
            <th>Cancelled</th>
            <th>Took</th>
            <th>Surge out</th>
            <th>Ended</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {row("break", outcome.break)}
          {row("keep", outcome.keep)}
        </tbody>
      </table>
      <p className="step-note">
        Net is lines sent plus lines cancelled minus lines taken. Only what happened counts:
        Surge you still hold when the {DECISION_PIECES} pieces end is worth nothing, and a
        knockout beats any net. Both lines place the same way after the first piece and may
        release Surge whenever it pays. This answer held for 6 and 10 pieces, with{" "}
        {POLICIES.length} play styles and opponent timings, and whether or not a cancelled
        line counts.
      </p>
      <button className="button primary" onClick={onNext}>
        {last ? "Finish" : "Next"} <kbd>Enter</kbd>
      </button>
    </section>
  );
}
