import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {pairCompatible,visibleAssets,disposeAsset,loadModelAsset} from '../app/clinical/asset-runtime.ts';
const asset={id:'a',references:['https://example.com/fixture'],version:'1',kind:'model',format:'glb',url:'/fixture.glb',status:'approved',reviewer:'Fixture reviewer',reviewedAt:'2026-01-01',role:'affected',bounds:{min:[-1,-1,-1],max:[1,1,1]},units:'m',pairId:'b',stageIds:['one'],registration:{space:'fixture',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}};
const other={...asset,id:'b',pairId:'a',role:'reference'};
assert.equal(pairCompatible(asset,other),true);assert.equal(pairCompatible(asset,{...other,units:'mm'}),false);assert.equal(pairCompatible(asset,{...other,status:'draft'}),false);
assert.deepEqual(visibleAssets([asset],'two'),[]);assert.deepEqual(visibleAssets([asset],'one'),[asset]);assert.deepEqual(visibleAssets([{...asset,status:'draft'}],'one'),[]);
let geometryDisposed=false,materialDisposed=false;const root=new Group(),geometry=new BoxGeometry(),material=new MeshStandardMaterial();geometry.addEventListener('dispose',()=>geometryDisposed=true);material.addEventListener('dispose',()=>materialDisposed=true);root.add(new Mesh(geometry,material));const parent=new Group();parent.add(root);disposeAsset(root);assert.ok(geometryDisposed&&materialDisposed);assert.equal(root.parent,null);
const original=globalThis.fetch;globalThis.fetch=async (_url,{signal})=>{signal.throwIfAborted();throw new Error('fixture unavailable');};const controller=new AbortController();controller.abort();await assert.rejects(loadModelAsset(asset,controller.signal),{name:'AbortError'});await assert.rejects(loadModelAsset(asset,new AbortController().signal),/fixture unavailable/);globalThis.fetch=original;

console.log('Workspace asset tests passed: pairing, stage visibility, cancellation, failure and resource disposal.');
// Minimal original triangle fixture exercises the actual GLB parser and transform.
const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]};
const encoded=Buffer.from(JSON.stringify(json));const jsonLength=Math.ceil(encoded.length/4)*4;const glb=Buffer.alloc(12+8+jsonLength+8+36,32);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(jsonLength,12);glb.writeUInt32LE(0x4e4f534a,16);encoded.copy(glb,20);glb.writeUInt32LE(36,20+jsonLength);glb.writeUInt32LE(0x004e4942,24+jsonLength);Buffer.from(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer).copy(glb,28+jsonLength);
globalThis.location={href:'http://localhost/'};globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength)});
const loaded=await loadModelAsset({...asset,registration:{...asset.registration,position:[2,3,4]}},new AbortController().signal);assert.deepEqual(loaded.position.toArray(),[2,3,4]);assert.ok(loaded.children.length);disposeAsset(loaded);globalThis.fetch=original;delete globalThis.location;
console.log('Original technical GLB fixture parsed, registered and disposed successfully.');
