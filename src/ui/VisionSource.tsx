import { GENERATED_LABEL, SOURCE_URL } from "../core/vision";
import type { VisionQuestion } from "../core/vision";

/**
 * Where the board came from. Generated stacks are labelled as such; sourced
 * boards cite their four.lol page once the answer is revealed (the page name
 * would give a structure question away).
 */
export function VisionSource({
  q,
  revealed = false,
}: {
  q: VisionQuestion;
  revealed?: boolean;
}) {
  if (q.source === "generated")
    return <p className="step-note vision-source">{GENERATED_LABEL}</p>;
  const url = SOURCE_URL[q.source.structure];
  return (
    <p className="step-note vision-source">
      Sourced position (four.lol)
      {revealed && (
        <>
          {": "}
          <a href={url} target="_blank" rel="noreferrer">
            {url.replace("https://", "")}
          </a>
        </>
      )}
    </p>
  );
}
