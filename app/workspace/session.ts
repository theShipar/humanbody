import type { SceneState } from "../anatomy";
import type { Domain } from "./navigation";
export interface StudySession {
  version: 1;
  domain: Domain;
  mode: "learn" | "practice";
  lessonId: string | null;
  queue: string[];
  qIndex: number;
  answer: string;
  result: boolean | null;
  finished: boolean;
  caseId: string | null;
  region: "shoulder" | "arm" | "forearm" | "hand";
  side: "right" | "left";
  scene: SceneState;
  title: string;
}
export function readSession(domain: Domain, preview: boolean): StudySession | null {
  try {
    const s = JSON.parse(
      localStorage.getItem(`lhb-session:${preview ? "editorial:" : ""}${domain}`) ?? "null",
    );
    if (
      !s ||
      s.version !== 1 ||
      s.domain !== domain ||
      !["learn", "practice"].includes(s.mode) ||
      !Array.isArray(s.queue) ||
      !s.queue.every((x: unknown) => typeof x === "string") ||
      !Number.isInteger(s.qIndex) ||
      s.qIndex < 0 ||
      !["shoulder", "arm", "forearm", "hand"].includes(s.region) ||
      !["left", "right"].includes(s.side) ||
      !s.scene ||
      !Array.isArray(s.scene.selected) ||
      !Array.isArray(s.scene.visible)
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
export function saveSession(session: StudySession, preview: boolean) {
  try {
    localStorage.setItem(
      `lhb-session:${preview ? "editorial:" : ""}${session.domain}`,
      JSON.stringify(session),
    );
  } catch {}
}
