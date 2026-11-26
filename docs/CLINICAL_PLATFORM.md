# Clinical explanation platform — implementation status

## Run and inspect

Run `npm run dev`, open Medical / Dental, and enable local reviewer preview. Two provisional explanations are available: Understanding a broken bone and Understanding tooth decay. Both have independently scrubbed tracks, a discrete schematic at each stage, source links, questions, correction export, and presentation preview. Draft presentation remains visibly labelled unapproved and is not a patient-facing release.

Urbanist and Inter now ship locally. Explore, Learn and My Review are the three top-level destinations; Practice remains directly accessible inside Learn. Existing atlas tools remain available. The player is separate from renderer state, so stage scrubbing never accumulates transforms. Automatic playback pauses on scenario/track changes, hidden documents and departure from Explore. Framing is explicit, preserving the user's camera during presentation changes.

## Content inventory and external prerequisites

`app/clinical/inventory.json` contains 270 proposed titles/objectives across 27 domains. These are planning records, not 270 authored scenarios. Every specialty is marked awaiting reviewer. No clinician has been recruited or represented as having approved content. This work does not include specialist recruitment, contractual asset commissioning, or real clinician/student observation.

`app/clinical/drafts.json` contains only two draft explanations. `published.json` remains empty. The two original schematic illustrations are draft assets with version, licence and reference metadata; they are not commissioned, medically reviewed 3D assets. The reference atlas does not depict pathology. Female anatomy, fine tooth tissue geometry and procedural devices are not supplied by this milestone.

Sources used for the first drafts:
- AAOS: https://www.orthoinfo.org/diseases--conditions/broken-bones/fractures-broken-bones/
- NIDCR: https://www.nidcr.nih.gov/health-info/tooth-decay

Specialists must approve the inventory before expanded clinical authoring. Review clinical prose, diagrams, stage transitions, branching, questions and atlas mappings individually. The first commissioned set remains six orthopedic and six dental scenarios, selected by those reviewers.

## Persistence and publication

Progress format 2 preserves all existing format-1 attempts, review schedules, lesson completion and bookmarks. Format-1 JSON imports migrate on validation; IndexedDB uses the existing object store. Scenario question IDs are namespaced `scenario:<scenario>:<question>`, so normal backup/export includes their attempts and due dates. Preview attempts remain separate from published content. Domain and specialty preferences are optional localStorage values, never patient data.

`npm run clinical:publish` refuses publication without inventory and scenario sign-off and approved asset dependencies. `npm run test:clinical` validates both catalogues and timeline contracts. `npm run validate:launch` additionally requires ten approved scenarios in each domain and approved inventories; it is expected to fail today. Passing a software build is not launch approval.

## Still required before the complete planned release

- Specialty recruitment, inventory approval, remaining clinical authoring and all item/asset medical sign-offs.
- Commissioned 3D asset delivery and a cancellable runtime model-asset pipeline; currently only embedded schematic assets are supported.
- Expanded reviewed pain-pattern content, female/reference variants, and complete specialty-specific diagrams.
- Full Learn journey redesign, a reusable cross-application component library and removal of legacy CSS override layers. The new clinical workspace uses shared tokens; the older workspace has not been fully migrated.
- Guided-camera follow is opt-in and cancels on orbit/pan interaction; additional commissioned camera paths must be reviewed with their assets.
- Same-device baseline performance measurements, physical touch-device checks, clinician task observations and student learning evaluation.

No patient records, diagnostic inference, operative instructions, authentic radiology images, account system or public deployment were added.

## Verification performed

- TypeScript, study tests (including format-1 migration), clinical timeline/content tests, atlas and interaction validations, and production build pass.
- Desktop, 390px and 320px layouts inspected. Narrow layout has no horizontal document overflow.
- Dental scenario stage changes, presentation entry/exit, question feedback and persistence across reload exercised in the browser; no console errors observed.
- Production JS checked for representative draft prose; it is excluded.
- `validate:launch` fails as intended because no approved scenarios are published. This is not a complete 270-scenario release.
