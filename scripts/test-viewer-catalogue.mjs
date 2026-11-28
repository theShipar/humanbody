import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const atlas = JSON.parse(await readFile(new URL('../public/models/atlas.json', import.meta.url), 'utf8'));
const regions = JSON.parse(await readFile(new URL('../app/viewer/regions.json', import.meta.url), 'utf8'));
const valid = new Set(['head', 'torso', 'left-arm', 'right-arm', 'left-leg', 'right-leg']);
for (const part of atlas.parts) assert(valid.has(regions[part.id]), `Missing region: ${part.name}`);
for (const name of ['Third ventricle', 'Fourth ventricle', 'Interventricular foramen', 'Left lateral ventricle', 'Right lateral ventricle']) {
  const part = atlas.parts.find(p => p.name === name);
  assert.equal(part?.system, 'nervous', `${name} must not appear in the heart`);
  assert.equal(regions[part.id], 'head');
}
const heart = atlas.parts.filter(p => p.system === 'cardiac');
assert(heart.length > 10);
assert(heart.every(p => p.bounds[1][1] < 1.5), 'Heart preview contains a remote head structure');
for (const side of ['Left', 'Right']) {
  for (const [bone, region] of [['humerus', 'arm'], ['radius', 'arm'], ['ulna', 'arm'], ['femur', 'leg'], ['patella', 'leg']]) {
    const part = atlas.parts.find(p => p.name === `${side} ${bone}`);
    assert.equal(regions[part.id], `${side.toLowerCase()}-${region}`);
  }
}
for (const part of atlas.parts.filter(p => /thoracic vertebra|lumbar vertebra|rib$|pectoralis|rhomboid/i.test(p.name))) {
  assert.equal(regions[part.id], 'torso', `${part.name} should remain in the torso`);
}
console.log(`Viewer catalogue checks passed: ${atlas.parts.length} mapped parts, heart exclusions, sided limb bones and torso boundaries.`);
