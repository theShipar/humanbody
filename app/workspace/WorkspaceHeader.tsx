import { getScenarios } from "../clinical/catalogue";
import { scenarioMatches } from "../clinical/timeline";
import type { Scenario } from "../clinical/types";
import { useEffect, useRef, useState } from "react";
import { Search, BookOpen, Presentation, ArrowUpRight, Compass, Library } from "lucide-react";
import Popover from "./Popover";
import type { Atlas, Concept } from "../anatomy";
import type { Lesson } from "../study/types";
import Selector from "./Selector";
import { destinations, roles, dentalParts, type Role, type Destination } from "./navigation";
export default function WorkspaceHeader({
  onScenario,
  destination,
  onNavigate,
  role,
  onRole,
  onTour,
  domain,
  preview,
  atlas,
  onConcept,
  lessons,
  onLesson,
  onReview,
  onAtlas,
}: {
  onScenario: (s: Scenario) => void;
  destination: Destination;
  onNavigate: (v: Destination) => void;
  role: Role;
  onRole: (v: Role) => void;
  onTour: () => void;
  domain: "medical" | "dental";
  preview: boolean;
  atlas: Atlas | null;
  onConcept: (c: Concept) => void;
  lessons: Lesson[];
  onLesson: (id: string) => void;
  onReview: () => void;
  onAtlas: () => void;
}) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    search = useRef<HTMLInputElement>(null);
  const results = query.trim()
    ? (atlas?.concepts
        .filter(
          (c) =>
            (domain === "medical" ||
              c.elements.some((id) => atlas && dentalParts(atlas).includes(id))) &&
            c.name.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 8) ?? [])
    : [];
  function show() {
    dialog.current?.showModal();
    search.current?.focus();
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <>
      <header className="workspace-header" data-layout="header">
        <a
          className="workspace-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onAtlas();
          }}
        >
          <span>
            H<span>+</span>
          </span>
          <strong>
            LearnHumanBody<small>Created by TheShipar</small>
          </strong>
        </a>
        <nav aria-label="Main navigation" className="workspace-switch">
          {destinations.map((d, i) => {
            const Icon = [Compass, BookOpen, Presentation, Library][i];
            return (
              <button
                key={d.id}
                aria-current={destination === d.id ? "page" : undefined}
                onClick={() => onNavigate(d.id)}
              >
                <Icon size={17} />
                {d.label}
              </button>
            );
          })}
        </nav>
        <div className="workspace-utilities">
          <button aria-label="Search anatomy and lessons" className="search-trigger" onClick={show}>
            <Search size={17} />
            <span>Search</span>
            <kbd>⌘ K</kbd>
          </button>
          <Selector label="Your role" value={role} options={roles} onChange={onRole} />
          <Popover label="Help">
            <h3>Make yourself at home</h3>
            <button onClick={onTour}>Take a quick tour</button>
            <button onClick={onAtlas}>Explore the whole body</button>
            <button onClick={onReview}>My Library & backups</button>
            <p>Your role changes suggestions and reading depth. All tools remain available.</p>
            <p>Progress stays on this device. Export a backup from My Library.</p>
          </Popover>
        </div>
      </header>
      <dialog
        ref={dialog}
        aria-label="Search LearnHumanBody"
        className="workspace-search-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div>
          <label>
            <Search size={19} />
            <input
              ref={search}
              aria-label="Search anatomy and lessons"
              value={query}
              placeholder="Find anatomy, conditions or lessons…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button onClick={() => dialog.current?.close()}>Close</button>
        </div>
        <section>
          {(["condition", "procedure", "pain"] as const).map((kind) => {
            const matches = getScenarios(preview).filter(
              (s) =>
                s.domain === domain && s.kind === kind && query.trim() && scenarioMatches(s, query),
            );
            return (
              matches.length > 0 && (
                <section key={kind}>
                  <h3>
                    {kind === "condition"
                      ? "Conditions"
                      : kind === "procedure"
                        ? "Procedures"
                        : "Pain patterns"}
                  </h3>
                  {matches.slice(0, 5).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onScenario(s);
                        dialog.current?.close();
                      }}
                    >
                      <span>
                        {s.title}
                        <small>
                          {s.region} · {s.status === "draft" ? "Unapproved preview" : "Reviewed"} ·{" "}
                          {s.visualMethod}
                        </small>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </section>
              )
            );
          })}
          <h3>Anatomy</h3>
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onConcept(c);
                dialog.current?.close();
              }}
            >
              {c.name}
              <ArrowUpRight size={16} />
            </button>
          ))}
          {query && !results.length && <p>No matching anatomy.</p>}
          <h3>Lessons</h3>
          {lessons
            .filter((l) => query && l.title.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5)
            .map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  onLesson(l.id);
                  dialog.current?.close();
                }}
              >
                {l.title}
                <ArrowUpRight size={16} />
              </button>
            ))}
          <button
            onClick={() => {
              onNavigate("explain");
              dialog.current?.close();
            }}
          >
            Search conditions and treatments →
          </button>
        </section>
      </dialog>
    </>
  );
}
