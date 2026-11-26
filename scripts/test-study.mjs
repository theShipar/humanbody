import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  availableContent,
  approved,
  emptyProgress,
  grade,
  partIds,
  recordAnswer,
  validateProgress,
} from "../app/study/learning.ts";
import { validateContent } from "../app/study/validate.ts";
const data = JSON.parse(
  await readFile(new URL("../app/study/content/draft.json", import.meta.url)),
);
const atlas = JSON.parse(await readFile(new URL("../public/models/atlas.json", import.meta.url)));
assert.equal(data.cards.length, 40);
assert.equal(data.lessons.length, 8);
assert.equal(data.cases.length, 8);
assert.equal(data.questions.length, 60);
assert.deepEqual(validateContent(data, atlas), []);
assert.equal(availableContent(data, false).cards.length, 0);
assert.equal(availableContent(data, true).questions.length, 60);
assert.equal(
  approved({ ...data.cards[0], status: "approved" }),
  false,
  "A status flag alone cannot publish content",
);
const signed = structuredClone(data);
for (const group of Object.values(signed))
  for (const item of group) {
    item.status = "approved";
    item.reviewer = "Test reviewer";
    item.reviewedAt = "2026-11-10";
  }
assert.deepEqual(validateContent(signed, atlas, true), []);
signed.cards[0].reviewer = null;
assert.ok(validateContent(signed, atlas, true).length > 0);
assert.equal(availableContent(signed, false).cards.length, 39);
assert.ok(
  availableContent(signed, false).lessons.length < 8,
  "Lesson with unapproved card must not publish",
);
const wrongSide = structuredClone(data);
wrongSide.cards[0].concepts.left = wrongSide.cards[0].concepts.right;
assert.ok(validateContent(wrongSide, atlas).some((e) => e.includes("laterality")));
const badQuestion = structuredClone(data);
badQuestion.questions.find((q) => q.kind === "clinical").answer = "invalid";
assert.ok(validateContent(badQuestion, atlas).some((e) => e.includes("answer")));
for (const q of data.questions.filter((q) => q.kind === "select")) {
  const card = data.cards.find((c) => c.id === q.cardId);
  const right = partIds(card, atlas, "right"),
    left = partIds(card, atlas, "left");
  assert.ok(right.length && left.length);
  for (const id of right) assert.equal(grade(q, id, card, atlas, "right"), true);
  for (const id of left)
    assert.equal(grade(q, id, card, atlas, "right"), false, "Opposite side must not be accepted");
  assert.equal(grade(q, "nonexistent", card, atlas, "right"), false);
}
for (const q of data.questions.filter((q) => q.kind !== "select")) {
  const c = data.cards.find((c) => c.id === q.cardId);
  assert.equal(grade(q, q.answer, c, atlas, "right"), true);
  assert.equal(grade(q, "wrong", c, atlas, "right"), false);
}
const q = data.questions[0];
let p = emptyProgress();
const today = new Date("2026-11-10T12:00:00Z");
for (const days of [1, 3, 7, 14, 30, 30]) {
  p = recordAnswer(p, q, "answer", true, true, today);
  assert.equal((Date.parse(p.reviews["preview:" + q.id].due) - today.getTime()) / 86400000, days);
}
p = recordAnswer(p, q, "wrong", false, true, today);
assert.equal(p.reviews["preview:" + q.id].stage, 0);
assert.equal((Date.parse(p.reviews["preview:" + q.id].due) - today.getTime()) / 86400000, 1);
p = recordAnswer(p, q, "answer", true, false, today);
assert.ok(p.reviews[q.id]);
assert.ok(p.reviews["preview:" + q.id]);
assert.equal(p.attempts.length, 8);
assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p))), p);
assert.throws(() => validateProgress({ schemaVersion: 3 }));
assert.throws(() => validateProgress({ ...p, reviews: { bad: { stage: 7, due: "invalid" } } }));
assert.throws(() => validateProgress({ ...p, attempts: [{ ...p.attempts[0], correct: "true" }] }));
const source = await readFile(new URL("../app/scene.tsx", import.meta.url), "utf8");
assert.ok(/latest\.current\.labelsVisible\s*===\s*false/.test(source));
console.log(
  "Study tests passed: publication gate, dependencies, laterality, grouped grading, correct/incorrect answers, review intervals, preview separation, backup validation.",
);

data.conditions=JSON.parse(await readFile(new URL('../app/study/content/conditions-draft.json',import.meta.url)));
assert.equal(data.conditions.length,12);
assert.deepEqual(validateContent(data,atlas),[]);
assert.equal(availableContent(data,false).conditions.length,0);
assert.equal(availableContent(data,true).conditions.length,12);
const broken=structuredClone(data);broken.conditions[0].annotations[0].cardId='missing';
assert.ok(validateContent(broken,atlas).some(x=>x.includes('invalid annotation')));
console.log('Clinical inventory: 12 mapped drafts, annotation validation and publication filtering passed.');

const {visiblePart,pickablePart,partOpacity}=await import('../app/viewer-state.ts');
const bone=atlas.parts.find(p=>p.system==='skeletal');
const muscle=atlas.parts.find(p=>p.system==='muscular');
const scene={visible:[...new Set(atlas.parts.map(p=>p.system))],selected:[],hidden:[],renderMode:'skeleton',contextOpacity:1};
assert.equal(visiblePart(bone,scene),true);
assert.equal(visiblePart(muscle,scene),false);
for(const renderMode of ['anatomy','skeleton','wireframe','xray']) {
 const hidden={...scene,renderMode,hidden:[bone.id],selected:[bone.id]};
 assert.equal(visiblePart(bone,hidden),false);assert.equal(pickablePart(bone,hidden),false);assert.equal(partOpacity(bone,hidden),0);
}
assert.equal(pickablePart(bone,{...scene,contextOpacity:0}),false);
console.log('Viewer visibility and hidden-selection contracts passed in all four modes.');

assert.deepEqual(validateProgress({...p,schemaVersion:1}),{...p,schemaVersion:2});
