import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Droplets,
  Expand,
  Flashlight,
  PanelLeft,
  X,
  Check,
  Move3D,
  Hand,
  Minus,
  Plus,
  Focus,
  Layers,
  Bone,
  Network,
  ScanLine,
} from "lucide-react";
import AnatomyPreview from "./AnatomyPreview";
import AnatomyScene from "../scene";
import { DEFAULT_VISIBLE, type Atlas, type SceneState, type RenderMode } from "../anatomy";
import { SYSTEMS, type SystemId } from "../anatomy";
import regionMap from "./regions.json";
import "./minimal.css";
const initial: SceneState = {
  visible: DEFAULT_VISIBLE,
  selected: [],
  explode: 0,
  isolate: false,
  view: "front",
  rotate: false,
  reset: 0,
  renderMode: "anatomy",
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
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHover = () => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };
  useEffect(() => cancelHover, []);
  const panel = useRef<HTMLElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cursor = useRef({ x: 0.5, y: 0.45, active: false });
  const [help, setHelp] = useState(false);
  const [dockScale, setDockScale] = useState(1);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const torchLabels = {
    skeletal: "Bone torch",
    xray: "X-ray torch",
    venous: "Vein torch",
    arterial: "Artery torch",
  };
  function chooseTorch(mode: NonNullable<SceneState["torch"]>["mode"]) {
    Object.assign(cursor.current, { x: 0.5, y: 0.45, active: true });
    if (lens.current) Object.assign(lens.current.style, { left: "50%", top: "45%", visibility: "visible" });
    setState((s) => ({
      ...s,
      torch:
        s.torch?.mode === mode
          ? undefined
          : { mode, x: 0.5, y: 0.45, radius: s.torch?.radius ?? 110 },
      renderMode: "anatomy",
      selected: [],
      explode: 0,
    }));
  }
  useEffect(() => {
    if (help) helpDialog.current?.showModal();
    else helpDialog.current?.close();
  }, [help]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (e.target instanceof HTMLElement &&
          (e.target.matches("input,textarea,select") || e.target.isContentEditable))
      )
        return;
      if (e.key === "Escape") {
        setHelp(false);
        setOpen(false);
        setState((s) => ({ ...s, selected: [], torch: undefined }));
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelp((h) => !h);
        return;
      }
      if (help) return;
      const k = e.key.toLowerCase();
      if (
        ["+", "=", "-", "0", "f", "b", "v", "h", "1", "2", "3", "4", "[", "]", ",", "."].includes(k)
      )
        e.preventDefault();
      else return;
      if (k === "b") setOpen((o) => !o);
      else if (k === "," || k === ".")
        setDockScale((n) => Math.max(0.85, Math.min(1.2, n + (k === "." ? 0.05 : -0.05))));
      else if (["1", "2", "3", "4"].includes(k))
        chooseTorch((["skeletal", "xray", "venous", "arterial"] as const)[Number(k) - 1]);
      else
        setState((s) => {
          if (k === "v" || k === "h")
            return { ...s, interaction: k === "v" ? "orbit" : "pan" };
          if (k === "[" || k === "]")
            return {
              ...s,
              torch: s.torch
                ? {
                    ...s.torch,
                    radius: Math.max(
                      40,
                      Math.min(240, (s.torch.radius ?? 110) + (k === "]" ? 10 : -10)),
                    ),
                  }
                : undefined,
            };
          return {
            ...s,
            focusParts: k === "f" && s.selected.length ? s.selected : undefined,
            cameraCommand: {
              id: performance.now(),
              type: k === "+" || k === "=" ? "zoom-in" : k === "-" ? "zoom-out" : "frame",
            },
          };
        });
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [help]);
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
    const measure = () => {
      const landscape = window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
      setState((s) => ({
        ...s,
        insets: landscape
          ? { left: 32, right: el.getBoundingClientRect().width + 36, top: 70, bottom: 24 }
          : { left: 32, right: 32, top: 78, bottom: el.getBoundingClientRect().height + 48 },
      }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      el.parentElement?.style.setProperty("--drawer-height", `${el.offsetHeight}px`),
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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("Regions");

  const [regions, setRegions] = useState<string[]>([]);
  const [systems, setSystems] = useState<SystemId[]>([]);
  const regionIds = useMemo(
    () =>
      regions.length
        ? atlas?.parts
            .filter((p) => regions.includes((regionMap as Record<string, string>)[p.id]))
            .map((p) => p.id)
        : undefined,
    [regions, atlas],
  );
  const sceneState = useMemo(
    () => ({
      ...state,
      regionParts: regionIds,
      visible: systems.length ? systems : state.visible,
      annotations: state.selected.map((partId) => ({
        partId,
        label: atlas?.parts.find((p) => p.id === partId)?.name ?? "",
        pinned: true,
      })),
    }),
    [state, regionIds, systems, atlas],
  );
  function toggleItem(id: string) {
    if (window.innerWidth <= 600) setOpen(false);
    const flip = <T extends string>(list: T[], item: T) =>
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
    if (tab === "Regions") setRegions((r) => flip(r, id));
    else setSystems((s) => flip(s, id as SystemId));
    update({
      selected: [],
      focusParts: undefined,
      reset: state.reset + 1,
      renderMode: tab === "Systems" ? "anatomy" : state.renderMode,
    });
  }
  const choices =
    tab === "Regions"
      ? Object.entries({
          head: "Head",
          torso: "Torso",
          "left-arm": "Left arm",
          "right-arm": "Right arm",
          "left-leg": "Left leg",
          "right-leg": "Right leg",
        })
      : SYSTEMS.map((s) => [s.id, s.name]);
  function previewButton([id, label]: string[]) {
    const active = regions.includes(id) || systems.includes(id as SystemId);
    return (
      <button
        key={id}
        aria-label={label}
        aria-pressed={active}
        onClick={() => toggleItem(id)}
      >
        {atlas && (
          <AnatomyPreview
            atlas={atlas}
            parts={atlas.parts.filter((p) =>
              tab === "Regions"
                ? (regionMap as Record<string, string>)[p.id] === id &&
                  ((id === "head" || id === "torso") ? p.system === "skeletal" : (systems.length ? systems : state.visible).includes(p.system)) &&
                  (state.renderMode !== "skeleton" || p.system === "skeletal")
                : p.system === id && (!regionIds || regionIds.includes(p.id)),
            )}
            spinning={id === "cardiac"}
            label={label}
          />
        )}
        <span>{label}</span>
        {active && <Check size={15} />}
      </button>
    );
  }
  return (
    <main
      className="minimal-explorer"
      data-theme="dark"
      data-torch={!!state.torch}
      aria-label="TheHumanBody anatomy explorer"
      onPointerDownCapture={e => setDragging(!!state.torch && !!(e.target as Element).closest(".scene"))}
      onPointerUpCapture={() => setDragging(false)}
      onPointerCancelCapture={() => setDragging(false)}
      onLostPointerCapture={() => setDragging(false)}
      onPointerMove={(e) => {
        const overScene = !!(e.target as HTMLElement).closest(".scene");
        const r = e.currentTarget.getBoundingClientRect();
        cursor.current.x = (e.clientX - r.left) / r.width;
        cursor.current.y = (e.clientY - r.top) / r.height;
        setDragging(!!state.torch && overScene && e.buttons !== 0);
        cursor.current.active = overScene;
        if (lens.current) {
          lens.current.style.left = `${cursor.current.x * 100}%`;
          lens.current.style.top = `${cursor.current.y * 100}%`;
          lens.current.style.visibility = overScene ? "visible" : "hidden";
        }
      }}
      onPointerLeave={() => {
        cursor.current.active = false;
        if (lens.current) lens.current.style.visibility = "hidden";
      }}
    >
      {atlas && (
        <AnatomyScene
          key={attempt}
          atlas={atlas}
          state={sceneState}
          onSelect={(id) =>
            setState((s) => ({ ...s, selected: s.selected.includes(id) ? [] : [id] }))
          }
          onFocus={(id) =>
            update({
              selected: [id],
              focusParts: [id],
              cameraCommand: { id: performance.now(), type: "frame" },
            })
          }
          torchCursor={cursor.current}
          onProgress={setProgress}
          onError={setError}
          onZoom={setZoom}
        />
      )}
      <header className="brand">
        {atlas && (
          <AnatomyPreview
            atlas={atlas}
            parts={atlas.parts.filter(
              (p) =>
                p.system === "skeletal" &&
                (regionMap as Record<string, string>)[p.id] === "head" &&
                !/vertebra|atlas|axis|hyoid|disk/i.test(p.name),
            )}
            spinning
            speed={4.5}
            label="Rotating skull"
          />
        )}
        TheHumanBody
      </header>
      <aside
        className="browse"
        data-open={open}
        data-tab={tab}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" && !open) {
            cancelHover();
            hoverTimer.current = setTimeout(() => {
              hoverTimer.current = null;
              setOpen(true);
            }, 2000);
          }
        }}
        onPointerLeave={cancelHover}
      >
        <button
          className="browse-handle"
          aria-label="Browse anatomy"
          aria-expanded={open}
          onClick={() => {
            cancelHover();
            setOpen(!open);
          }}
        >
          {open ? <X size={17} /> : <PanelLeft size={17} />}
        </button>
        {
          <section
            ref={panel}
            inert={!open}
            aria-hidden={!open}
            className="browse-panel"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                document.querySelector<HTMLButtonElement>(".browse-handle")?.focus();
              }
            }}
          >
            <h2>Browse anatomy<button className="sheet-close" aria-label="Close anatomy browser" onClick={() => setOpen(false)}><X size={18} /></button></h2>
            <div className="browse-tabs">
              {["Regions", "Systems"].map((t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => {
                    setTab(t);
                    if (t === "Systems") setRegions([]);
                    else setSystems([]);
                    update({ selected: [], focusParts: undefined, reset: state.reset + 1 });
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="preview-grid" key={tab}>
              {tab === "Regions" ? <>
                {choices.slice(0, 2).map(previewButton)}
                <div className="limb-pair" role="group" aria-label="Arms">{choices.slice(2, 4).map(previewButton)}</div>
                <div className="limb-pair" role="group" aria-label="Legs">{choices.slice(4).map(previewButton)}</div>
              </> : choices.map(previewButton)}
              <button
                className="whole-body"
                onClick={() => {
                  setRegions([]);
                  setSystems([]);
                  update({ selected: [], focusParts: undefined, reset: state.reset + 1, renderMode: "anatomy" });
                }}
              >
                {atlas && (
                  <AnatomyPreview
                    atlas={atlas}
                    parts={atlas.parts.filter((p) => DEFAULT_VISIBLE.includes(p.system))}
                    label="Whole body"
                  />
                )}
                <span>Show whole body</span>
              </button>
            </div>
          </section>
        }
      </aside>
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
      {state.torch && (
        <div
          ref={lens}
          className="torch-lens"
          data-dragging={dragging}
          aria-hidden="true"
          style={{
            left: `${cursor.current.x * 100}%`,
            top: `${cursor.current.y * 100}%`,
            width: `min(${(state.torch.radius ?? 110) * 2}px,70vw)`,
            height: `min(${(state.torch.radius ?? 110) * 2}px,70vw)`,
            visibility: cursor.current.active ? "visible" : "hidden",
          }}
        >
          <span>{torchLabels[state.torch.mode]}</span>
        </div>
      )}
      <dialog
        ref={helpDialog}
        className="shortcuts-dialog"
        onCancel={() => setHelp(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setHelp(false);
        }}
        aria-labelledby="shortcuts-title"
      >
        <div className="shortcuts-content">
          <button
            className="close-help"
            aria-label="Close shortcuts"
            onClick={() => setHelp(false)}
          >
            <X size={20} />
          </button>
          <h2 id="shortcuts-title">Explore your way</h2>
          <p>
            Click a structure to highlight it. Click again to deselect. Double-click or double-tap
            to frame it.
          </p>
          <dl>
            {[
              ["Drag / two fingers", "Orbit / pan"],
              ["Arrow keys (canvas)", "Rotate the view"],
              ["Scroll / pinch", "Zoom"],
              ["+ / −", "Zoom in / out"],
              ["F / 0", "Frame selected / fit visible anatomy"],
              ["V / H", "Orbit / pan tool"],
              ["B", "Open / close anatomy drawer"],
              ["1 / 2 / 3 / 4", "Bone / X-ray / vein / artery torch"],
              ["[ / ]", "Smaller / larger torch"],
              [", / .", "Smaller / larger dock"],
              ["Esc", "Clear selection, torch and panels"],
              ["?", "Show keyboard shortcuts"],
            ].map(([keys, action]) => (
              <div key={keys}>
                <dt>{keys}</dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
          <p>
            Drag with the torch active to orbit or pan. Release to inspect at your chosen radius.
          </p>
        </div>
      </dialog>
      <div className="minimal-dock-position" ref={dock}>
        <div
          data-expanded={toolsOpen}
          className="minimal-dock"
          style={{ zoom: dockScale }}
          role="toolbar"
          aria-label="Anatomy tools"
        >
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
                onClick={() => update({ renderMode: id, torch: undefined, selected: [] })}
              >
                <Icon size={19} />
                <span className="mode-label">
                  <span>{label}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="tool-group torch-group" role="group" aria-label="Anatomy torch">
            {(
              [
                ["skeletal", "Bone torch"],
                ["xray", "X-ray torch"],
                ["arterial", "Artery torch"],
                ["venous", "Vein torch"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                aria-label={label}
                title={label}
                aria-pressed={state.torch?.mode === mode}
                onClick={() => chooseTorch(mode)}
              >
                <span className="torch-beam" aria-hidden="true" />
                <span className="torch-label">{label.replace(" torch", "")}</span>
              </button>
            ))}
          </div>
          <div
            className="tool-group adjustment-group"
            role="group"
            aria-label="Anatomy adjustments"
          >
            <label
              className="explode-control"
              title={state.torch ? "Torch size" : "Explode anatomy"}
            >
              {state.torch ? <Flashlight size={19} aria-hidden="true" /> : <Expand size={19} aria-hidden="true" />}
              <input
                aria-label={state.torch ? "Torch size" : "Explode anatomy"}
                aria-valuetext={
                  state.torch
                    ? `${state.torch.radius ?? 110} pixels`
                    : `${Math.round(state.explode * 100)} percent`
                }
                type="range"
                min={state.torch ? 40 : 0}
                max={state.torch ? 240 : 1}
                step={state.torch ? 5 : 0.01}
                value={state.torch ? (state.torch.radius ?? 110) : state.explode}
                onChange={(e) =>
                  update(
                    state.torch
                      ? { torch: { ...state.torch, radius: Number(e.target.value) } }
                      : { explode: Number(e.target.value) },
                  )
                }
              />
              <output aria-label={state.torch ? "Torch radius" : "Explosion percentage"}>
                {state.torch
                  ? `${state.torch.radius ?? 110}`
                  : `${Math.round(state.explode * 100)}%`}
              </output>
            </label>
          </div>
          <button className="mobile-action browse-action" aria-expanded={open} onClick={() => setOpen(!open)}>Browse</button>
          <button className="mobile-action tools-action" aria-expanded={toolsOpen} onClick={() => setToolsOpen(!toolsOpen)}>Tools</button>
          <button
            className="shortcut-help"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={() => setHelp(true)}
          >
            <Keyboard size={20} />
          </button>
        </div>
      </div>
    </main>
  );
}
