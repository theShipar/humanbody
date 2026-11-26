# Precise workspace implementation and qualification

Updated 2026-11-15. This is a working local implementation, not an all-specialty medical release.

## Implemented

- Shared Urbanist/teal design system and responsive Study/Explain shell. Removed the superseded study, dark-workspace and clinical CSS files; the legacy whole-body globals stylesheet is no longer imported by the workspace.
- Remembered workspace/domain, grouped global search, recent explanations, review controls in a portal popover, viewport collision handling, focus return and Escape handling.
- Measured stage insets and annotation exclusions, anatomy-only edge fades, named camera menus, selection controls and delayed navigation framing so new panels are measured first. User orbit interrupts camera movement.
- Study phases, regional discovery, continuation, optional nerve relationships, existing grading and concealment. Mobile collapsed study content is inert, with an explicit expansion action.
- Scenario questions appear in Review with their original namespaced IDs and due dates. A review opens its specific question. Relevant-stage feedback preserves the requested position when changing tracks.
- Compact playback and presentation with explicit schematic/reference labels and persistent draft status. Presentation preserves the active stage.
- Model manifests support format, units, registration, role, reciprocal pair IDs, bounds and stage visibility. The abortable GLB loader handles retry, cancellation, failure and resource disposal. SVG explanations remain supported. The normal atlas remains available while separate assets load.
- Reference/affected controls only appear for reciprocally registered, genuinely approved pairs. Desktop comparison uses a shared bounding volume and fixed matching camera framing. Use the individual views to orbit. Asset bounds are specified in the registered coordinate space, in metres; translation is in metres, rotation in radians, and units scale source geometry.
- Asset previews render on changes rather than running a permanent animation loop.

## Verification completed

- TypeScript; study tests; clinical tests; workspace asset tests; atlas validation; interaction validation; production build.
- Original technical GLB triangle fixture parsed, transformed and disposed by the actual loader. Pairing, stage visibility, cancellation and failure tests pass.
- Browser: reviewer entry, synonym search for fracture, opening its scenario, answer submission and saved feedback, opening the relevant recovery stage, presentation enter/exit preserving stage.
- Header/selector bounds and document overflow checked at 320, 390, 768, 1024, 1440 and 1920 CSS pixels. Short 1024×480 window checked with flowing content. Phone and desktop layouts visually inspected.
- Build retains a large-bundle warning; it does not fail compilation.

## Release qualification still required

- Actual 200% browser zoom, screen-reader and full keyboard workflow audit, no-WebGL browser exercise, reduced-motion browser exercise, and complete visual regression across every task/size combination. The checks above are not a claim that the entire accessibility acceptance matrix is complete.
- Agreed-device performance measurements and a recorded baseline comparison; no measured 60/30 fps claim is made.
- Five-student/five-clinician observed task testing. No task-success rate has been invented.
- Medical inventory/item approvals and commissioned, licensed reference/affected assets. The catalogue remains 270 proposed inventory slots, two draft platform scenarios and zero published scenarios. Test fixture approval fields are synthetic and never publish clinical content.
- Complete controller extraction from StudyApp remains architectural follow-up; shared UI and stage measurement are extracted, while existing study/progress orchestration remains in place to preserve behavior.
