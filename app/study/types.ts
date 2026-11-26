export type RegionId = "shoulder" | "arm" | "forearm" | "hand";
export type Side = "right" | "left";
export interface Editorial {
  version: string;
  status: "draft" | "approved";
  reviewer: string | null;
  reviewedAt: string | null;
  objectives: string[];
  references: string[];
}
export interface StructureCard extends Editorial {
  id: string;
  title: string;
  region: RegionId;
  concepts: Record<Side, string[]>;
  fields: Record<string, string>;
  relationships: { label: string; targetIds: string[] }[];
}
export interface Lesson extends Editorial {
  id: string;
  title: string;
  region: RegionId;
  minutes: number;
  prerequisites?: string[];
  steps: { kind: "understand" | "observe" | "explain" | "check"; objective: string; questionIds: string[]; title: string; text: string; cardIds: string[]; nerveId?: string }[];
}
export interface Question extends Editorial {
  id: string;
  region: RegionId;
  kind: "select" | "identify" | "clinical";
  prompt: string;
  cardId: string;
  options: string[];
  answer: string;
  explanation: string;
}
export interface ClinicalCase extends Editorial {
  id: string;
  title: string;
  region: RegionId;
  presentation: string;
  questionIds: string[];
}
export interface NerveDiagram extends Editorial {
  id: string;
  title: string;
  cardIds: string[];
  description: string;
}
export interface ClinicalCondition extends Editorial {
  id: string;
  title: string;
  region: RegionId;
  cardIds: string[];
  caseIds: string[];
  overview: string;
  mechanism: string;
  findings: string;
  complications: string;
  limitation: string;
  annotations: { cardId: string; label: string }[];
}
export interface Content {
  conditions: ClinicalCondition[];
  cards: StructureCard[];
  lessons: Lesson[];
  questions: Question[];
  cases: ClinicalCase[];
  nerves: NerveDiagram[];
}
export interface Attempt {
  questionId: string;
  contentVersion: string;
  correct: boolean;
  answer: string;
  at: string;
  preview: boolean;
}
export interface ReviewEntry {
  stage: number;
  due: string;
}
export interface Progress {
  schemaVersion: 2;
  attempts: Attempt[];
  bookmarks: string[];
  completedLessons: string[];
  lessonSteps: Record<string, number>;
  reviews: Record<string, ReviewEntry>;
}
export const REGIONS: { id: RegionId; title: string; subtitle: string }[] = [
  {
    id: "shoulder",
    title: "Shoulder & axilla",
    subtitle: "Stability, movement & nerve relationships",
  },
  { id: "arm", title: "Arm & elbow", subtitle: "Compartments, landmarks & vascular relations" },
  { id: "forearm", title: "Forearm", subtitle: "Rotation, flexors & extensors" },
  { id: "hand", title: "Wrist & hand", subtitle: "Carpal anatomy, tendons & precision movement" },
];
