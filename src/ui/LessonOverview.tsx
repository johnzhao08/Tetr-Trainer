import type { Lesson } from "../core/lesson";

export function LessonOverview({
  lesson,
  onStart,
}: {
  lesson: Lesson;
  onStart: () => void;
}) {
  return (
    <section className="lesson-overview" aria-labelledby="lesson-title">
      <h2 id="lesson-title">{lesson.title}</h2>
      <p>{lesson.summary}</p>
      <h3>Why it matters</h3>
      <p>{lesson.why}</p>
      <h3>When to use it</h3>
      <p>{lesson.whenToUse}</p>
      <h3>Common mistakes</h3>
      <ul>
        {lesson.mistakes.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <button className="button primary" onClick={onStart}>
        Start the first step
      </button>
    </section>
  );
}
