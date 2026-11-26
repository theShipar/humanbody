import type { Atlas } from '../anatomy';
import type { Capability,VisualAsset } from './types';
export function capabilities(atlas:Atlas,conceptIds:string[],assets:VisualAsset[]):Capability[]{
 return conceptIds.map(conceptId=>{const modeled=atlas.concepts.some(c=>c.id===conceptId&&c.elements.length>0);const linked=assets.filter(a=>a.conceptIds.includes(conceptId));return {conceptId,method:modeled?'modeled':linked.some(a=>a.kind==='diagram')?'diagram-only':'unavailable',assetIds:linked.map(a=>a.id)};});
}
