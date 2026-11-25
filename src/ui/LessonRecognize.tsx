import { useEffect, useState } from "react";
import type { RecognizeRound } from "../core/lesson";
import { MiniBoard } from "./MiniBoard";

const ROWS = 8;
/** Bottom-aligned so boards of different heights line up. */
const pad = (rows: readonly string[]) => [
  ...Array(Math.max(0, ROWS - rows.length)).fill(".".repeat(10)),
  ...rows,
];

/**
 * Four boards in a 2x2 grid; pick the one with the structure by click or the
 * keys 1 to 4. `onDone` fires once every round has been answered correctly.
 */
export function LessonRecognize({
  rounds,
  name,
  active,
  onDone,
}: {
  rounds: readonly RecognizeRound[];
  name: string;
  /** False while a dialog is open, so number keys do nothing. */
  active: boolean;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [right, setRight] = useState(false);
  const round = rounds[index];
  const finished = right && index === rounds.length - 1;
  const pick = (i: number) => {
    if (right) return;
    if (i === round.answer) {
      setRight(true);
      if (index === rounds.length - 1) onDone();
    } else setWrong((w) => (w.includes(i) ? w : [...w, i]));
  };
  useEffect(() => {
    if (!active) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input,select,textarea")) return;
      const n = Number(event.key);
      if (n >= 1 && n <= 4) pick(n - 1);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  return (
    <section aria-labelledby="recognize-title">
      <h2 id="recognize-title">
        Which board has the {name}? ({index + 1} of {rounds.length})
      </h2>
      <div className="recognize-grid">
        {round.boards.map((rows, i) => {
          const state =
            right && i === round.answer ? "correct" : wrong.includes(i) ? "wrong" : "";
          return (
            <button
              key={`${index}-${i}`}
              className={`recognize-board ${state}`}
              disabled={right}
              onClick={() => pick(i)}
              aria-label={`Board ${i + 1}${state ? `, ${state}` : ""}`}
            >
              <kbd>{i + 1}</kbd>
              <MiniBoard rows={pad(rows)} />
            </button>
          );
        })}
      </div>
      <div role="status" aria-live="polite">
        {wrong.length > 0 && !right && <p>Not that one. Look for the cue and try again.</p>}
        {right && <p>Correct. {round.note}</p>}
      </div>
      {right && !finished && (
        <button
          className="button primary"
          onClick={() => {
            setIndex(index + 1);
            setWrong([]);
            setRight(false);
          }}
        >
          Next round
        </button>
      )}
      {finished && <p>All rounds done.</p>}
    </section>
  );
}
