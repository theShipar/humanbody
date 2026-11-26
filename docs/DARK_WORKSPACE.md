# Immersive anatomy workspace

One mounted viewer serves Explore, Learn, Practice and My Review. Scene state controls rendering, hidden structures, opacity, camera commands and annotations. Rendering and picking share the visibility contract in app/viewer-state.ts. The opening view is skeletal; X-ray is explicitly illustrative. Wireframe samples triangles and mobile pixel ratio is capped.

## Clinical release

The twelve requested conditions live in app/study/content/conditions-draft.json. All remain provisional, with no claimed medical sign-off. Review the inventory, sources, prose, model mappings, limitations and objectives before recording genuine reviewer metadata. The publish command requires inventory approval and filters unapproved item dependencies. Production excludes draft imports. No pathological geometry is simulated.

## Verification and limitations

TypeScript, study tests, condition mapping validation, atlas validation, interaction contracts and production build were run. Desktop, 390px and 320px layouts were inspected in the browser. Study persistence schema and storage remain unchanged. Browser console showed no errors in the inspected workspace.

Inter installation was blocked by an automatic approval usage limit; the interface currently uses the configured system fallback. A same-device baseline GPU benchmark, complete browser regression of every lesson and physical touch-device testing are still outstanding. Do not interpret the automated contract tests as those measurements.
