# Clinical anatomy pilot

## Run and preview

Run `npm ci`, then `npm run dev`. Open http://127.0.0.1:3016/.

The default student workspace shows approved content only. In development, **Reviewer preview** opens the provisional upper-limb library: 40 structure cards, eight guided lessons, eight cases, 60 questions, and five conceptual nerve-supply maps. Preview progress is separated from student practice history. These drafts are not medically reviewed, are not comprehensive textbook entries, and must not be distributed as approved clinical teaching.

The original whole-body viewer remains under **Explore**. Regional study presets use explicit atlas concept IDs for each side. Nerve maps show selected motor relationships, not anatomical trajectories, sensory territories, or complete branching. No nerve geometry was fabricated.

## Required editorial work

1. A qualified reviewer approves or revises `CONTENT_INVENTORY.md`. Record genuine inventory approval in `app/study/content/inventory-review.json`; do not self-certify on their behalf.
2. Revise provisional material in `app/study/content/draft.json`. Verify claims, attachments, supply, relations, answer choices, explanation quality and every citation. Add missing clinical detail and blood supply before considering a card complete. References are supporting reading, not evidence of reviewer sign-off.
3. Review both side mappings in the viewer. Check the five diagrams and their explicitly limited coverage.
4. For each approved item, record `status: "approved"`, the actual reviewer identity, ISO `reviewedAt` date, and version. Increment versions for substantive changes and return changed items to draft for re-review.
5. Run `npm run content:publish`. This requires inventory approval and a complete approved module. It rejects unapproved dependencies. Review the generated `published.json` diff.
6. Run checks below and `npm run build`. Production code imports the published library only; draft content and the preview toggle are removed from the production bundle.
7. Pilot with a small group of clinical students. Collect completion difficulties, ambiguous questions, content corrections and device issues before wider release.

An approval flag is an editorial record, not an authentication system. This static application has no remote publishing or reviewer account service.

## Learner data

IndexedDB database `human-atlas-study`, version 1, stores attempts, bookmarks, completed lessons, lesson positions and review schedules. JSON export/import is available in **My Review**. Import validates the format and replaces local history. Browser data removal also removes progress. Localhost and 127.0.0.1 are separate browser origins and have separate progress stores.

Correct answers advance through 1, 3, 7, 14 and 30 days; incorrect answers reset to one day. Preview attempts and schedules have separate identities. Attempts retain content versions. Performance statistics indicate practice outcomes, not clinical competence.

## Checks

- `npm run check`
- `npm run test:study`
- `npm run validate:study`
- `node scripts/validate-atlas.mjs`
- `node scripts/validate-interactions.mjs`
- `npm run build`

Browser acceptance: student gate; preview opt-in; region and laterality; lesson resume/completion; hide/fade/focus/restore; nerve-to-model links; select and identify grading; clinical case sequence; concealed quiz names; reload persistence; JSON backup round trip; desktop/mobile layouts. If WebGL fails, reading and diagrams remain available and 3D assessment submission is disabled. Clinical multiple-choice questions remain usable.

## Remaining external milestones

Inventory approval, medical content sign-off, student-pilot feedback, and public deployment have not occurred. No expert review is claimed. Full 3D nerves, authentic radiology images, accounts, and AI tutoring remain outside this release.
