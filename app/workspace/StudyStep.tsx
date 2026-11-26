import type { Lesson, StructureCard } from "../study/types";
export default function StudyStep({
  step,
  cards,
  onFocus,
  onCard,
  onCheck,
}: {
  step: Lesson["steps"][number];
  cards: StructureCard[];
  onFocus: () => void;
  onCard: (c: StructureCard) => void;
  onCheck: () => void;
}) {
  const related = cards.filter((c) => step.cardIds.includes(c.id));
  return (
    <section className="study-step">
      <span className="visual-type">{step.kind[0].toUpperCase() + step.kind.slice(1)}</span>
      <h4>{step.title}</h4>
      <p>{step.text}</p>
      {step.kind !== "check" && (
        <>
          <div className="chip-list">
            {related.map((c) => (
              <button key={c.id} onClick={() => onCard(c)}>
                {c.title}
              </button>
            ))}
          </div>
          <button className="text-button" onClick={onFocus}>
            Return to lesson view
          </button>
        </>
      )}
      {step.kind === "explain" &&
        related.map((c) => (
          <details key={c.id}>
            <summary>{c.title}: relationships</summary>
            {c.relationships.map((r, i) => (
              <p key={i}>{r.label}</p>
            ))}
          </details>
        ))}
      {step.kind === "check" && (
        <button className="study-primary" onClick={onCheck}>
          Answer {step.questionIds.length} linked questions
        </button>
      )}
      <details>
        <summary>Learning objective</summary>
        <p>{step.objective}</p>
      </details>
    </section>
  );
}
