import type { Content } from "../types";
import draft from "./draft.json";
import conditions from "./conditions-draft.json";
import published from "./published.json";
// Drafts are excluded from production bundles, not merely hidden by the interface.
export const content: Content = (import.meta.env.DEV ? {...draft,conditions} : published) as unknown as Content;
