import type { Atlas } from "../anatomy";
import type { Content, Editorial } from "./types";
import { approved, availableContent } from "./learning.ts";
export function validateContent(content: Content, atlas: Atlas, release = false) {
  const errors: string[] = [];
  const seen = new Set<string>();
  const concepts = new Map(atlas.concepts.map((c) => [c.id, c]));
  const parts = new Set(atlas.parts.map((p) => p.id));
  const all = [
    ...content.cards,
    ...content.lessons,
    ...content.questions,
    ...content.cases,
    ...content.nerves,
    ...(content.conditions ?? []),
  ];
  for (const item of all) {
    if (!item.id || seen.has(item.id)) errors.push(`Duplicate or empty item ID: ${item.id}`);
    seen.add(item.id);
    if (!item.version || !item.objectives.length || !item.references.length)
      errors.push(`${item.id}: missing editorial metadata`);
    if (
      item.references.some((r) => {
        try {
          return new URL(r).protocol !== "https:";
        } catch {
          return true;
        }
      })
    )
      errors.push(`${item.id}: invalid reference URL`);
    if (!["draft", "approved"].includes(item.status))
      errors.push(`${item.id}: invalid review status`);
    if ((release || item.status === "approved") && !approved(item))
      errors.push(`${item.id}: medical sign-off required`);
  }
  const cards = new Map(content.cards.map((c) => [c.id, c]));
  const questions = new Map(content.questions.map((q) => [q.id, q]));
  const checkCards = (id: string, ids: string[]) => {
    if (!ids.length || ids.some((x) => !cards.has(x)))
      errors.push(`${id}: missing structure card dependency`);
  };
  for (const c of content.cards) {
    for (const side of ["right", "left"] as const) {
      if (!c.concepts[side].length) errors.push(`${c.id}: missing ${side} mapping`);
      for (const id of c.concepts[side]) {
        const concept = concepts.get(id);
        if (!concept || !concept.elements.length || concept.elements.some((p) => !parts.has(p)))
          errors.push(`${c.id}: invalid atlas concept ${id}`);
        else if (!concept.name.includes(side))
          errors.push(`${c.id}: incorrect ${side} laterality ${id}`);
      }
    }
    for (const r of c.relationships) checkCards(c.id, r.targetIds);
    if (!Object.keys(c.fields).length || Object.values(c.fields).some((x) => !x.trim()))
      errors.push(`${c.id}: incomplete card`);
  }
  for (const q of content.questions) {
    checkCards(q.id, [q.cardId]);
    if (!q.prompt || !q.explanation) errors.push(`${q.id}: missing prompt or explanation`);
    if (
      q.kind !== "select" &&
      (!q.options.includes(q.answer) ||
        q.options.length < 2 ||
        new Set(q.options).size !== q.options.length)
    )
      errors.push(`${q.id}: invalid answer options`);
    if (q.kind === "select" && q.answer !== cards.get(q.cardId)?.title)
      errors.push(`${q.id}: invalid selection answer`);
  }
  for (const l of content.lessons) {
    if (!l.steps.length) errors.push(`${l.id}: empty lesson`);
    for (const s of l.steps) {
      checkCards(l.id, s.cardIds);
      if(!["understand","observe","explain","check"].includes(s.kind) || !s.objective?.trim()) errors.push(`${l.id}: missing authored step kind or objective`);
      if(!Array.isArray(s.questionIds) || s.questionIds.some(id=>!questions.has(id) || !s.cardIds.includes(questions.get(id)!.cardId))) errors.push(`${l.id}: invalid objective question link`);
      if(s.kind==="check" && !s.questionIds?.length) errors.push(`${l.id}: check has no questions`);
      if (s.nerveId && !content.nerves.some((n) => n.id === s.nerveId))
        errors.push(`${l.id}: missing nerve diagram`);
    }
  }
  for (const c of content.cases) {
    if (
      !c.questionIds.length ||
      c.questionIds.some((q) => !questions.has(q) || questions.get(q)?.kind !== "clinical")
    )
      errors.push(`${c.id}: invalid case questions`);
  }
  for (const c of content.conditions ?? []) {
    checkCards(c.id, c.cardIds);
    if (c.caseIds.some((id) => !content.cases.some((x) => x.id === id)))
      errors.push(`${c.id}: missing case`);
    if (c.annotations.some((a) => !c.cardIds.includes(a.cardId) || !a.label.trim()))
      errors.push(`${c.id}: invalid annotation`);
    if (
      [c.overview, c.mechanism, c.findings, c.complications, c.limitation].some((x) => !x?.trim())
    )
      errors.push(`${c.id}: incomplete condition`);
  }
  for (const n of content.nerves) checkCards(n.id, n.cardIds);
  if (release) {
    const filtered = availableContent(content, false);
    for (const key of ["cards", "lessons", "questions", "cases", "nerves", "conditions"] as const)
      if (filtered[key].length !== (content[key] ?? []).length)
        errors.push(`${key}: unapproved dependency`);
    for (const c of content.cards)
      for (const r of c.relationships)
        if (r.targetIds.some((id) => !approved(cards.get(id) as Editorial)))
          errors.push(`${c.id}: unapproved relationship`);
  }
  return errors;
}
