import type { Atlas } from "../anatomy";
import type { Content, Editorial, Progress, Question, Side, StructureCard } from "./types";
export const emptyProgress = (): Progress => ({
  schemaVersion: 2,
  attempts: [],
  bookmarks: [],
  completedLessons: [],
  lessonSteps: {},
  reviews: {},
});
export function approved(item: Editorial) {
  return (
    item.status === "approved" &&
    !!item.reviewer?.trim() &&
    !!item.reviewedAt &&
    !Number.isNaN(Date.parse(item.reviewedAt)) &&
    item.references.length > 0
  );
}
export function availableContent(content: Content, preview: boolean): Content {
  const cards = content.cards.filter((x) => preview || approved(x));
  const ids = new Set(cards.map((x) => x.id));
  const questions = content.questions.filter((x) => (preview || approved(x)) && ids.has(x.cardId));
  const qids = new Set(questions.map((x) => x.id));
  return {
    conditions: (content.conditions ?? []).filter(
      (x) =>
        (preview || approved(x)) &&
        x.cardIds.every((id) => ids.has(id)) &&
        x.caseIds.every((id) =>
          content.cases.some(
            (c) =>
              c.id === id &&
              (preview || approved(c)) &&
              c.questionIds.every((qid) => qids.has(qid)),
          ),
        ),
    ),
    cards,
    questions,
    lessons: content.lessons.filter(
      (x) => (preview || approved(x)) && x.steps.every((s) => s.cardIds.every((id) => ids.has(id)) && (s.questionIds ?? []).every(id=>qids.has(id))),
    ),
    cases: content.cases.filter(
      (x) => (preview || approved(x)) && x.questionIds.every((id) => qids.has(id)),
    ),
    nerves: content.nerves.filter(
      (x) => (preview || approved(x)) && x.cardIds.every((id) => ids.has(id)),
    ),
  };
}
export function partIds(card: StructureCard, atlas: Atlas, side: Side) {
  return [
    ...new Set(
      card.concepts[side].flatMap((id) => atlas.concepts.find((c) => c.id === id)?.elements ?? []),
    ),
  ];
}
export function grade(
  question: Question,
  answer: string,
  card: StructureCard,
  atlas: Atlas,
  side: Side,
) {
  return question.kind === "select"
    ? partIds(card, atlas, side).includes(answer)
    : answer === question.answer;
}
export function recordAnswer(
  progress: Progress,
  q: Question,
  answer: string,
  correct: boolean,
  preview: boolean,
  now = new Date(),
): Progress {
  const key = `${preview ? "preview:" : ""}${q.id}`;
  const previous = progress.reviews[key];
  const stage = correct ? Math.min(4, previous ? previous.stage + 1 : 0) : 0;
  const due = new Date(now);
  due.setDate(due.getDate() + [1, 3, 7, 14, 30][stage]);
  return {
    ...progress,
    attempts: [
      ...progress.attempts,
      {
        questionId: q.id,
        contentVersion: q.version,
        correct,
        answer,
        at: now.toISOString(),
        preview,
      },
    ],
    reviews: { ...progress.reviews, [key]: { stage, due: due.toISOString() } },
  };
}
export function validateProgress(value: unknown): Progress {
  if (!value || typeof value !== "object")
    throw new Error("This is not a LearnHumanBody progress file.");
  const p = value as Progress;
  const strings = (x: unknown): x is string[] =>
    Array.isArray(x) && x.every((s) => typeof s === "string");
  const record = (x: unknown) => !!x && typeof x === "object" && !Array.isArray(x);
  if (
    ![1, 2].includes(p.schemaVersion) ||
    !strings(p.bookmarks) ||
    !strings(p.completedLessons) ||
    !Array.isArray(p.attempts) ||
    !record(p.lessonSteps) ||
    !record(p.reviews)
  )
    throw new Error("Unsupported or invalid progress format.");
  if (
    p.attempts.some(
      (a) =>
        !a ||
        typeof a.questionId !== "string" ||
        typeof a.contentVersion !== "string" ||
        typeof a.answer !== "string" ||
        typeof a.correct !== "boolean" ||
        typeof a.preview !== "boolean" ||
        typeof a.at !== "string" ||
        !Number.isFinite(Date.parse(a.at)),
    )
  )
    throw new Error("Invalid practice history.");
  if (
    Object.values(p.lessonSteps).some((n) => !Number.isInteger(n) || n < 0) ||
    Object.values(p.reviews).some(
      (r) =>
        !r ||
        !Number.isInteger(r.stage) ||
        r.stage < 0 ||
        r.stage > 4 ||
        typeof r.due !== "string" ||
        !Number.isFinite(Date.parse(r.due)),
    )
  )
    throw new Error("Invalid review schedule.");
  return {
    schemaVersion: 2,
    attempts: p.attempts,
    bookmarks: p.bookmarks,
    completedLessons: p.completedLessons,
    lessonSteps: p.lessonSteps,
    reviews: p.reviews,
  };
}
