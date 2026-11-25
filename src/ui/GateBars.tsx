import { STRETCH } from "../core/curriculum";
import type { Stage } from "../core/curriculum";
import { findDrill, gateText } from "../core/drillLookup";
import { evaluateGate, METRIC_INFO } from "../core/progress";
import type { Progress } from "../core/progress";

// The stage's gates, each with a labelled progress bar.
export function GateBars({ stage, progress }: { stage: Stage; progress: Progress }) {
  return (
    <ul className="gate-list" aria-label={`${stage.title} gates`}>
      {stage.gates.map((gate, i) => {
        const status = evaluateGate(progress, gate);
        const title = findDrill(gate.drillId)?.drill.title ?? gate.drillId;
        const text = gateText(gate);
        const value =
          status.value === null
            ? "No qualifying runs yet"
            : `Now ${METRIC_INFO[gate.metric].format(status.value)}`;
        return (
          <li key={i} className={status.met ? "gate met" : "gate"}>
            <div className="gate-head">
              <span>
                {title}: {text}
                {gate.label === STRETCH && " (stretch)"}
              </span>
              <strong>{status.met ? "Met" : value}</strong>
            </div>
            <div
              className="gate-bar"
              role="progressbar"
              aria-label={`${title}: ${text}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(status.progress * 100)}
              aria-valuetext={status.met ? "Met" : value}
            >
              <span style={{ width: `${status.progress * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
