import { useEffect, useRef, useState } from "react";
import {
  Move3D,
  Hand,
  Minus,
  Plus,
  Focus,
  Layers,
  Bone,
  Network,
  ScanLine,
  UnfoldHorizontal,
} from "lucide-react";
import AnatomyScene from "../scene";
import { DEFAULT_VISIBLE, type Atlas, type SceneState, type RenderMode } from "../anatomy";
import "./minimal.css";
const initial: SceneState = {
  visible: DEFAULT_VISIBLE,
  selected: [],
  explode: 0,
  isolate: false,
  view: "front",
  rotate: false,
  reset: 0,
  renderMode: "skeleton",
  interaction: "orbit",
  contextOpacity: 1,
  solidContext: true,
};
export default function MinimalExplorer() {
  const [atlas, setAtlas] = useState<Atlas | null>(null),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0),
    [attempt, setAttempt] = useState(0),
    [zoom, setZoom] = useState(100),
    [state, setState] = useState(initial);
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/models/atlas.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error("Unable to load anatomy");
        return r.json();
      })
      .then((data) => setAtlas(data as Atlas))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [attempt]);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setState((s) => ({
        ...s,
        insets: { left: 32, right: 32, top: 32, bottom: el.offsetHeight + 48 },
      })),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const update = (v: Partial<SceneState>) => setState((s) => ({ ...s, ...v }));
  const command = (type: "zoom-in" | "zoom-out" | "frame") =>
    update({ focusParts: undefined, cameraCommand: { id: performance.now(), type } });
  const modes: [RenderMode, string, typeof Layers][] = [
    ["anatomy", "Anatomy", Layers],
    ["skeleton", "Skeleton", Bone],
    ["wireframe", "Wireframe", Network],
    ["xray", "X-ray illustration", ScanLine],
  ];
  return (
    <main className="minimal-explorer" aria-label="LearnHumanBody anatomy explorer">
      {atlas && (
        <AnatomyScene
          key={attempt}
          atlas={atlas}
          state={{
            ...state,
            annotations: state.selected.map((partId) => ({
              partId,
              label: atlas.parts.find((p) => p.id === partId)?.name ?? "",
              pinned: true,
            })),
          }}
          onSelect={(id) => update({ selected: [id] })}
          onProgress={setProgress}
          onError={setError}
          onZoom={setZoom}
        />
      )}
      {(error || progress < 100) && (
        <div className="minimal-status" role="status">
          {error || (!atlas ? "Loading catalogue…" : `Loading anatomy · ${Math.round(progress)}%`)}
          {error && (
            <button
              onClick={() => {
                setError("");
                setProgress(0);
                setAttempt((n) => n + 1);
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {state.renderMode === "xray" && (
        <p className="minimal-note">X-ray illustration · not a radiograph</p>
      )}
      <div className="minimal-dock-position" ref={dock}>
        <div className="minimal-dock" role="toolbar" aria-label="Anatomy tools">
          <div className="tool-group" role="group" aria-label="Navigation">
            {(
              [
                ["orbit", "Orbit", Move3D],
                ["pan", "Pan", Hand],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                aria-label={label}
                title={label}
                aria-pressed={state.interaction === id}
                onClick={() => update({ interaction: id })}
              >
                <Icon size={19} />
              </button>
            ))}
          </div>
          <div className="tool-group" role="group" aria-label="Zoom and framing">
            <button title="Zoom out" aria-label="Zoom out" onClick={() => command("zoom-out")}>
              <Minus size={18} />
            </button>
            <output aria-label="Zoom percentage">{zoom}%</output>
            <button title="Zoom in" aria-label="Zoom in" onClick={() => command("zoom-in")}>
              <Plus size={18} />
            </button>
            <button title="Fit anatomy" aria-label="Fit anatomy" onClick={() => command("frame")}>
              <Focus size={19} />
            </button>
          </div>
          <div className="tool-group mode-group" role="group" aria-label="Display mode">
            {modes.map(([id, label, Icon]) => (
              <button
                key={id}
                title={label}
                aria-label={label}
                aria-pressed={state.renderMode === id}
                onClick={() => update({ renderMode: id })}
              >
                <Icon size={19} />
                {state.renderMode === id && <span>{label}</span>}
              </button>
            ))}
          </div>
          <div
            className="tool-group adjustment-group"
            role="group"
            aria-label="Anatomy adjustments"
          >
            <label className="explode-control" title="Explode anatomy">
              <UnfoldHorizontal size={19} aria-hidden="true" />
              <input aria-label="Explode anatomy" aria-valuetext={`${Math.round(state.explode*100)} percent`} type="range" min="0" max="1" step="0.01" value={state.explode} style={{backgroundSize:`${state.explode*100}% 4px`}} onChange={e=>update({explode:Number(e.target.value)})}/>
              <output aria-label="Explosion percentage">{Math.round(state.explode*100)}%</output>
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}
