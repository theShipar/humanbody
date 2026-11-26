import type { Scenario, VisualAsset, Specialty } from "./types";
import { approved } from "../study/learning.ts";
export function validateScenarios(
  scenarios: Scenario[],
  assets: VisualAsset[],
  specialties: Specialty[],
  conceptIds: Set<string>,
  release = false,
) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for(const asset of assets){
    if(asset.kind==='model'&&(asset.format!=='glb'||!asset.units||!asset.registration||!asset.bounds))errors.push(`${asset.id}: model format, units, registration and bounds required`);
    if(asset.registration&&[...asset.registration.position,...asset.registration.rotation,...asset.registration.scale].some(n=>!Number.isFinite(n)))errors.push(`${asset.id}: invalid registration`);
    if(asset.pairId&&!assets.some(a=>a.id===asset.pairId&&a.pairId===asset.id&&a.registration?.space===asset.registration?.space&&a.units===asset.units))errors.push(`${asset.id}: incompatible comparison pair`);
    if(asset.format==='glb'&&!/\.glb(?:\?|$)/.test(asset.url))errors.push(`${asset.id}: invalid GLB URL`);
  }
  for (const s of scenarios) {
    if (ids.has(s.id) || !s.id) errors.push(`${s.id}: duplicate ID`);
    ids.add(s.id);
    if (
      !s.title ||
      !s.overview ||
      !s.limitation ||
      !s.version ||
      !s.objectives.length ||
      !s.references.length
    )
      errors.push(`${s.id}: incomplete metadata`);
    if (release && !approved(s)) errors.push(`${s.id}: medical approval required`);
    if (
      !s.specialtyIds.length ||
      s.specialtyIds.some((id) => !specialties.some((x) => x.id === id && x.domain === s.domain))
    )
      errors.push(`${s.id}: invalid specialty`);
    for (const ref of s.references) {
      try {
        if (new URL(ref).protocol !== "https:") throw Error();
      } catch {
        errors.push(`${s.id}: invalid citation`);
      }
    }
    const tracks = new Set<string>();
    if (!s.tracks.length) errors.push(`${s.id}: no tracks`);
    for (const t of s.tracks) {
      if (tracks.has(t.id) || !t.stages.length) errors.push(`${s.id}: invalid track`);
      tracks.add(t.id);
      const stages = new Set<string>();
      for (const stage of t.stages) {
        if (stages.has(stage.id) || !stage.patientText || !stage.visualLabel)
          errors.push(`${s.id}: invalid stage`);
        stages.add(stage.id);
        if (stage.conceptIds.some((id) => !conceptIds.has(id)))
          errors.push(`${s.id}: missing anatomy`);
        if (
          stage.assetIds.some(
            (id) => !assets.some((a) => a.id === id && a.licence && (!release || approved(a))),
          )
        )
          errors.push(`${s.id}: missing or unapproved asset`);
      }
    }
    if (s.conceptIds.some((id) => !conceptIds.has(id))) errors.push(`${s.id}: missing anatomy`);
    for (const q of s.questions)
      if (
        !q.options.includes(q.answer) ||
        !s.tracks.find((t) => t.id === q.trackId)?.stages.some((x) => x.id === q.stageId)
      )
        errors.push(`${s.id}: invalid question`);
  }
  return errors;
}
