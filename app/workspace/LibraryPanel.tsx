import { useState } from "react";
import type { Atlas } from "../anatomy";
import type { Content, Progress, Question } from "../study/types";
import type { Scenario } from "../clinical/types";
import { getScenarios } from "../clinical/catalogue";
export default function LibraryPanel({
  progress,
  library,
  atlas,
  preview,
  onQuestion,
  onScenario,
  onBookmark,
  onExport,
  onImport,
  ready,
}: {
  progress: Progress;
  library: Content;
  atlas: Atlas | null;
  preview: boolean;
  onQuestion: (q: Question) => void;
  onScenario: (s: Scenario, q?: string) => void;
  onBookmark: (id: string) => void;
  onExport: () => void;
  onImport: () => void;
  ready: boolean;
}) {
  const [section, setSection] = useState("due");
  const prefix = preview ? "preview:" : "";
  const scenarios = getScenarios(preview);
  const items = [
    ...library.questions.map((q) => ({
      id: q.id,
      title: q.prompt,
      source: "Anatomy practice",
      open: () => onQuestion(q),
    })),
    ...scenarios.flatMap((s) =>
      s.questions.map((q) => ({
        id: `scenario:${s.id}:${q.id}`,
        title: q.prompt,
        source: s.title,
        open: () => onScenario(s, q.id),
      })),
    ),
  ];
  const due = items
    .filter(
      (i) =>
        progress.reviews[prefix + i.id] &&
        Date.parse(progress.reviews[prefix + i.id].due) <= Date.now(),
    )
    .sort(
      (a, b) =>
        Date.parse(progress.reviews[prefix + a.id].due) -
        Date.parse(progress.reviews[prefix + b.id].due),
    );
  const latest = new Map<string, boolean>();
  progress.attempts
    .filter((a) => a.preview === preview)
    .forEach((a) => latest.set(a.questionId, a.correct));
  const mistakes = items.filter((i) => latest.get(i.id) === false);
  const bookmarks = progress.bookmarks
    .map((id) => ({
      id,
      title: id.startsWith("atlas:")
        ? atlas?.parts.find((p) => p.id === id.slice(6))?.name
        : id.startsWith("scenario:")
          ? scenarios.find((s) => s.id === id.slice(9))?.title
          : library.cards.find((c) => c.id === id)?.title,
    }))
    .filter((b) => b.title);
  return (
    <section className="library-controller">
      <h2>My Library</h2>
      <p>Your next useful step, saved on this device.</p>
      <nav aria-label="Library categories" className="library-categories">
        {[
          ["due", "Due reviews"],
          ["mistakes", "Mistakes"],
          ["bookmarks", "Bookmarks"],
          ["history", "History"],
          ["backups", "Backups"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={section === id} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </nav>
      {(section === "due" || section === "mistakes") && (
        <>
          <h3>{section === "due" ? `${due.length} due for review` : "Revisit mistakes"}</h3>
          {(section === "due" ? due : mistakes).map((i) => (
            <button key={i.id} className="case-tile" onClick={i.open}>
              <span>
                {i.title}
                <small>{i.source}</small>
              </span>
            </button>
          ))}
          {!(section === "due" ? due : mistakes).length && (
            <p>
              {section === "due"
                ? "Nothing is due right now. Questions you practise will return here when it is time to review."
                : "No unanswered mistakes in the available content."}
            </p>
          )}
        </>
      )}
      {section === "bookmarks" && (
        <>
          <h3>Saved anatomy & explanations</h3>
          {bookmarks.map((b) => (
            <button
              key={b.id}
              className="case-tile"
              onClick={() => {
                if (b.id.startsWith("scenario:")) {
                  const s = scenarios.find((s) => s.id === b.id.slice(9));
                  if (s) onScenario(s);
                } else onBookmark(b.id);
              }}
            >
              {b.title}
            </button>
          ))}
          {!bookmarks.length && (
            <p>Use Save in structure details or an explanation to keep it here.</p>
          )}
        </>
      )}
      {section === "history" && (
        <>
          <h3>Practice history</h3>
          <p>Practice records describe your answers, not clinical competence.</p>
          {progress.attempts
            .filter((a) => a.preview === preview)
            .slice()
            .reverse()
            .slice(0, 50)
            .map((a, i) => (
              <div className="review-row" key={`${a.at}-${i}`}>
                <span>
                  {items.find((x) => x.id === a.questionId)?.title ?? a.questionId}
                  <small>
                    {a.correct ? "Correct" : "Needs review"} · {new Date(a.at).toLocaleDateString()}
                  </small>
                </span>
              </div>
            ))}
        </>
      )}
      {section === "backups" && (
        <>
          <h3>Keep a copy of your learning</h3>
          <p>
            Clearing browser data removes your progress. Export a backup to move it to another
            browser. Import replaces existing history.
          </p>
          <div className="button-row">
            <button disabled={!ready} onClick={onExport}>
              Export JSON
            </button>
            <button disabled={!ready} onClick={onImport}>
              Import JSON
            </button>
          </div>
        </>
      )}
    </section>
  );
}
