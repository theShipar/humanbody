import { useEffect, useState } from "react";
import { ArrowUpRight, Focus, ChevronRight, BookOpen, Pin, PinOff } from "lucide-react";
import type { Atlas, SceneState } from "../anatomy";
import type { Content, ClinicalCondition, Side, StructureCard } from "../study/types";
export default function Inspector({
  role,
  domain,
  saved,
  onSave,
  onContext,
  onClose,
  atlas,
  state,
  library,
  card,
  side,
  preview,
  condition,
  onCondition,
  onExit,
  onStudy,
  onFocus,
  onPin,
  onCase,
  pinned,
}: {
  role: "explorer" | "student" | "doctor";
  domain: "medical" | "dental";
  saved: boolean;
  onSave: () => void;
  onContext: () => void;
  onClose: () => void;
  atlas: Atlas | null;
  state: SceneState;
  library: Content;
  card: StructureCard | undefined;
  side: Side;
  preview: boolean;
  condition: ClinicalCondition | undefined;
  onCondition: (c: ClinicalCondition) => void;
  onExit: () => void;
  onStudy: () => void;
  onFocus: () => void;
  onPin: () => void;
  onCase: (id: string) => void;
  pinned: boolean;
}) {
  const [tab, setTab] = useState<"structure" | "clinical" | "study">("structure");
  const selected = atlas?.parts.find((p) => p.id === state.selected[0]);
  useEffect(() => {
    if (state.selected.length && !condition) setTab("structure");
  }, [state.selected.join(","), condition?.id]);
  useEffect(() => {
    document
      .querySelector<HTMLElement>(".context-inspector button")
      ?.focus({ preventScroll: true });
  }, []);
  return (
    <aside className="context-inspector glass" aria-label="Structure details">
      <div className="inspector-heading">
        <button className="text-button" onClick={onClose}>
          Close details ×
        </button>
        <span className="section-kicker">
          {condition ? "TEACHING SCENARIO" : selected ? "SELECTED ANATOMY" : "YOUR EXPLORATION"}
        </span>
        <div className="inspector-tabs" role="tablist" aria-label="Anatomy information">
          {(["structure", "clinical", "study"] as const).map((t) => (
            <button role="tab" aria-selected={tab === t} key={t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "structure" && (
        <div className="inspector-body">
          <div className="structure-orbit">
            <Focus size={30} />
          </div>
          <h2>{card?.title ?? selected?.name ?? "A closer look."}</h2>
          <p>
            {selected
              ? "Inspect this structure in context, or focus the camera to explore its form."
              : "Select a bone or search for a structure to begin exploring the anatomy."}
          </p>
          {selected && (
            <>
              <div className="button-row">
                <button className="study-primary" onClick={onFocus}>
                  <Focus size={15} />
                  Focus selection
                </button>
                <button onClick={onContext}>Show in context</button>
                <button aria-pressed={saved} onClick={onSave}>
                  {saved ? "Saved" : "Save"}
                </button>
                <button onClick={onPin}>
                  {pinned ? <PinOff size={15} /> : <Pin size={15} />}{" "}
                  {pinned ? "Unpin label" : "Pin label"}
                </button>
              </div>
              {card ? (
                <>
                  {Object.entries(card.fields)
                    .slice(0, role === "explorer" ? 3 : undefined)
                    .map(([title, text]) => (
                      <div className="card-field" key={title}>
                        <h4>{title}</h4>
                        <p>{text}</p>
                      </div>
                    ))}
                  {role === "explorer" && (
                    <details>
                      <summary>Medical detail</summary>
                      {Object.entries(card.fields)
                        .slice(3)
                        .map(([title, text]) => (
                          <div className="card-field" key={title}>
                            <h4>{title}</h4>
                            <p>{text}</p>
                          </div>
                        ))}
                    </details>
                  )}
                  <details>
                    <summary>References & review</summary>
                    <p>
                      {card.reviewer ?? "Draft · medical review pending"} ·{" "}
                      {card.reviewedAt ?? "Not yet reviewed"}
                    </p>
                    {card.references.map((r, i) => (
                      <a key={r} href={r} target="_blank" rel="noreferrer">
                        Reference {i + 1} ↗
                      </a>
                    ))}
                  </details>
                </>
              ) : (
                <p className="coverage-note">
                  Source anatomy only. No reviewed explanation is available for this structure.
                </p>
              )}
            </>
          )}
          <div className="inspector-footnote">
            {domain === "dental" ? "Dental reference geometry" : "Adult male reference anatomy"} ·
            Coverage varies by structure
          </div>
        </div>
      )}
      {tab === "clinical" && (
        <div className="inspector-body">
          <span className="section-kicker">RELATED CLINICAL EXPLANATIONS</span>
          <h2>
            Connect anatomy
            <br />
            to the clinic.
          </h2>
          <p>Explore affected structures in an educational scenario.</p>
          {!library.conditions.length ? (
            <div className="coverage-note">Clinical material is awaiting medical review.</div>
          ) : (
            <>
              {condition ? (
                <>
                  <button className="text-button" onClick={onExit}>
                    ← Exit teaching scenario
                  </button>
                  <h3>{condition.title}</h3>
                  <div className="scenario-note">
                    Teaching scenario · Structure highlights, not a simulation of disease.
                  </div>
                  {[
                    ["Overview", condition.overview],
                    ["Mechanism", condition.mechanism],
                    ["Typical findings", condition.findings],
                    ["Important complications", condition.complications],
                  ].map(([label, text]) => (
                    <div className="card-field" key={label}>
                      <h4>{label}</h4>
                      <p>{text}</p>
                    </div>
                  ))}
                  <h4>Learning objectives</h4>
                  <ul>
                    {condition.objectives.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                  {condition.caseIds.map((id) => (
                    <button className="study-primary" key={id} onClick={() => onCase(id)}>
                      Practice related case ↗
                    </button>
                  ))}
                  <p className="coverage-note">{condition.limitation}</p>
                  <details className="sources">
                    <summary>Sources & review status</summary>
                    <p>
                      {condition.status === "draft"
                        ? "Draft · medical review pending"
                        : `Reviewed by ${condition.reviewer}`}
                    </p>
                    {condition.references.map((r, i) => (
                      <a key={r} href={r} target="_blank" rel="noreferrer">
                        Reference {i + 1} ↗
                      </a>
                    ))}
                  </details>
                </>
              ) : (
                library.conditions
                  .filter((c) => domain === "medical" && (!card || c.cardIds.includes(card.id)))
                  .map((c) => (
                    <button className="condition-item" key={c.id} onClick={() => onCondition(c)}>
                      <span>
                        <small>{c.region}</small>
                        {c.title}
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))
              )}
            </>
          )}
        </div>
      )}
      {tab === "study" && (
        <div className="inspector-body">
          <BookOpen size={28} />
          <h2>
            From seeing
            <br />
            to understanding.
          </h2>
          <p>
            Guided regional lessons, identification practice, and spaced review connect the model to
            your learning.
          </p>
          <button className="study-primary" onClick={onStudy}>
            Open learning workspace
            <ArrowUpRight size={16} />
          </button>
          <p className="coverage-note">
            {preview
              ? "Reviewer preview contains unapproved drafts."
              : "Only medically approved content appears in the student workspace."}
          </p>
        </div>
      )}
    </aside>
  );
}
