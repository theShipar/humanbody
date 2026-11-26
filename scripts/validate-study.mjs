import { readFile, writeFile } from "node:fs/promises";
import { validateContent } from "../app/study/validate.ts";
import { availableContent } from "../app/study/learning.ts";
const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const atlas = await read("../public/models/atlas.json");
const draft = await read("../app/study/content/draft.json");
draft.conditions = await read("../app/study/content/conditions-draft.json");
const published = await read("../app/study/content/published.json");
const errors = [...validateContent(draft, atlas), ...validateContent(published, atlas, true)];
if (errors.length) throw new Error(errors.join("\n"));
if (process.argv.includes("--publish")) {
  const inventory = await read("../app/study/content/inventory-review.json");
  if (
    inventory.status !== "approved" ||
    !inventory.reviewer?.trim() ||
    !Number.isFinite(Date.parse(inventory.reviewedAt))
  )
    throw new Error(
      "Inventory approval is outstanding. Obtain and record medical reviewer sign-off before publishing.",
    );
  const approved = availableContent(draft, false);
  if (
    !approved.cards.length ||
    !approved.lessons.length ||
    !approved.questions.length ||
    !approved.cases.length
  )
    throw new Error("No complete medically approved module is ready for publication.");
  const releaseErrors = validateContent(approved, atlas, true);
  if (releaseErrors.length) throw new Error(releaseErrors.join("\n"));
  await writeFile(
    new URL("../app/study/content/published.json", import.meta.url),
    JSON.stringify(approved, null, 2) + "\n",
  );
  console.log("Generated publication library from approved content only.");
}
console.log(
  `Study content validated: ${draft.cards.length} draft cards, ${draft.lessons.length} lessons, ${draft.cases.length} cases, ${draft.questions.length} questions. ${published.cards.length} published cards.`,
);
