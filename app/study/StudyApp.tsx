import { getScenarios } from "../clinical/catalogue";
import {
  dentalParts,
  readPreference,
  writePreference,
  type Destination,
  type Role,
} from "../workspace/navigation";
import { readSession, saveSession } from "../workspace/session";
import Selector from "../workspace/Selector";
import GuidedTour from "../workspace/GuidedTour";
import LibraryPanel from "../workspace/LibraryPanel";
import StudyStep from "../workspace/StudyStep";
import WorkspaceHeader from "../workspace/WorkspaceHeader";
import { useStageLayout } from "../workspace/useStageLayout";
import "../workspace/workspace.css";
import "../workspace/shell.css";
import LoadingAnatomy from "../clinical/LoadingAnatomy";
import ClinicalWorkspace from "../clinical/ClinicalWorkspace";
import type { Stage, Scenario } from "../clinical/types";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Compass,
  GraduationCap,
  History,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  RotateCcw,
  Eye,
  EyeOff,
  Focus,
  Layers,
} from "lucide-react";
import ExplorePanel from "../viewer/ExplorePanel";
import ViewerDock from "../viewer/ViewerDock";
import Inspector from "../viewer/Inspector";
import AnatomyScene from "../scene";
import { DEFAULT_VISIBLE, type Atlas, type SceneState, type Concept } from "../anatomy";
import { content } from "./content";
import presets from "./content/scene-presets.json";
import {
  REGIONS,
  type Editorial,
  type ClinicalCondition,
  type Progress,
  type Question,
  type RegionId,
  type Side,
  type StructureCard,
} from "./types";
import {
  availableContent,
  emptyProgress,
  grade,
  partIds,
  recordAnswer,
  validateProgress,
} from "./learning";
import { loadProgress, saveProgress } from "./storage";
import NerveMap from "./NerveMap";

