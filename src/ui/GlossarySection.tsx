import { explainTerm, GLOSSARY_ORDER, termLabel } from "../core/glossary";

export function GlossarySection() {
  return (
    <section className="level-section" aria-labelledby="glossary-title">
      <div className="level-heading">
        <h2 id="glossary-title">Glossary</h2>
        <p>What each stat means, with rank context.</p>
      </div>
      <details className="glossary">
        <summary>Show all {GLOSSARY_ORDER.length} terms</summary>
        <dl>
          {GLOSSARY_ORDER.map((id) => (
            <div key={id}>
              <dt>{termLabel(id)}</dt>
              <dd>{explainTerm(id)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
