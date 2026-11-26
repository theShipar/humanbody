import type { Scenario, ScenarioTrack } from "./types";
/** Position is an illustrative stage index, never elapsed disease time. */
export function evaluateTimeline(track: ScenarioTrack, position: number) {
  if (!track.stages.length) throw new Error("A track must contain stages");
  const clamped = Math.max(
    0,
    Math.min(track.stages.length - 1, Number.isFinite(position) ? position : 0),
  );
  const index = Math.floor(clamped);
  return {
    position: clamped,
    index,
    stage: track.stages[index],
    ended: clamped === track.stages.length - 1,
  };
}
export function advanceTimeline(
  track: ScenarioTrack,
  position: number,
  elapsedMs: number,
  speed: number,
) {
  return evaluateTimeline(track, position + (Math.max(0, elapsedMs) / 5000) * speed);
}
export function scenarioMatches(s: Scenario, query: string) {
  return [s.title, s.overview, ...s.synonyms]
    .join(" ")
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}