type Mode = "explore" | "learn" | "practice" | "review";
const baseScene: SceneState = {
  explode: 0,
  visible: DEFAULT_VISIBLE,
  selected: [],
  isolate: false,
  view: "three-quarter",
  rotate: false,
  reset: 0,
  study: true,
  renderMode: "skeleton",
  contextOpacity: 1,
  solidContext: true,
  interaction: "orbit",
};
function Sources({ item }: { item: Editorial }) {
  return (
    <details className="sources">
      <summary>Sources & editorial status</summary>
      <p>
        {item.status === "approved"
          ? `Reviewed by ${item.reviewer} · ${item.reviewedAt}`
          : "Draft · medical review pending"}{" "}
        · v{item.version}
      </p>
      {item.references.map((r, i) => (
        <a key={r} href={r} target="_blank" rel="noreferrer">
          Reference {i + 1} ↗
        </a>
      ))}
    </details>
  );
}
export default function StudyApp() {
  const [mode, setMode] = useState<Mode>("explore"),
    [preview] = useState(() => import.meta.env.DEV && window.location.pathname === "/editorial"),
    [region, setRegion] = useState<RegionId>("shoulder"),
    [side, setSide] = useState<Side>("right");
  const [atlas, setAtlas] = useState<Atlas | null>(null),
    [atlasError, setAtlasError] = useState(""),
    [sceneError, setSceneError] = useState(""),
    [loading, setLoading] = useState(0),
    [scene, setScene] = useState(baseScene);
  const [progress, setProgress] = useState<Progress>(emptyProgress),
    [storageReady, setStorageReady] = useState(false),
    [storageError, setStorageError] = useState(""),
    [notice, setNotice] = useState("");
  const [cardId, setCardId] = useState<string | null>(null),
    [lessonId, setLessonId] = useState<string | null>(null),
    [nerveId, setNerveId] = useState<string | null>(null),
    [filter, setFilter] = useState("");
  const [queue, setQueue] = useState<string[]>([]),
    [qIndex, setQIndex] = useState(0),
    [answer, setAnswer] = useState(""),
    [result, setResult] = useState<boolean | null>(null),
    [caseId, setCaseId] = useState<string | null>(null),
    [finished, setFinished] = useState(false);
  const workspaceRoot = useRef<HTMLDivElement>(null);
  const measuredLayout = useStageLayout(workspaceRoot);
  const [destination, setDestination] = useState<Destination>("explore");
  const [role, setRole] = useState<Role>(() => {
    const saved = readPreference("lhb-role", "explorer");
    return saved === "student" || saved === "doctor" ? saved : "explorer";
  });
  const [domain, setDomain] = useState<"medical" | "dental">(() =>
    readPreference("atlas-domain", "medical") === "dental" ? "dental" : "medical",
  );
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInvite, setTourInvite] = useState(
    () => readPreference("lhb-tour-seen", "no") !== "yes",
  );
  const tourSnapshot = useRef<{ scene: SceneState; left: boolean; right: boolean } | null>(null);
  function startTour() {
    tourSnapshot.current = { scene, left: leftOpen, right: rightOpen };
    setTourOpen(true);
    setTourInvite(false);
  }
  function endTour() {
    if (tourSnapshot.current) {
      setScene(tourSnapshot.current.scene);
      setLeftOpen(tourSnapshot.current.left);
      setRightOpen(tourSnapshot.current.right);
    }
    tourSnapshot.current = null;
    setTourOpen(false);
    writePreference("lhb-tour-seen", "yes");
  }
  function chooseRole(next: Role) {
    setRole(next);
    writePreference("lhb-role", next);
  }
  function navigate(next: Destination) {
    setDestination(next);
    setPresenting(false);
    setRightOpen(false);
    setLeftOpen(true);
    setMobileExpanded(true);
    if (next === "explain") {
      if (!clinicalOpen) clinicalRestore.current = scene;
      setClinicalOpen(true);
      setMode("explore");
    } else {
      closeClinical();
      changeMode(next === "library" ? "review" : next);
    }
  }
  function chooseDomain(next: "medical" | "dental") {
    if (next === domain) return;
    setDomain(next);
    writePreference("atlas-domain", next);
    setPresenting(false);
    setClinicalOpen(false);
    clinicalRestore.current = null;
    setMode("explore");
    setDestination("explore");
    setLessonId(null);
    setQueue([]);
    setCaseId(null);
    setCardId(null);
    setConditionId(null);
    setNerveId(null);
    setPinned(false);
    setRightOpen(false);
    setLeftOpen(true);
    setReviewScenario(null);
    scenarioRestore.current = null;
    setScene((s) => ({
      ...baseScene,
      reset: s.reset + 1,
      ...(next === "dental"
        ? {
            regionParts: atlas ? dentalParts(atlas) : [],
            focusParts: atlas ? dentalParts(atlas) : [],
          }
        : {}),
    }));
  }
  // Only initial catalogue arrival frames the persisted domain. Navigation never implies a region.
  useEffect(() => {
    if (atlas && domain === "dental") {
      const ids = dentalParts(atlas);
      setScene((s) => ({ ...baseScene, regionParts: ids, focusParts: ids, reset: s.reset + 1 }));
    }
  }, [atlas]);
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);
  const [cameraInteraction, setCameraInteraction] = useState(0);
  const [skip3D, setSkip3D] = useState(false);
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const [clinicalOpen, setClinicalOpen] = useState(false);
  const [reviewScenario, setReviewScenario] = useState<{
    id: string;
    request: number;
    questionId?: string;
    overview?: boolean;
    resume?: boolean;
  } | null>(null);
  const savedScenario = (() => {
    try {
      const saved = JSON.parse(
        readPreference(`lhb-scenario:${preview ? "editorial:" : ""}${domain}`, "null"),
      );
      return saved?.version === 1 &&
        getScenarios(preview).some((s) => s.id === saved.id && s.domain === domain)
        ? saved
        : null;
    } catch {
      return null;
    }
  })();
  const [presenting, setPresenting] = useState(false);
  const clinicalRestore = useRef<SceneState | null>(null);
  function clinicalStage(stage: Stage, focus: boolean) {
    if (!atlas) return;
    const ids = stage.conceptIds.flatMap(
      (id) => atlas.concepts.find((c) => c.id === id)?.elements ?? [],
    );
    setScene((s) => ({
      ...s,
      renderMode: "anatomy",
      selected: ids,
      regionParts: ids,
      hidden: [],
      isolate: false,
      explode: 0,
      labelsVisible: true,
      ...(focus ? { focusParts: ids, reset: s.reset + 1 } : {}),
    }));
  }
  function recordScenario(s: Scenario, q: Scenario["questions"][number], answer: string) {
    const question: Question = {
      ...s,
      id: `scenario:${s.id}:${q.id}`,
      region: "hand",
      kind: "clinical",
      prompt: q.prompt,
      cardId: "",
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
    };
    setProgress((p) => recordAnswer(p, question, answer, answer === q.answer, preview));
  }
  function closeClinical() {
    setClinicalOpen(false);
    setPresenting(false);
    if (clinicalRestore.current) setScene(clinicalRestore.current);
    clinicalRestore.current = null;
  }
  const [leftOpen, setLeftOpen] = useState(true),
    [rightOpen, setRightOpen] = useState(false),
    [mobileExpanded, setMobileExpanded] = useState(false),
    [conditionId, setConditionId] = useState<string | null>(null),
    [pinned, setPinned] = useState(false);
  const scenarioRestore = useRef<SceneState | null>(null);
  const [size, setSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });
  useEffect(() => {
    const resize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const storageWritable = useRef(false);
  const importer = useRef<HTMLInputElement>(null);
  const saveChain = useRef(Promise.resolve());
  const library = useMemo(() => availableContent(content, preview), [preview]);
  const condition = library.conditions.find((c) => c.id === conditionId);
  const cards = library.cards.filter((c) => c.region === region);
  const card = library.cards.find((c) => c.id === cardId);
  const lesson = library.lessons.find((l) => l.id === lessonId);
  const keyPrefix = preview ? "preview:" : "";
  const stepIndex = lesson
    ? Math.min(progress.lessonSteps[keyPrefix + lesson.id] ?? 0, lesson.steps.length - 1)
    : 0;
  const step = lesson?.steps[stepIndex];
  const question = library.questions.find((q) => q.id === queue[qIndex]);
  const questionCard = library.cards.find((c) => c.id === question?.cardId);
  const activeCase = library.cases.find((c) => c.id === caseId);
  const testing = mode === "practice" && !!question && !finished;
  const concealed = testing && result === null;
  const due = library.questions.filter(
    (q) =>
      progress.reviews[keyPrefix + q.id] &&
      Date.parse(progress.reviews[keyPrefix + q.id].due) <= Date.now(),
  );
  useEffect(() => {
    workspaceRoot.current?.querySelector(".learning-panel")?.scrollTo({ top: 0 });
  }, [mode, lessonId, stepIndex, region]);
  const [savedSession, setSavedSession] = useState(() => readSession(domain, preview));
  useEffect(() => {
    setSavedSession(readSession(domain, preview));
  }, [domain, preview]);
  useEffect(() => {
    if (
      tourOpen ||
      domain !== "medical" ||
      (mode !== "learn" && mode !== "practice") ||
      (!lesson && !queue.length)
    )
      return;
    const snapshot = {
      version: 1 as const,
      domain,
      mode,
      lessonId,
      queue,
      qIndex,
      answer,
      result,
      finished,
      caseId,
      region,
      side,
      scene,
      title: lesson?.title ?? "Practice session",
    };
    saveSession(snapshot, preview);
    setSavedSession(snapshot);
  }, [
    domain,
    mode,
    lessonId,
    queue,
    qIndex,
    answer,
    result,
    finished,
    caseId,
    region,
    side,
    scene,
    preview,
    tourOpen,
  ]);
  function continueSession() {
    const saved = readSession(domain, preview);
    if (!saved) return;
    if (
      (saved.lessonId && !library.lessons.some((l) => l.id === saved.lessonId)) ||
      saved.queue.some((id) => !library.questions.some((q) => q.id === id))
    ) {
      setNotice("This session's content is no longer available in the published library.");
      return;
    }
    closeClinical();
    setDestination("learn");
    setMode(saved.mode);
    setLessonId(saved.lessonId);
    setQueue(saved.queue);
    setQIndex(saved.qIndex);
    setAnswer(saved.answer);
    setResult(saved.result);
    setFinished(saved.finished);
    setCaseId(saved.caseId);
    setRegion(saved.region);
    setSide(saved.side);
    setScene((s) => ({ ...saved.scene, reset: s.reset + 1 }));
    setMobileExpanded(true);
    setLeftOpen(true);
    setRightOpen(false);
  }
  const regionIds = useMemo(
    () =>
      atlas
        ? [
            ...new Set(
              presets[region][side].flatMap(
                (id) => atlas.concepts.find((c) => c.id === id)?.elements ?? [],
              ),
            ),
          ]
        : [],
    [atlas, region, side],
  );
  useEffect(() => {
    const abort = new AbortController();
    fetch("/models/atlas.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("The anatomy catalogue could not be loaded.");
        return r.json();
      })
      .then((data) => setAtlas(data as Atlas))
      .catch((e) => {
        if (e.name !== "AbortError") setAtlasError(e.message);
      });
    return () => abort.abort();
  }, [catalogueAttempt]);
  useEffect(() => {
    let live = true;
    loadProgress()
      .then((p) => {
        if (live) {
          storageWritable.current = true;
          setProgress(p);
        }
      })
      .catch(() => {
        if (live)
          setStorageError(
            "Progress storage is unavailable. This session still works; export a backup before leaving.",
          );
      })
      .finally(() => {
        if (live) setStorageReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!storageReady || !storageWritable.current) return;
    saveChain.current = saveChain.current
      .then(() => saveProgress(progress))
      .catch(() =>
        setStorageError("Your latest progress could not be saved. Export a backup before leaving."),
      );
  }, [progress, storageReady]);
  useEffect(() => {
    if (domain !== "medical" || !scene.regionParts) return;
    setScene((s) => ({
      ...s,
      renderMode: "anatomy",
      regionParts: regionIds,
      focusParts: regionIds,
      selected: [],
      hidden: [],
      isolate: false,
      reset: s.reset + 1,
    }));
  }, [regionIds]);
  useEffect(() => {
    if (domain === "medical" && cardId && atlas) {
      const c = library.cards.find((c) => c.id === cardId);
      if (c) {
        const ids = partIds(c, atlas, side);
        setScene((s) => ({
          ...s,
          regionParts: [...new Set([...regionIds, ...ids])],
          selected: ids,
          focusParts: ids,
          hidden: [],
          reset: s.reset + 1,
        }));
      }
    }
  }, [regionIds]);
  function updateScene(change: Partial<SceneState>) {
    setScene((s) => ({ ...s, ...change }));
  }
  function fullBody() {
    setConditionId(null);
    scenarioRestore.current = null;
    setCardId(null);
    setPinned(false);
    setScene((s) => ({
      ...baseScene,
      renderMode: s.renderMode,
      view: s.view,
      reset: s.reset + 1,
      ...(domain === "dental"
        ? {
            regionParts: atlas ? dentalParts(atlas) : [],
            focusParts: atlas ? dentalParts(atlas) : [],
          }
        : {}),
    }));
  }
  function selectConcept(c: Concept) {
    setCardId(null);
    setPinned(false);
    setScene((s) => ({
      ...s,
      renderMode: "anatomy",
      regionParts: undefined,
      selected: c.elements,
      focusParts: c.elements,
      hidden: [],
      isolate: false,
      reset: s.reset + 1,
    }));
  }
  function regionFocus(r: RegionId) {
    setRegion(r);
    setCardId(null);
    setConditionId(null);
    scenarioRestore.current = null;
    if (!atlas) return;
    const ids = presets[r][side].flatMap(
      (id) => atlas.concepts.find((c) => c.id === id)?.elements ?? [],
    );
    setScene((s) => ({
      ...s,
      renderMode: "anatomy",
      regionParts: ids,
      focusParts: ids,
      hidden: [],
      selected: [],
      isolate: false,
      explode: 0,
      reset: s.reset + 1,
    }));
  }
  function openCondition(c: ClinicalCondition) {
    if (!atlas) return;
    if (!scenarioRestore.current) scenarioRestore.current = scene;
    setConditionId(c.id);
    const ids = c.cardIds.flatMap((id) => {
      const card = library.cards.find((x) => x.id === id);
      return card ? partIds(card, atlas, side) : [];
    });
    const context = presets[c.region][side].flatMap(
      (id) => atlas.concepts.find((x) => x.id === id)?.elements ?? [],
    );
    setScene((s) => ({
      ...s,
      renderMode: "anatomy",
      regionParts: [...new Set([...ids, ...context])],
      selected: ids,
      focusParts: ids,
      hidden: [],
      isolate: false,
      contextOpacity: 0.32,
      explode: 0,
      reset: s.reset + 1,
    }));
  }
  function exitCondition() {
    setConditionId(null);
    const restore = scenarioRestore.current;
    scenarioRestore.current = null;
    if (restore) setScene((s) => ({ ...restore, reset: s.reset + 1 }));
  }
  function focusCards(ids: string[], isolate = false) {
    if (!atlas) return;
    const parts = library.cards
      .filter((c) => ids.includes(c.id))
      .flatMap((c) => partIds(c, atlas, side));
    setScene((s) => ({
      ...s,
      renderMode: "anatomy",
      regionParts: [...new Set([...regionIds, ...parts])],
      selected: parts,
      focusParts: parts,
      hidden: [],
      isolate,
      explode: 0,
      reset: s.reset + 1,
    }));
  }
  function selectCard(c: StructureCard) {
    setCardId(c.id);
    setNerveId(null);
    focusCards([c.id]);
  }
  function changeMode(next: Mode) {
    if (scenarioRestore.current) setScene(scenarioRestore.current);
    setConditionId(null);
    scenarioRestore.current = null;
    setMobileExpanded(true);
    setMode(next);
    setDestination(next === "review" ? "library" : next === "practice" ? "learn" : next);
    setQueue([]);
    setFinished(false);
    setCaseId(null);
    setResult(null);
    setAnswer("");
    setScene((s) => ({ ...s, labelsVisible: true }));
  }
  function changeRegion(next: RegionId) {
    setRegion(next);
    setCardId(null);
    setLessonId(null);
    setNerveId(null);
    setQueue([]);
    setFinished(false);
    setCaseId(null);
    setFilter("");
  }
  function openLesson(id: string) {
    const l = library.lessons.find((x) => x.id === id);
    if (!l) return;
    setMode("learn");
    setDestination("learn");
    setMobileExpanded(true);
    setLessonId(id);
    setCardId(null);
    setNerveId(null);
    const n = Math.min(progress.lessonSteps[keyPrefix + id] ?? 0, l.steps.length - 1);
    focusCards(l.steps[n].cardIds);
  }
  function moveStep(next: number) {
    if (!lesson) return;
    setProgress((p) => ({
      ...p,
      lessonSteps: { ...p.lessonSteps, [keyPrefix + lesson.id]: next },
    }));
    setCardId(null);
    setNerveId(lesson.steps[next].nerveId ?? null);
    focusCards(lesson.steps[next].cardIds);
  }
  function showQuestion(q: Question) {
    setAnswer("");
    setResult(null);
    if (!atlas) return;
    const target = library.cards.find((c) => c.id === q.cardId)!;
    const ids = partIds(target, atlas, side);
    const context = presets[q.region][side].flatMap(
      (id) => atlas.concepts.find((c) => c.id === id)?.elements ?? [],
    );
    setScene((s) => ({
      ...baseScene,
      renderMode: "anatomy",
      reset: s.reset + 1,
      regionParts: context,
      focusParts: q.kind === "select" ? context : ids,
      selected: q.kind === "select" ? [] : ids,
      labelsVisible: false,
    }));
  }
  function startPractice(ids: string[], caseValue: string | null = null) {
    if (!ids.length) return;
    const q = library.questions.find((q) => q.id === ids[0]);
    if (!q) return;
    setMode("practice");
    setDestination("learn");
    setQueue(ids);
    setQIndex(0);
    setFinished(false);
    setCaseId(caseValue);
    setCardId(null);
    setNerveId(null);
    showQuestion(q);
  }
  function submit() {
    if (!question || !questionCard || !answer || result !== null) return;
    if (question.kind === "select" && !atlas) return;
    const correct =
      question.kind === "select"
        ? grade(question, answer, questionCard, atlas!, side)
        : answer === question.answer;
    setResult(correct);
    setProgress((p) => recordAnswer(p, question, answer, correct, preview));
    setScene((s) => ({
      ...s,
      labelsVisible: true,
      selected: atlas ? partIds(questionCard, atlas, side) : [],
    }));
  }
  function nextQuestion() {
    if (qIndex + 1 >= queue.length) {
      setFinished(true);
      if (lesson && step?.kind === "check") {
        setProgress((p) => ({
          ...p,
          completedLessons: [...new Set([...p.completedLessons, keyPrefix + lesson.id])],
        }));
        setNotice("Lesson completed. Missed questions are saved in My Library.");
      }
      setScene((s) => ({ ...s, labelsVisible: true }));
      return;
    }
    setQIndex((i) => i + 1);
    showQuestion(library.questions.find((q) => q.id === queue[qIndex + 1])!);
  }
  function pick(id: string) {
    if (concealed) {
      if (question?.kind === "select") {
        setAnswer(id);
        setScene((s) => ({ ...s, selected: [id] }));
      }
      return;
    }
    setRightOpen(true);
    setLeftOpen(false);
    setMobileExpanded(true);
    const found = library.cards.find((c) => atlas && partIds(c, atlas, side).includes(id));
    if (found) {
      setCardId(found.id);
      setScene((s) => ({ ...s, selected: [id] }));
    } else {
      setCardId(null);
      setScene((s) => ({ ...s, selected: [id] }));
      setRightOpen(true);
    }
  }
  function exportFile() {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "learnhumanbody-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Progress backup exported.");
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Progress files must be smaller than 5 MB.");
      const data = validateProgress(JSON.parse(await file.text()));
      await saveProgress(data);
      storageWritable.current = true;
      setStorageError("");
      setProgress(data);
      setNotice("Progress imported. This replaces the previous local history.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to import progress.");
    } finally {
      if (importer.current) importer.current.value = "";
    }
  }
  const sceneState = useMemo(
    () => ({
      ...scene,
      labelsVisible: !concealed && scene.labelsVisible !== false,
      insets: measuredLayout.insets,
      exclusions: measuredLayout.exclusions,
      annotations: concealed
        ? []
        : condition && atlas
          ? condition.annotations.slice(0, 3).flatMap((a) => {
              const c = library.cards.find((c) => c.id === a.cardId);
              const id = c ? partIds(c, atlas, side)[0] : null;
              return id ? [{ partId: id, label: a.label, clinical: true, pinned: true }] : [];
            })
          : pinned && atlas
            ? scene.selected.slice(0, 1).map((id) => ({
                partId: id,
                label: atlas.parts.find((p) => p.id === id)?.name ?? "",
                pinned: true,
              }))
            : undefined,
    }),
    [
      scene,
      concealed,
      condition,
      atlas,
      library,
      side,
      pinned,
      size.width,
      leftOpen,
      rightOpen,
      clinicalOpen,
      presenting,
      measuredLayout,
    ],
  );
  return (
    <div
      ref={workspaceRoot}
      className={`atlas-app precise-workspace ${domain === "dental" ? "dental-domain" : ""} ${destination === "explore" && !clinicalOpen ? "browse-layout" : "task-layout"} ${mode === "explore" && rightOpen && !clinicalOpen ? "show-inspector" : ""} ${lesson ? "lesson-active" : ""} ${clinicalOpen && mode === "explore" ? "clinical-active" : ""} ${presenting ? "clinical-presenting" : ""} ${mode === "explore" ? "explorer-mode" : ""} ${leftOpen ? "" : "left-closed"} ${rightOpen ? "" : "right-closed"} ${mobileExpanded ? "sheet-expanded" : ""}`}
    >
      <input
        ref={importer}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      <WorkspaceHeader
        destination={destination}
        onNavigate={navigate}
        role={role}
        onRole={chooseRole}
        onTour={startTour}
        domain={domain}
        preview={preview}
        atlas={atlas}
        onScenario={(s) => {
          if (domain !== s.domain) chooseDomain(s.domain);
          navigate("explain");
          setReviewScenario({ id: s.id, overview: true, request: Date.now() });
        }}
        onConcept={(c) => {
          navigate("explore");
          selectConcept(c);
          setRightOpen(true);
          setLeftOpen(false);
        }}
        lessons={domain === "medical" ? library.lessons : []}
        onLesson={(id) => {
          navigate("learn");
          openLesson(id);
        }}
        onReview={() => navigate("library")}
        onAtlas={() => {
          navigate("explore");
          fullBody();
        }}
      />
      {tourOpen && <GuidedTour role={role} onRole={chooseRole} onClose={endTour} />}
      {
        <main className="study-main">
          <div className="study-toolbar" data-layout="context">
            <div className="context-location">
              <Selector
                label="Anatomy domain"
                value={domain}
                options={[
                  { id: "medical", label: "Medical" },
                  { id: "dental", label: "Dental" },
                ]}
                onChange={chooseDomain}
              />
              <span className="context-divider" aria-hidden="true">
                /
              </span>
              <span>
                {domain === "dental"
                  ? "Teeth & jaw"
                  : scene.regionParts
                    ? REGIONS.find((r) => r.id === region)?.title
                    : "Whole body"}
              </span>
              {domain === "medical" && scene.regionParts && !clinicalOpen && (
                <Selector
                  label="Anatomical side"
                  value={side}
                  options={[
                    { id: "right", label: "Right" },
                    { id: "left", label: "Left" },
                  ]}
                  disabled={testing}
                  onChange={setSide}
                />
              )}
            </div>
            <div className="toolbar-actions">
              {preview && (
                <span className="review-status">Development editorial · Unapproved drafts</span>
              )}
              <button
                aria-expanded={leftOpen}
                onClick={() => {
                  setLeftOpen((v) => !v);
                  setRightOpen(false);
                  setMobileExpanded(true);
                }}
              >
                Browse
              </button>
              {scene.selected.length > 0 && (
                <button
                  onClick={() => {
                    setRightOpen((v) => !v);
                    setLeftOpen(false);
                    setMobileExpanded(true);
                  }}
                >
                  Details
                </button>
              )}
              {savedScenario && (destination === "explore" || destination === "explain") && (
                <button
                  onClick={() => {
                    navigate("explain");
                    setReviewScenario({
                      id: savedScenario.id,
                      overview: true,
                      resume: true,
                      request: Date.now(),
                    });
                  }}
                >
                  Continue {savedScenario.title}
                </button>
              )}
              {savedSession && destination === "explore" && (
                <button onClick={continueSession}>Continue {savedSession.title}</button>
              )}
              {destination === "learn" && (
                <button onClick={() => changeMode("practice")}>Practice</button>
              )}
            </div>
          </div>
          {tourInvite && loading >= 100 && (
            <div className="tour-invitation" role="status" data-layout="notice">
              <span>New here? Get to know the body and your tools.</span>
              <button onClick={startTour}>Take a quick tour</button>
              <button
                onClick={() => {
                  setTourInvite(false);
                  writePreference("lhb-tour-seen", "yes");
                }}
              >
                Explore on my own
              </button>
            </div>
          )}
          {storageError && (
            <div className="status-banner" role="alert">
              {storageError}
            </div>
          )}
          {notice && (
            <div className="status-banner" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss message">
                ×
              </button>
            </div>
          )}
          {condition && (
            <div className="teaching-banner">
              <span>TEACHING SCENARIO</span>
              {condition.title}
              <button onClick={exitCondition}>Exit scenario ×</button>
            </div>
          )}
          <div className="panel-toggles">
            <button
              aria-expanded={leftOpen}
              aria-label="Toggle navigation panel"
              onClick={() => setLeftOpen((v) => !v)}
            >
              ☰ <span>{mode === "explore" ? "Atlas" : "Workspace"}</span>
            </button>
            <button
              aria-expanded={rightOpen}
              aria-label="Toggle information panel"
              onClick={() => setRightOpen((v) => !v)}
            >
              ⓘ <span>Information</span>
            </button>
          </div>
          <div className="study-layout">
            <aside className="learning-panel glass" aria-label="Learning and exploration panel">
              <button
                className="mobile-sheet-handle"
                aria-expanded={mobileExpanded}
                onClick={() => setMobileExpanded((v) => !v)}
              >
                {mobileExpanded ? "Collapse workspace" : "Expand workspace"}{" "}
                <ChevronRight size={14} />
              </button>
              <div
                className="task-panel-body"
                inert={(size.width < 900 || size.height <= 600) && !mobileExpanded}
              >
                {mode === "practice" && lesson && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setMode("learn");
                      setQueue([]);
                      setFinished(false);
                      focusCards(step?.cardIds ?? []);
                    }}
                  >
                    Return to lesson · {lesson.title}
                  </button>
                )}
                {mode === "review" && savedSession && (
                  <button className="study-primary" onClick={continueSession}>
                    Continue {savedSession.title}
                  </button>
                )}
                {domain === "dental" && mode !== "review" ? (
                  <section className="dental-browser">
                    <h2>Teeth & jaw</h2>
                    <p>
                      Explore the modeled teeth, maxilla and mandible. This is reference anatomy;
                      soft tissue and tooth cross-sections are not included.
                    </p>
                    {mode !== "explore" && (
                      <p>
                        Reviewed dental lessons are not yet available. You can explore the reference
                        model or browse published explanations.
                      </p>
                    )}
                    <button
                      onClick={() => {
                        const ids = atlas ? dentalParts(atlas) : [];
                        setScene((s) => ({
                          ...baseScene,
                          regionParts: ids,
                          focusParts: ids,
                          reset: s.reset + 1,
                        }));
                      }}
                    >
                      Fit dental overview
                    </button>
                    {atlas?.concepts
                      .filter((c) => ["FMA12516", "FMA9711", "FMA52748"].includes(c.id))
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            selectConcept(c);
                            setRightOpen(true);
                            setLeftOpen(false);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                  </section>
                ) : mode === "explore" ? (
                  <ExplorePanel
                    atlas={atlas}
                    state={scene}
                    update={updateScene}
                    onSelect={selectConcept}
                    onRegion={regionFocus}
                    onFullBody={fullBody}
                  />
                ) : (
                  <>
                    {mode === "learn" && !lesson && library.lessons.length > 0 && (
                      <section className="study-next">
                        <h2>Your next step</h2>
                        {library.lessons
                          .filter(
                            (l) =>
                              progress.lessonSteps[keyPrefix + l.id] !== undefined &&
                              !progress.completedLessons.includes(keyPrefix + l.id),
                          )
                          .slice(0, 1)
                          .map((l) => (
                            <button
                              key={l.id}
                              className="study-primary"
                              onClick={() => openLesson(l.id)}
                            >
                              Continue {l.title}
                            </button>
                          ))}
                        <button
                          onClick={() =>
                            due.length
                              ? startPractice(due.map((q) => q.id))
                              : changeMode("practice")
                          }
                        >
                          {due.length
                            ? `Review ${due.length} due questions`
                            : "Start a practice session"}{" "}
                          →
                        </button>
                        <p>Or choose a region below.</p>
                      </section>
                    )}
                    {mode !== "review" && !testing && (
                      <div className="region-tabs" aria-label="Study region">
                        {REGIONS.map((r, i) => (
                          <button
                            key={r.id}
                            aria-pressed={region === r.id}
                            onClick={() => changeRegion(r.id)}
                          >
                            <span>0{i + 1}</span>
                            {r.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {!library.cards.length && mode !== "review" ? (
                      <section className="empty-state">
                        <BookOpen size={32} />
                        <h2>Lessons are awaiting medical review.</h2>
                        <p>
                          Guided lessons will appear here after medical sign-off. The reference
                          atlas is available now.
                        </p>

                        <button className="study-primary" onClick={() => changeMode("explore")}>
                          Explore the atlas <ArrowRight size={16} />
                        </button>
                      </section>
                    ) : (
                      <>
                        {mode === "learn" && (
                          <>
                            <div className="region-heading" hidden={!!lesson}>
                              <span className="section-kicker">
                                REGIONAL ANATOMY · {side.toUpperCase()}
                              </span>
                              <h2>{REGIONS.find((r) => r.id === region)?.title}</h2>
                              <p>{REGIONS.find((r) => r.id === region)?.subtitle}</p>
                            </div>
                            {lesson && step ? (
                              <section className="lesson-detail">
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setLessonId(null);
                                    setCardId(null);
                                  }}
                                >
                                  ← All lessons
                                </button>
                                <span className="section-kicker">
                                  GUIDED LESSON · {stepIndex + 1}/{lesson.steps.length}
                                </span>
                                <h3>{lesson.title}</h3>
                                <div className="step-progress">
                                  {lesson.steps.map((_, i) => (
                                    <i key={i} className={i <= stepIndex ? "done" : ""} />
                                  ))}
                                </div>
                                <StudyStep
                                  key={lesson.id + stepIndex}
                                  step={step}
                                  cards={library.cards}
                                  onFocus={() => focusCards(step.cardIds)}
                                  onCard={selectCard}
                                  onCheck={() => startPractice(step.questionIds ?? [])}
                                />
                                <div className="button-row">
                                  <button
                                    disabled={stepIndex === 0}
                                    onClick={() => moveStep(stepIndex - 1)}
                                  >
                                    <ChevronLeft size={16} />
                                    Back
                                  </button>
                                  {stepIndex < lesson.steps.length - 1 ? (
                                    <button
                                      className="study-primary"
                                      onClick={() => moveStep(stepIndex + 1)}
                                    >
                                      Next step
                                      <ChevronRight size={16} />
                                    </button>
                                  ) : (
                                    <button
                                      className="study-primary"
                                      onClick={() => {
                                        startPractice([
                                          ...new Set(
                                            lesson.steps.flatMap((s) => s.questionIds ?? []),
                                          ),
                                        ]);
                                      }}
                                    >
                                      Start lesson check
                                      <Check size={16} />
                                    </button>
                                  )}
                                </div>
                                <Sources item={lesson} />
                              </section>
                            ) : (
                              <div className="lesson-list">
                                {library.lessons
                                  .filter((l) => l.region === region)
                                  .map((l, i) => (
                                    <button
                                      className="lesson-tile"
                                      key={l.id}
                                      onClick={() => openLesson(l.id)}
                                    >
                                      <span className="lesson-number">
                                        {progress.completedLessons.includes(keyPrefix + l.id) ? (
                                          <Check size={20} />
                                        ) : (
                                          String(i + 1).padStart(2, "0")
                                        )}
                                      </span>
                                      <span>
                                        <strong>{l.title}</strong>
                                        <small>
                                          {l.minutes} min · {l.steps.length} steps{" "}
                                          {progress.lessonSteps[keyPrefix + l.id] !== undefined
                                            ? "· Resume"
                                            : ""}
                                        </small>
                                        <span className="module-objective">{l.objectives[0]}</span>
                                        <small>
                                          {l.prerequisites?.length
                                            ? `Before you start: ${l.prerequisites.join(", ")}`
                                            : "No prerequisites"}
                                        </small>
                                      </span>
                                      <ArrowRight size={17} />
                                    </button>
                                  ))}
                              </div>
                            )}
                            <details className="structure-library">
                              <summary>Browse structure cards</summary>
                              <div className="section-heading">
                                <h3>Structure library</h3>
                                <span>{cards.length} cards</span>
                              </div>
                              <label className="sr-only" htmlFor="card-search">
                                Search regional structure cards
                              </label>
                              <input
                                id="card-search"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                placeholder="Find a structure in this region…"
                              />
                              <div className="card-list">
                                {cards
                                  .filter((c) =>
                                    c.title.toLowerCase().includes(filter.toLowerCase()),
                                  )
                                  .map((c) => (
                                    <button
                                      key={c.id}
                                      aria-pressed={cardId === c.id}
                                      onClick={() => selectCard(c)}
                                    >
                                      {c.title}
                                      <ChevronRight size={14} />
                                    </button>
                                  ))}
                              </div>
                            </details>
                            {card && (
                              <section className="structure-card">
                                <div className="section-heading">
                                  <span className="section-kicker">
                                    {side.toUpperCase()} · STRUCTURE CARD
                                  </span>
                                  <button
                                    aria-label={
                                      progress.bookmarks.includes(card.id)
                                        ? "Remove bookmark"
                                        : "Bookmark structure"
                                    }
                                    aria-pressed={progress.bookmarks.includes(card.id)}
                                    onClick={() =>
                                      setProgress((p) => ({
                                        ...p,
                                        bookmarks: p.bookmarks.includes(card.id)
                                          ? p.bookmarks.filter((id) => id !== card.id)
                                          : [...p.bookmarks, card.id],
                                      }))
                                    }
                                  >
                                    <Bookmark
                                      size={18}
                                      fill={
                                        progress.bookmarks.includes(card.id)
                                          ? "currentColor"
                                          : "none"
                                      }
                                    />
                                  </button>
                                </div>
                                <h3>{card.title}</h3>
                                {Object.entries(card.fields).map(([label, text]) => (
                                  <div className="card-field" key={label}>
                                    <h4>{label}</h4>
                                    <p>{text}</p>
                                  </div>
                                ))}
                                <div className="chip-list">
                                  {card.relationships.map((r, i) => (
                                    <button
                                      key={i}
                                      onClick={() => focusCards([card.id, ...r.targetIds])}
                                    >
                                      {r.label} ↗
                                    </button>
                                  ))}
                                </div>
                                <Sources item={card} />
                              </section>
                            )}
                            <details className="nerve-disclosure">
                              <summary>Explore nerve relationships</summary>
                              <NerveMap
                                nerves={library.nerves}
                                active={nerveId}
                                onSelect={(id) => {
                                  const n = library.nerves.find((n) => n.id === id)!;
                                  setNerveId(id);
                                  setCardId(null);
                                  focusCards(n.cardIds);
                                }}
                              />
                              {nerveId && library.nerves.find((n) => n.id === nerveId) && (
                                <Sources item={library.nerves.find((n) => n.id === nerveId)!} />
                              )}
                            </details>
                          </>
                        )}
                        {mode === "practice" &&
                          (testing && question ? (
                            <section className="quiz">
                              <button
                                className="text-button"
                                onClick={() => changeMode("practice")}
                              >
                                ← End session
                              </button>
                              <span className="section-kicker">
                                {activeCase ? "CLINICAL CASE" : "PRACTICE"} · {qIndex + 1} OF{" "}
                                {queue.length}
                              </span>
                              {activeCase && (
                                <div className="case-intro">
                                  <h3>{activeCase.title}</h3>
                                  <p>{activeCase.presentation}</p>
                                </div>
                              )}
                              <h2>{question.prompt}</h2>
                              <p className="quiz-instruction">
                                {question.kind === "select"
                                  ? "Select a structure in the 3D scene, then check your answer."
                                  : question.kind === "identify"
                                    ? "Identify the highlighted structure."
                                    : "Choose the best anatomical explanation."}
                              </p>
                              {question.kind === "select" ? (
                                <div className="selection-status">
                                  {answer
                                    ? "A structure is selected."
                                    : "No structure selected yet."}
                                </div>
                              ) : (
                                <div className="answer-options">
                                  {question.options.map((o, i) => (
                                    <button
                                      disabled={result !== null}
                                      aria-pressed={answer === o}
                                      key={o}
                                      onClick={() => setAnswer(o)}
                                    >
                                      <span>{String.fromCharCode(65 + i)}</span>
                                      {o}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {question.kind !== "clinical" && (sceneError || atlasError) && (
                                <p role="alert">
                                  3D questions are unavailable because the viewer could not load.
                                  Clinical questions and reading remain available.
                                </p>
                              )}
                              {result === null ? (
                                <button
                                  className="study-primary"
                                  disabled={
                                    !answer ||
                                    !storageReady ||
                                    (question.kind !== "clinical" &&
                                      (skip3D || !!sceneError || !!atlasError || loading < 100))
                                  }
                                  onClick={submit}
                                >
                                  Check answer
                                  <ArrowRight size={16} />
                                </button>
                              ) : (
                                <div
                                  className={`answer-feedback ${result ? "correct" : "incorrect"}`}
                                  role="status"
                                >
                                  <strong>{result ? "Correct." : "Let’s review this."}</strong>
                                  <p>
                                    Answer:{" "}
                                    {question.kind === "select"
                                      ? questionCard?.title
                                      : question.answer}
                                  </p>
                                  <p>{question.explanation}</p>
                                  <button onClick={() => focusCards([question.cardId])}>
                                    Show me why
                                  </button>
                                  <Sources item={question} />
                                  <button className="study-primary" onClick={nextQuestion}>
                                    {qIndex + 1 < queue.length ? "Next question" : "Finish session"}
                                    <ArrowRight size={16} />
                                  </button>
                                </div>
                              )}
                            </section>
                          ) : finished ? (
                            <section className="empty-state">
                              <Check size={36} />
                              <h2>Session complete.</h2>
                              <p>
                                Your answers are saved to your {preview ? "preview " : ""}review
                                history. Missed questions return tomorrow.
                              </p>
                              <button
                                className="study-primary"
                                onClick={() => changeMode("review")}
                              >
                                Open My Library
                                <ArrowRight size={16} />
                              </button>
                              <button
                                className="study-secondary"
                                onClick={() => {
                                  setFinished(false);
                                  setQueue([]);
                                }}
                              >
                                Choose another session
                              </button>
                            </section>
                          ) : (
                            <section className="practice-home">
                              <span className="section-kicker">ACTIVE RECALL</span>
                              <h2>
                                Practice {REGIONS.find((r) => r.id === region)?.title.toLowerCase()}
                              </h2>
                              <p>
                                Identify structures, connect relationships, and explain clinical
                                findings.
                              </p>
                              <button
                                className="study-primary"
                                disabled={!storageReady}
                                onClick={() =>
                                  startPractice(
                                    library.questions
                                      .filter(
                                        (q) =>
                                          q.region === region &&
                                          ((!sceneError && !atlasError) || q.kind === "clinical"),
                                      )
                                      .map((q) => q.id),
                                  )
                                }
                              >
                                Start regional practice
                                <ArrowRight size={16} />
                              </button>
                              <h3>Clinical cases</h3>
                              {library.cases
                                .filter((c) => c.region === region)
                                .map((c) => (
                                  <button
                                    className="case-tile"
                                    key={c.id}
                                    disabled={!storageReady}
                                    onClick={() => startPractice(c.questionIds, c.id)}
                                  >
                                    <span>
                                      <strong>{c.title}</strong>
                                      <small>{c.questionIds.length} staged questions</small>
                                    </span>
                                    <ArrowRight size={18} />
                                  </button>
                                ))}
                            </section>
                          ))}
                        {mode === "review" && (
                          <LibraryPanel
                            progress={progress}
                            library={library}
                            atlas={atlas}
                            preview={preview}
                            ready={storageReady}
                            onQuestion={(q) => startPractice([q.id])}
                            onScenario={(s, q) => {
                              if (domain !== s.domain) chooseDomain(s.domain);
                              navigate("explain");
                              setReviewScenario({
                                id: s.id,
                                questionId: q,
                                overview: !q,
                                request: Date.now(),
                              });
                            }}
                            onBookmark={(id) => {
                              navigate("explore");
                              if (id.startsWith("atlas:")) {
                                setScene((s) => ({
                                  ...s,
                                  selected: [id.slice(6)],
                                  focusParts: [id.slice(6)],
                                  regionParts: undefined,
                                  reset: s.reset + 1,
                                }));
                                setRightOpen(true);
                                setLeftOpen(false);
                              } else {
                                const c = library.cards.find((c) => c.id === id);
                                if (c) selectCard(c);
                              }
                            }}
                            onExport={exportFile}
                            onImport={() => importer.current?.click()}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </aside>
            {!concealed && mode === "explore" && !clinicalOpen && rightOpen && (
              <Inspector
                role={role}
                domain={domain}
                saved={
                  scene.selected.length > 0 &&
                  progress.bookmarks.includes(`atlas:${scene.selected[0]}`)
                }
                onSave={() => {
                  const id = `atlas:${scene.selected[0]}`;
                  setProgress((p) => ({
                    ...p,
                    bookmarks: p.bookmarks.includes(id)
                      ? p.bookmarks.filter((x) => x !== id)
                      : [...p.bookmarks, id],
                  }));
                }}
                onContext={() => updateScene({ isolate: false, contextOpacity: 1, hidden: [] })}
                onClose={() => setRightOpen(false)}
                atlas={atlas}
                state={scene}
                library={library}
                card={card}
                side={side}
                preview={preview}
                condition={condition}
                onCase={(id) => {
                  const c = library.cases.find((c) => c.id === id);
                  if (c) {
                    exitCondition();
                    startPractice(c.questionIds, c.id);
                  }
                }}
                onCondition={openCondition}
                onExit={exitCondition}
                onStudy={() => changeMode("learn")}
                onFocus={() => updateScene({ focusParts: scene.selected, reset: scene.reset + 1 })}
                onPin={() => setPinned((v) => !v)}
                pinned={pinned}
              />
            )}
            <section className="study-viewport" aria-label="Anatomy viewer">
              <div className="viewport-heading">
                <span>
                  <i />
                  {domain === "dental"
                    ? "DENTAL REFERENCE ANATOMY"
                    : clinicalOpen
                      ? "SCENARIO REFERENCE ANATOMY"
                      : scene.regionParts
                        ? `${side.toUpperCase()} UPPER LIMB`
                        : "FULL BODY · REFERENCE ANATOMY"}
                </span>
                <span>{concealed ? "IDENTIFICATION MODE" : "3D EXPLORATION"}</span>
              </div>
              {atlas && !skip3D && (
                <AnatomyScene
                  onCameraInteraction={() => setCameraInteraction((n) => n + 1)}
                  key={sceneAttempt}
                  atlas={atlas}
                  state={sceneState}
                  onSelect={pick}
                  onProgress={setLoading}
                  onError={setSceneError}
                />
              )}
              <div className="viewport-caption" hidden>
                <span className="section-kicker">BODY PARTS 3D · ADULT MALE REFERENCE</span>
                <p>
                  {concealed
                    ? "Labels hidden until you submit."
                    : card
                      ? card.title
                      : "Explore the relationships."}
                </p>
              </div>
              <ViewerDock
                state={scene}
                update={updateScene}
                concealed={concealed}
                reset={() => {
                  setConditionId(null);
                  scenarioRestore.current = null;
                  setScene((s) => ({
                    ...s,
                    selected: [],
                    hidden: [],
                    isolate: false,
                    focusParts: s.regionParts,
                    explode: 0,
                    contextOpacity: 1,
                    reset: s.reset + 1,
                  }));
                }}
              />
              {(atlasError || sceneError) && (
                <div className="viewer-message" role="alert">
                  <h3>3D viewer unavailable</h3>
                  <p>{atlasError || sceneError}</p>
                  <p>You can still read lessons and diagrams and answer clinical questions.</p>
                </div>
              )}
              {!skip3D && !atlasError && !sceneError && loading < 100 && (
                <LoadingAnatomy
                  stage={atlas ? "Loading anatomy" : "Loading catalogue"}
                  progress={atlas ? loading : undefined}
                  onCancel={() => setSkip3D(true)}
                />
              )}
              {(skip3D || sceneError || atlasError) && (
                <button
                  className="retry-anatomy"
                  onClick={() => {
                    setSceneError("");
                    if (atlasError) {
                      setAtlasError("");
                      setCatalogueAttempt((n) => n + 1);
                    }
                    setLoading(0);
                    setSkip3D(false);
                    setSceneAttempt((n) => n + 1);
                  }}
                >
                  Load 3D anatomy
                </button>
              )}
              <footer className="viewport-footer">
                {concealed
                  ? "Rotate or zoom to inspect."
                  : "Drag to orbit · Scroll to zoom · Select to inspect"}
                <span>Nerve pathways use linked diagrams; no 3D nerve geometry.</span>
              </footer>
            </section>
            <ClinicalWorkspace
              role={role}
              onBookmark={(id) =>
                setProgress((p) => ({
                  ...p,
                  bookmarks: p.bookmarks.includes(`scenario:${id}`)
                    ? p.bookmarks.filter((x) => x !== `scenario:${id}`)
                    : [...p.bookmarks, `scenario:${id}`],
                }))
              }
              reviewRequest={reviewScenario}
              domain={domain}
              setDomain={chooseDomain}
              cameraInteraction={cameraInteraction}
              lessons={library.lessons}
              onLesson={(id) => {
                closeClinical();
                changeMode("learn");
                openLesson(id);
              }}
              progress={progress}
              onRecord={recordScenario}
              active={clinicalOpen && mode === "explore"}
              preview={preview}
              atlas={atlas}
              onStage={clinicalStage}
              onConcept={selectConcept}
              onPresent={setPresenting}
              onClose={() => navigate("explore")}
              onLearn={() => {
                closeClinical();
                changeMode("learn");
              }}
            />
          </div>
        </main>
      }
    </div>
  );
}
