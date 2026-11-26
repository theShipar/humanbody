import Selector from "../workspace/Selector";
import { dentalParts } from "../workspace/navigation";
import AssetComparison from "./AssetComparison";
import { visibleAssets } from "./asset-runtime";
import assetManifest from "./assets.json";
import type { VisualAsset } from "./types";
import StageDiagram from "./StageDiagram";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Presentation,
  Search,
  X,
  ArrowLeft,
} from "lucide-react";
import type { Atlas, Concept } from "../anatomy";
import type { Progress, Lesson } from "../study/types";
import type { Scenario, Stage } from "./types";
import { getScenarios, specialties } from "./catalogue";
import { advanceTimeline, evaluateTimeline, scenarioMatches } from "./timeline";

function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences are optional; study storage reports its own errors. */
  }
}
export default function ClinicalWorkspace({
  onBookmark,
  role,
  reviewRequest,
  domain,
  setDomain,
  cameraInteraction,
  active,
  preview,
  atlas,
  onStage,
  onConcept,
  onPresent,
  onClose,
  onLearn,
  progress,
  onRecord,
  lessons,
  onLesson,
}: {
  onBookmark: (id: string) => void;
  role: "explorer" | "student" | "doctor";
  reviewRequest: {
    id: string;
    request: number;
    questionId?: string;
    overview?: boolean;
    resume?: boolean;
  } | null;
  domain: "medical" | "dental";
  setDomain: (d: "medical" | "dental") => void;
  cameraInteraction: number;
  active: boolean;
  preview: boolean;
  atlas: Atlas | null;
  onStage: (stage: Stage, focus: boolean) => void;
  onConcept: (c: Concept) => void;
  onPresent: (v: boolean) => void;
  onClose: () => void;
  onLearn: () => void;
  lessons: Lesson[];
  onLesson: (id: string) => void;
  progress: Progress;
  onRecord: (s: Scenario, q: Scenario["questions"][number], answer: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(true);
  const [questionId, setQuestionId] = useState("");
  const [followCamera, setFollowCamera] = useState(false);
  useEffect(() => setFollowCamera(false), [cameraInteraction]);

  const [specialty, setSpecialty] = useState(() => preference("atlas-specialty", ""));
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const value = JSON.parse(preference("atlas-recent-scenarios", "[]"));
      return Array.isArray(value) ? value.filter((x) => typeof x === "string").slice(0, 5) : [];
    } catch {
      return [];
    }
  });
  const [query, setQuery] = useState(""),
    [region, setRegion] = useState(""),
    [kind, setKind] = useState("");
  const [id, setId] = useState<string | null>(null),
    [trackId, setTrackId] = useState(""),
    [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [present, setPresent] = useState(false),
    [detail, setDetail] = useState(false),
    [tab, setTab] = useState("overview"),
    [notes, setNotes] = useState(""),
    [answer, setAnswer] = useState<string | null>(null);
  useEffect(() => setDetail(role === "doctor"), [role]);
  const callbacks = useRef({ onStage, onPresent, onConcept });
  callbacks.current = { onStage, onPresent, onConcept };
  const scenarios = useMemo(() => getScenarios(preview), [preview]);
  useEffect(() => {
    setId(null);
    setPlaying(false);
    setPresent(false);
    callbacks.current.onPresent(false);
  }, [domain]);
  useEffect(() => {
    if (!reviewRequest) return;
    const target = scenarios.find((s) => s.id === reviewRequest.id);
    if (target) {
      choose(target);
      setQuestionId(reviewRequest.questionId ?? target.questions[0]?.id ?? "");
      setTab(reviewRequest.overview ? "overview" : "questions");
      if (reviewRequest.resume) {
        try {
          const saved = JSON.parse(
            preference(`lhb-scenario:${preview ? "editorial:" : ""}${domain}`, "null"),
          );
          const t = target.tracks.find((t) => t.id === saved?.trackId);
          if (saved?.id === target.id && t && Number.isFinite(saved.position)) {
            setTrackId(t.id);
            setPosition(Math.max(0, Math.min(t.stages.length - 1, saved.position)));
          }
        } catch {}
      }
    }
  }, [reviewRequest]);
  useEffect(() => {
    document.querySelector(".clinical-panel")?.scrollTo({ top: 0 });
  }, [id, tab]);
  const scenario = scenarios.find((s) => s.id === id);
  const track = scenario?.tracks.find((t) => t.id === trackId) ?? scenario?.tracks[0];
  const evaluated = track ? evaluateTimeline(track, position) : null;
  const stage = evaluated?.stage;
  useEffect(() => {
    if (active && scenario && track)
      savePreference(
        `lhb-scenario:${preview ? "editorial:" : ""}${domain}`,
        JSON.stringify({
          version: 1,
          id: scenario.id,
          title: scenario.title,
          trackId: track.id,
          position,
        }),
      );
  }, [active, scenario, track, position, domain, preview]);
  const results = scenarios.filter(
    (s) =>
      s.domain === domain &&
      (!specialty || domain === "dental" || s.specialtyIds.includes(specialty)) &&
      (!region || s.region === region) &&
      (!kind ||
        s.kind === kind ||
        (kind === "procedure" && s.tracks.some((t) => t.kind === "treatment")) ||
        (kind === "pain" && !!s.pain)) &&
      scenarioMatches(s, query),
  );
  const anatomy = query.trim()
    ? (atlas?.concepts
        .filter(
          (c) =>
            (domain === "medical" ||
              (atlas && c.elements.some((id) => dentalParts(atlas).includes(id)))) &&
            c.name.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 5) ?? [])
    : [];
  useEffect(() => {
    savePreference("atlas-domain", domain);
    savePreference("atlas-specialty", specialty);
  }, [domain, specialty]);
  useEffect(() => {
    if (!active) {
      setPlaying(false);
      setPresent(false);
      callbacks.current.onPresent(false);
    }
  }, [active]);
  useEffect(() => {
    setPlaying(false);
    setAnswer(null);
  }, [id]);
  useEffect(() => {
    if (!scenario) {
      setPlaying(false);
      setPresent(false);
      callbacks.current.onPresent(false);
    }
  }, [scenario]);
  useEffect(() => {
    if (stage && active) callbacks.current.onStage(stage, followCamera);
  }, [stage, active, followCamera]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  useEffect(() => {
    const exit = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPresent(false);
        callbacks.current.onPresent(false);
        setPlaying(false);
      }
    };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, []);
  useEffect(() => {
    if (!playing || !track || !active) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(),
        elapsed = now - previous;
      previous = now;
      setPosition((p) => advanceTimeline(track, p, elapsed, speed).position);
    }, 80);
    return () => clearInterval(timer);
  }, [playing, track, speed, active]);
  useEffect(() => {
    if (evaluated?.ended) setPlaying(false);
  }, [evaluated?.ended]);
  function choose(s: Scenario) {
    setId(s.id);
    setRecentIds((previous) => {
      const next = [s.id, ...previous.filter((id) => id !== s.id)].slice(0, 5);
      savePreference("atlas-recent-scenarios", JSON.stringify(next));
      return next;
    });
    setTrackId(s.tracks[0].id);
    setPosition(0);
    setTab("overview");
    setPlaying(false);
    callbacks.current.onStage(s.tracks[0].stages[0], true);
  }
  function seek(p: number) {
    setPlaying(false);
    setPosition(p);
  }
  function togglePresent(v: boolean) {
    setPresent(v);
    callbacks.current.onPresent(v);
  }
  function exportCorrection() {
    if (!scenario) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schemaVersion: 1,
            scenarioId: scenario.id,
            version: scenario.version,
            trackId: track?.id,
            stageId: stage?.id,
            notes,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "learnhumanbody-content-correction.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const question = scenario?.questions.find((q) => q.id === questionId) ?? scenario?.questions[0];
  function grade(value: string) {
    if (!question || !scenario) return;
    setPlaying(false);
    setAnswer(value);
    onRecord(scenario, question, value);
  }

  return (
    <div className={`clinical-workspace ${present ? "is-presenting" : ""}`} hidden={!active}>
      {!present && (
        <aside
          className={`clinical-panel glass ${sheetOpen ? "" : "clinical-sheet-collapsed"}`}
          aria-label="Clinical explanations"
        >
          <button
            className="mobile-sheet-handle"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((v) => !v)}
          >
            {sheetOpen ? "Collapse explanation" : "Read explanation"}
          </button>
          <div className="clinical-sheet-content">
            <div className="clinical-top">
              <span className="section-kicker">EXPLANATION WORKSPACE</span>
              <button
                aria-label="Close explanations"
                onClick={() => {
                  setPlaying(false);
                  onClose();
                }}
              >
                <X size={18} />
              </button>
            </div>
            {scenario ? (
              <>
                <button
                  className="clinical-back"
                  onClick={() => {
                    setId(null);
                    setPlaying(false);
                  }}
                >
                  <ArrowLeft size={14} />
                  All explanations
                </button>
                <h2>{scenario.title}</h2>
                {stage && (
                  <>
                    <span className="visual-type">Reference anatomy + schematic</span>
                    {stage?.assetIds
                      .map((id) => (assetManifest as VisualAsset[]).find((a) => a.id === id))
                      .filter(
                        (a): a is VisualAsset =>
                          !!a &&
                          visibleAssets([a], stage.id, preview).length > 0 &&
                          (a.format === "glb" || a.format === "svg"),
                      )
                      .map((a) => (
                        <AssetComparison
                          key={a.id + ":" + a.version}
                          asset={a}
                          assets={assetManifest as VisualAsset[]}
                        />
                      ))}
                    <StageDiagram stage={stage} />
                    <p>{stage.patientText}</p>
                  </>
                )}
                <span className="clinical-status">
                  {scenario.status === "draft"
                    ? "Reviewer draft · not for patient use"
                    : "Reviewed educational scenario"}
                </span>
                <div className="clinical-tabs">
                  {[
                    "overview",
                    "timeline",
                    ...(scenario.tracks.some((t) => t.kind === "treatment") ? ["treatment"] : []),
                    ...(question ? ["questions"] : []),
                  ].map((t) => (
                    <button
                      key={t}
                      aria-pressed={tab === t}
                      onClick={() => {
                        setTab(t);
                        if (t === "questions") setPlaying(false);
                        if (t === "treatment") {
                          const treatment = scenario.tracks.find((t) => t.kind === "treatment");
                          if (treatment) {
                            setTrackId(treatment.id);
                            setPosition(0);
                            setPlaying(false);
                          }
                        }
                      }}
                    >
                      {t === "timeline" ? "Progression" : t}
                    </button>
                  ))}
                </div>
                {tab === "overview" ? (
                  <>
                    <p>{scenario.overview}</p>
                    <h3>What this explains</h3>
                    <ul>
                      {scenario.objectives.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                    {scenario.pain && (
                      <div className="clinical-note">
                        <strong>Pain may be felt: {scenario.pain.feltRegion}</strong>
                        <p>{scenario.pain.description}</p>
                      </div>
                    )}
                    <button className="clinical-primary" onClick={() => setTab("timeline")}>
                      Explore the stages →
                    </button>
                  </>
                ) : tab === "questions" && question ? (
                  <>
                    {scenario.questions.length > 1 && (
                      <label className="clinical-field">
                        Question
                        <Selector
                          label="Scenario question"
                          value={question.id}
                          onChange={(v) => {
                            setQuestionId(v);
                            setAnswer(null);
                          }}
                          options={scenario.questions.map((q) => ({ id: q.id, label: q.prompt }))}
                        />
                      </label>
                    )}
                    <p>{question.prompt}</p>
                    {question.options.map((o) => (
                      <button
                        className="clinical-choice"
                        disabled={answer !== null}
                        key={o}
                        onClick={() => grade(o)}
                      >
                        {o}
                      </button>
                    ))}
                    {answer && (
                      <div role="status">
                        <strong>
                          {answer === question.answer ? "Correct" : "Revisit this idea"}
                        </strong>
                        <p>{question.explanation}</p>
                        <button
                          onClick={() => {
                            setTrackId(question.trackId);
                            const t = scenario.tracks.find((t) => t.id === question.trackId)!;
                            seek(t.stages.findIndex((s) => s.id === question.stageId));
                            setTab("timeline");
                          }}
                        >
                          Review relevant stage
                        </button>
                        <button onClick={() => setAnswer(null)}>Try again</button>
                        <p>Saved to local scenario review.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <label className="clinical-field">
                      Explanation track
                      <Selector
                        label="Explanation track"
                        value={track?.id ?? ""}
                        onChange={(v) => {
                          setTrackId(v);
                          seek(0);
                          setAnswer(null);
                        }}
                        options={scenario.tracks.map((t) => ({
                          id: t.id,
                          label: `${t.title} · ${t.branch}`,
                        }))}
                      />
                    </label>
                    <ol className="clinical-stage-list">
                      {track?.stages.map((s, i) => (
                        <li key={s.id}>
                          <button
                            aria-current={stage?.id === s.id ? "step" : undefined}
                            onClick={() => seek(i)}
                          >
                            <span>{i + 1}</span>
                            {s.title}
                          </button>
                        </li>
                      ))}
                    </ol>
                    <label>
                      <input
                        type="checkbox"
                        checked={detail}
                        onChange={(e) => setDetail(e.target.checked)}
                      />{" "}
                      Clinical detail
                    </label>
                    <p>{detail ? stage?.clinicalText : stage?.patientText}</p>
                  </>
                )}
                <p className="clinical-note">{scenario.limitation}</p>
                <button className="clinical-primary" onClick={() => togglePresent(true)}>
                  <Presentation size={16} />
                  {preview ? "Preview presentation" : "Present"}
                </button>
                <button
                  aria-pressed={progress.bookmarks.includes(`scenario:${scenario.id}`)}
                  onClick={() => onBookmark(scenario.id)}
                >
                  {progress.bookmarks.includes(`scenario:${scenario.id}`)
                    ? "Saved to My Library"
                    : "Save explanation"}
                </button>
                <details>
                  <summary>Sources & review</summary>
                  <p>
                    Version {scenario.version} · {scenario.reviewer ?? "Medical review outstanding"}{" "}
                    · {scenario.reviewedAt ?? "Not yet reviewed"}
                  </p>
                  {scenario.references.map((r, i) => (
                    <a key={r} href={r} target="_blank" rel="noreferrer">
                      Reference {i + 1} ↗
                    </a>
                  ))}
                </details>
                {preview && (
                  <details>
                    <summary>Report a content correction</summary>
                    <label className="clinical-field">
                      Content notes only — no patient information
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                    <button onClick={exportCorrection}>Export correction JSON</button>
                  </details>
                )}
              </>
            ) : (
              <>
                <h2>Make the explanation clear.</h2>
                <p>Find a condition, explore its anatomy, and walk through what changes.</p>
                <label className="clinical-search">
                  <Search size={17} />
                  <input
                    aria-label="Search explanations and anatomy"
                    placeholder="Condition, anatomy or treatment"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {domain === "medical" && (
                  <label className="clinical-field">
                    Specialty
                    <Selector
                      label="Specialty"
                      value={specialty}
                      onChange={setSpecialty}
                      searchable
                      options={[
                        { id: "", label: "All specialties" },
                        ...specialties
                          .filter((s) => s.domain === "medical")
                          .map((s) => ({ id: s.id, label: s.title })),
                      ]}
                    />
                  </label>
                )}
                <div className="clinical-filters">
                  <Selector
                    label="Region"
                    value={region}
                    onChange={setRegion}
                    options={[
                      { id: "", label: "All regions" },
                      ...[
                        ...new Set(
                          scenarios.filter((s) => s.domain === domain).map((s) => s.region),
                        ),
                      ].map((r) => ({ id: r, label: r })),
                    ]}
                  />
                  <Selector
                    label="Explanation type"
                    value={kind}
                    onChange={setKind}
                    options={[
                      { id: "", label: "All explanations" },
                      { id: "condition", label: "Conditions" },
                      { id: "procedure", label: "Treatments" },
                      { id: "pain", label: "Pain patterns" },
                    ]}
                  />
                </div>
                {(specialty || region || kind) && (
                  <div className="clinical-chips">
                    {specialty && <button onClick={() => setSpecialty("")}>Specialty ×</button>}
                    {region && <button onClick={() => setRegion("")}>{region} ×</button>}
                    {kind && <button onClick={() => setKind("")}>{kind} ×</button>}
                  </div>
                )}
                {!query &&
                  !region &&
                  !kind &&
                  recentIds.some((id) => results.some((s) => s.id === id)) && (
                    <details className="recent-scenarios">
                      <summary>Recent explanations</summary>
                      {recentIds
                        .map((id) => results.find((s) => s.id === id))
                        .filter((s): s is Scenario => !!s)
                        .map((s) => (
                          <button key={s.id} className="scenario-result" onClick={() => choose(s)}>
                            {s.title} ↗
                          </button>
                        ))}
                    </details>
                  )}
                <h3>Explanations · {results.length}</h3>
                {results.map((s) => (
                  <button className="scenario-result" key={s.id} onClick={() => choose(s)}>
                    <span>
                      {s.title}
                      <small>
                        {s.region} ·{" "}
                        {s.visualMethod === "diagram" ? "Schematic" : "Reference anatomy + diagram"}{" "}
                        · {s.status === "draft" ? "Unapproved preview" : "Reviewed"}
                      </small>
                    </span>
                    <span>↗</span>
                  </button>
                ))}
                {!results.length && (
                  <p className="clinical-note">
                    {preview
                      ? "No matching reviewed-preview content is available."
                      : "This catalogue is awaiting specialist review. No approved explanation matches these filters."}
                  </p>
                )}
                {anatomy.length > 0 && (
                  <>
                    <h3>Anatomy</h3>
                    {anatomy.map((c) => (
                      <button className="scenario-result" key={c.id} onClick={() => onConcept(c)}>
                        {c.name} ↗
                      </button>
                    ))}
                  </>
                )}
                {query.trim() &&
                  lessons.some((l) => l.title.toLowerCase().includes(query.toLowerCase())) && (
                    <>
                      <h3>Lessons</h3>
                      {lessons
                        .filter((l) => l.title.toLowerCase().includes(query.toLowerCase()))
                        .slice(0, 5)
                        .map((l) => (
                          <button
                            key={l.id}
                            className="scenario-result"
                            onClick={() => onLesson(l.id)}
                          >
                            {l.title} →
                          </button>
                        ))}
                    </>
                  )}
                <button className="scenario-result" onClick={onLearn}>
                  Guided lessons & practice →
                </button>
                <details>
                  <summary>Coverage & release readiness</summary>
                  <p>
                    27 domains · 270 planned scenario slots.{" "}
                    {scenarios.filter((s) => s.status === "approved").length} approved scenarios
                    available. Planning slots are not clinical content.
                  </p>
                  <p>
                    Detailed injury, implant and dental assets require commissioning and medical
                    approval.
                  </p>
                </details>
                {progress.attempts.some((a) => a.questionId.startsWith("scenario:")) && (
                  <details>
                    <summary>Scenario review</summary>
                    {scenarios
                      .filter((s) =>
                        s.questions.some(
                          (q) =>
                            progress.reviews[
                              `${preview ? "preview:" : ""}scenario:${s.id}:${q.id}`
                            ],
                        ),
                      )
                      .map((s) => (
                        <button
                          className="scenario-result"
                          key={s.id}
                          onClick={() => {
                            choose(s);
                            setTab("questions");
                          }}
                        >
                          {s.title} · Review →
                        </button>
                      ))}
                  </details>
                )}
              </>
            )}
          </div>
        </aside>
      )}
      {scenario && track && stage && (
        <section className="scenario-player glass" aria-label="Scenario timeline">
          <div className="player-heading">
            <div>
              <span className="section-kicker">
                {scenario.status === "draft"
                  ? "REVIEWER PREVIEW · UNAPPROVED"
                  : "TEACHING SCENARIO"}{" "}
                · STAGES, NOT ELAPSED TIME
              </span>
              <h3>{stage.title}</h3>
            </div>
            {present && (
              <button onClick={() => togglePresent(false)}>
                Exit presentation <X size={16} />
              </button>
            )}
          </div>
          <StageDiagram stage={stage} />
          <p className="stage-caption">{stage.patientText}</p>
          <span className="stage-visual-note">{stage.visualLabel}</span>
          <input
            className="timeline-scrubber"
            aria-label="Scenario stage position"
            aria-valuetext={`${stage.title}, stage ${evaluated!.index + 1} of ${track.stages.length}`}
            type="range"
            min={0}
            max={track.stages.length - 1}
            step={0.01}
            value={position}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <div className="stage-markers">
            {track.stages.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Go to ${s.title}`}
                aria-current={stage.id === s.id ? "step" : undefined}
                onClick={() => seek(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="player-controls">
            <button aria-label="Replay" onClick={() => seek(0)}>
              <RotateCcw size={17} />
            </button>
            <button
              aria-label="Previous stage"
              disabled={position === 0}
              onClick={() => seek(Math.max(0, Math.ceil(position) - 1))}
            >
              <SkipBack size={18} />
            </button>
            <button
              className="clinical-primary"
              aria-label={playing ? "Pause scenario" : "Play scenario"}
              disabled={track.stages.length < 2}
              onClick={() => {
                if (evaluated?.ended) setPosition(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={19} /> : <Play size={19} />}
            </button>
            <button
              aria-label="Next stage"
              disabled={evaluated?.ended}
              onClick={() => seek(Math.min(track.stages.length - 1, Math.floor(position) + 1))}
            >
              <SkipForward size={18} />
            </button>
            <Selector
              label="Playback speed"
              value={String(speed)}
              onChange={(v) => setSpeed(Number(v))}
              options={[
                { id: "0.5", label: "0.5×" },
                { id: "1", label: "1×" },
                { id: "2", label: "2×" },
              ]}
            />

            <button onClick={() => callbacks.current.onStage(stage, true)}>Frame anatomy</button>
            <button aria-pressed={followCamera} onClick={() => setFollowCamera((v) => !v)}>
              Follow guided view
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
