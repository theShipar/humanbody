import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {evaluateTimeline,advanceTimeline} from '../app/clinical/timeline.ts';
import {validateScenarios} from '../app/clinical/validate.ts';
const read=async name=>JSON.parse(await readFile(new URL(name,import.meta.url)));
const drafts=await read('../app/clinical/drafts.json'),published=await read('../app/clinical/published.json'),assets=await read('../app/clinical/assets.json'),specialties=await read('../app/clinical/specialties.json'),inventory=await read('../app/clinical/inventory.json'),atlas=await read('../public/models/atlas.json');
const concepts=new Set(atlas.concepts.map(c=>c.id));
assert.equal(specialties.length,27);assert.equal(inventory.flatMap(g=>g.slots).length,270);
assert.deepEqual(validateScenarios(drafts,assets,specialties,concepts),[]);
assert.deepEqual(validateScenarios(published,assets,specialties,concepts,true),[]);
for(const s of published)for(const id of s.specialtyIds){const group=inventory.find(g=>g.specialtyId===id);assert.ok(group?.status==='approved'&&group.reviewer?.trim()&&Number.isFinite(Date.parse(group.reviewedAt)),`${id}: published scenario lacks inventory approval`);}

assert.ok(validateScenarios(drafts,assets,specialties,concepts,true).length>=2);
for(const scenario of drafts)for(const track of scenario.tracks){
 assert.equal(evaluateTimeline(track,-2).index,0);assert.equal(evaluateTimeline(track,Infinity).index,0);
 assert.equal(evaluateTimeline(track,999).index,track.stages.length-1);
 const before=JSON.stringify(track);advanceTimeline(track,0,1000,2);evaluateTimeline(track,999);
 const stepped=advanceTimeline(track,advanceTimeline(track,0,500,1).position,500,1); assert.deepEqual(stepped,advanceTimeline(track,0,1000,1));
 const reset=evaluateTimeline(track,0);assert.equal(reset.stage.id,track.stages[0].id);assert.equal(JSON.stringify(track),before);
 assert.equal(advanceTimeline(track,0,1000,2).position,.4);
 assert.equal(evaluateTimeline(track,0).stage.id,track.stages[0].id);
}
const bad=structuredClone(drafts);bad[0].tracks[0].stages[0].assetIds=['missing'];assert.ok(validateScenarios(bad,assets,specialties,concepts).some(e=>e.includes('asset')));
if(process.argv.includes('--release')){
 for(const specialty of specialties){const count=published.filter(s=>s.specialtyIds.includes(specialty.id)).length;assert.equal(count,10,`${specialty.title}: launch needs 10 approved scenarios; currently ${count}`);}
 for(const group of inventory)assert.equal(group.status,'approved',`${group.specialtyId}: inventory approval required`);
}
console.log(`Clinical tests passed: ${specialties.length} specialties, 270 proposed inventory slots, ${drafts.length} draft scenarios, ${published.length} published. Timeline clamping, deterministic evaluation, references and asset gates passed.`);
