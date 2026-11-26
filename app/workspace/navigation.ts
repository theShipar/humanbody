/** Workspace preferences are separate from learner progress and never imply clinical access. */
export type Role = "explorer" | "student" | "doctor";
export type Destination = "explore" | "learn" | "explain" | "library";
export type Domain = "medical" | "dental";
export const destinations = [
  { id: "explore", label: "Explore" },
  { id: "learn", label: "Learn" },
  { id: "explain", label: "Explain" },
  { id: "library", label: "My Library" },
] as const;
export const roles = [
  { id: "explorer", label: "Explorer" },
  { id: "student", label: "Medical student" },
  { id: "doctor", label: "Doctor" },
] as const;
export function readPreference(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Read-only browsers can still explore. */
  }
}
export function dentalParts(atlas: { concepts: { id: string; elements: string[] }[] }): string[] {
  return [
    ...new Set(
      atlas.concepts
        .filter((c) => ["FMA12516", "FMA9711", "FMA52748"].includes(c.id))
        .flatMap((c) => c.elements),
    ),
  ];
}
