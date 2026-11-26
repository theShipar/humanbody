import type { Editorial } from "../study/types";
export interface Specialty {
  id: string;
  title: string;
  domain: "medical" | "dental";
  targetCount: 10;
}
export interface VisualAsset extends Editorial {
  id: string;
  kind: "diagram" | "model";
  format?: "glb" | "svg" | "embedded";
  units?: "m" | "cm" | "mm";
  registration?: {
    space: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  pairId?: string;
  role?: "reference" | "affected";
  bounds?: { min: [number, number, number]; max: [number, number, number] };
  stageIds?: string[];
  url: string;
  licence: string;
  conceptIds: string[];
}
export interface PainPattern {
  sourceConceptIds: string[];
  feltRegion: string;
  description: string;
  generalized: boolean;
}
export interface Stage {
  diagram?: {
    kind: "bone" | "tooth";
    phase:
      | "reference"
      | "fracture"
      | "fixation"
      | "support"
      | "healing"
      | "mineral-loss"
      | "cavity"
      | "filling"
      | "early-care";
  };
  id: string;
  title: string;
  patientText: string;
  clinicalText: string;
  conceptIds: string[];
  assetIds: string[];
  visualLabel: string;
}
export interface ScenarioTrack {
  id: string;
  title: string;
  kind: "course" | "treatment" | "recovery";
  branch: string;
  stages: Stage[];
}
export interface Scenario extends Editorial {
  id: string;
  title: string;
  specialtyIds: string[];
  domain: "medical" | "dental";
  region: string;
  kind: "condition" | "procedure" | "pain";
  synonyms: string[];
  overview: string;
  limitation: string;
  conceptIds: string[];
  visualMethod: "anatomy-overlay" | "diagram" | "hybrid";
  tracks: ScenarioTrack[];
  pain?: PainPattern;
  questions: {
    id: string;
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
    trackId: string;
    stageId: string;
  }[];
}
export interface PresentationState {
  active: boolean;
  scenarioId: string | null;
  trackId: string;
  position: number;
  speed: 0.5 | 1 | 2;
  playing: boolean;
  followCamera: boolean;
}
export interface Capability {
  conceptId: string;
  method: "modeled" | "diagram-only" | "unavailable";
  assetIds: string[];
}
