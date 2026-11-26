import registry from "./specialties.json";
import drafts from "./drafts.json";
import published from "./published.json";
import assets from "./assets.json";
import type { Scenario, Specialty } from "./types";
import { approved } from "../study/learning";
export const specialties = registry as Specialty[];
const source = (import.meta.env.DEV ? drafts : published) as Scenario[];
export function getScenarios(preview: boolean) {
  return source.filter(
    (s) =>
      (import.meta.env.DEV && preview) ||
      (approved(s) &&
        s.tracks.every((t) =>
          t.stages.every((stage) =>
            stage.assetIds.every((id) =>
              assets.some(
                (a) => a.id === id && approved(a as unknown as import("../study/types").Editorial),
              ),
            ),
          ),
        )),
  );
}
