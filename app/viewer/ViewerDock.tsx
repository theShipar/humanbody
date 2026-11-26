import {
  Focus,
  Plus,
  Minus,
  Hand,
  Move3D,
  Layers,
  Bone,
  Network,
  ScanLine,
  UserRound,
  RotateCcw,
  RotateCw,
  Box,
  EyeOff,
  Eye,
  Scan,
} from "lucide-react";
import Popover from "../workspace/Popover";
import type { SceneState, RenderMode } from "../anatomy";
export default function ViewerDock({
  state,
  update,
  reset,
  concealed,
}: {
  state: SceneState;
  update: (s: Partial<SceneState>) => void;
  reset: () => void;
  concealed: boolean;
}) {
  const command = (type: "zoom-in" | "zoom-out" | "frame") =>
    update({
      ...(type === "frame" ? { focusParts: undefined } : {}),
      cameraCommand: { id: performance.now(), type },
    });
  const modes: [RenderMode, string, typeof Layers][] = [
    ["anatomy", "Anatomy", Layers],
    ["skeleton", "Skeleton", Bone],
    ["wireframe", "Wireframe", Network],
    ["xray", "X-ray illustration", ScanLine],
  ];
  return (
    <div className="viewer-dock-wrap">
      <div className="anatomy-dock">
        <div className="dock-row" role="toolbar" aria-label="Display mode">
          {modes.map(([id, label, Icon]) => (
            <button
              key={id}
              disabled={concealed}
              aria-pressed={state.renderMode === id}
              onClick={() => update({ renderMode: id })}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
        <div className="dock-row" role="toolbar" aria-label="Camera controls">
          <button
            aria-pressed={state.interaction !== "pan"}
            onClick={() => update({ interaction: "orbit" })}
          >
            <Move3D size={17} />
            Orbit
          </button>
          <button
            aria-pressed={state.interaction === "pan"}
            onClick={() => update({ interaction: "pan" })}
          >
            <Hand size={17} />
            Pan
          </button>
          {(
            [
              ["front", "Front", UserRound],
              ["back", "Back", RotateCcw],
              ["side", "Side", RotateCw],
              ["three-quarter", "Three-quarter", Box],
            ] as const
          ).map(([view, label, Icon]) => (
            <button
              key={view}
              aria-pressed={state.view === view}
              onClick={() => update({ view, reset: state.reset + 1 })}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
          <button onClick={() => command("zoom-out")}>
            <Minus size={17} />
            Zoom out
          </button>
          <button onClick={() => command("zoom-in")}>
            <Plus size={17} />
            Zoom in
          </button>
          <button onClick={() => command("frame")}>
            <Focus size={17} />
            Fit body
          </button>
        </div>
        <div
          className="dock-row dock-secondary"
          role="toolbar"
          aria-label="Selection and display settings"
        >
          {state.selected.length > 0 && !concealed && (
            <>
              <button
                onClick={() => update({ focusParts: state.selected, reset: state.reset + 1 })}
              >
                <Focus size={16} />
                Focus selection
              </button>
              <button
                aria-pressed={state.isolate}
                onClick={() => update({ isolate: !state.isolate })}
              >
                <Scan size={16} />
                Isolate
              </button>
              <button
                onClick={() =>
                  update({
                    hidden: [...new Set([...(state.hidden ?? []), ...state.selected])],
                    selected: [],
                  })
                }
              >
                <EyeOff size={16} />
                Hide
              </button>
            </>
          )}
          {!!state.hidden?.length || state.isolate ? (
            <button onClick={() => update({ hidden: [], isolate: false })}>
              <Eye size={16} />
              Restore
            </button>
          ) : null}
          <Popover label="More display settings">
            <h3>Display settings</h3>
            {state.renderMode === "xray" && <p>Illustrative view, not a radiograph.</p>}
            <label>
              Context opacity · {Math.round((state.contextOpacity ?? 1) * 100)}%
              <input
                aria-label="Context opacity"
                type="range"
                min={0}
                max={100}
                value={(state.contextOpacity ?? 1) * 100}
                disabled={concealed}
                onChange={(e) => update({ contextOpacity: Number(e.target.value) / 100 })}
              />
            </label>
            <label>
              Explode anatomy
              <input
                aria-label="Explode anatomy"
                type="range"
                min={0}
                max={1}
                step={0.01}
                disabled={concealed}
                value={state.explode}
                onChange={(e) => update({ explode: Number(e.target.value) })}
              />
            </label>
            <button
              disabled={concealed}
              role="switch"
              aria-checked={state.labelsVisible !== false}
              onClick={() => update({ labelsVisible: state.labelsVisible === false })}
            >
              Structure labels
            </button>
            {state.renderMode === "wireframe" && (
              <button
                role="switch"
                aria-checked={!!state.solidContext}
                onClick={() => update({ solidContext: !state.solidContext })}
              >
                Solid context
              </button>
            )}
            <button onClick={reset}>Reset display settings</button>
          </Popover>
        </div>
      </div>
    </div>
  );
}
