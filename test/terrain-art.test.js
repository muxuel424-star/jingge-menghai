import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSolid, terrainColors } from '../src/render/terrain-art.js';
import { SEA } from '../src/render/palette.js';

test('view metadata preserves collision geometry and accounts for both polygon windings',()=>{
 const vertices=[{x:20,y:30},{x:320,y:30},{x:320,y:230},{x:20,y:230}];
 for(const points of [vertices,[...vertices].reverse()]){
  const solid={points},before=JSON.stringify(solid),art=describeSolid(solid,2);
  assert.equal(JSON.stringify(solid),before);
  assert.equal(art.left,20);assert.equal(art.right,320);assert.equal(art.top,30);assert.equal(art.bottom,230);
  for(const edge of art.edges){
   const middle={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2};
   assert.ok((art.cx-middle.x)*edge.nx+(art.cy-middle.y)*edge.ny>0,'bevel must go into the solid, never into playable water');
  }
 }
});
test('ellipse art retains the exact physical extents and deterministic structural layout',()=>{
 const solid={x:520,y:410,rx:230,ry:140},a=describeSolid(solid,4),b=describeSolid(solid,4);
 assert.equal(a.left,290);assert.equal(a.right,750);assert.equal(a.top,270);assert.equal(a.bottom,550);
 assert.deepEqual(a,b);assert.equal(a.solid,solid);
});
test('all five themes retain distinct cel materials in surface and deep light',()=>{
 const styles=SEA.map(p=>terrainColors(p,false));
 assert.equal(new Set(styles.map(p=>p.body)).size,5);
 for(let i=0;i<SEA.length;i++){
  const deep=terrainColors(SEA[i],true);
  assert.notEqual(deep.body,styles[i].body);
  for(const color of Object.values(deep))assert.match(color,/^#[0-9a-f]{6}$/i);
 }
});
