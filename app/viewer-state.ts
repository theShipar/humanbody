import type { Part, SceneState } from "./anatomy";
/** One visibility contract for rendering, ray picking and annotations. */
export function visiblePart(part: Part, state: SceneState): boolean {
  if (state.hidden?.includes(part.id)) return false;
  if (state.regionParts && !state.regionParts.includes(part.id)) return false;
  if (state.isolate) return state.selected.includes(part.id);
  if (state.renderMode === "skeleton" && part.system !== "skeletal") return false;
  return state.visible.includes(part.system) || state.selected.includes(part.id);
}
export function partOpacity(part: Part, state: SceneState): number {
  if (!visiblePart(part, state)) return 0;
  if (state.selected.includes(part.id)) return 1;
  const context = Math.max(0, Math.min(1, state.contextOpacity ?? 1));
  if (state.renderMode === "xray") return (part.system === "skeletal" ? 0.65 : 0.14) * context;
  if (state.renderMode === "wireframe") return state.solidContext ? 0.12 * context : 0;
  return (state.fadeContext ? 0.22 : 1) * context;
}
export function pickablePart(part: Part, state: SceneState): boolean {
  return (
    visiblePart(part, state) &&
    (state.renderMode === "wireframe" || partOpacity(part, state) > 0.015)
  );
}
