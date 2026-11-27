import test from 'node:test';
import assert from 'node:assert/strict';
import { ellipse } from '../src/data/levels/shared.js';
import { LEVELS } from '../src/data/index.js';
import { describeSolid } from '../src/render/terrain-art.js';

function signedArea(points) {
 return points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.y-b.x*a.y;},0)/2;
}
test('authored reef outlines stay inside old ellipses and become the actual collision polygon',()=>{
 let count=0;
 for(const level of LEVELS)for(const scene of [level.surface,level.deep])for(const solid of scene.solids){
  if(!solid.rx||!solid.ry)continue;
  count++;assert.equal(solid.shape,'polygon');assert.ok(solid.points.length>=12&&solid.points.length<=24);
  assert.ok(signedArea(solid.points)>0);
  for(let i=0;i<solid.points.length;i++){
   const a=solid.points[i],b=solid.points[(i+1)%solid.points.length];
   for(const f of [0,.25,.5,.75,1]){
    const u=(a.x+(b.x-a.x)*f-solid.x)/solid.rx,v=(a.y+(b.y-a.y)*f-solid.y)/solid.ry;
    assert.ok(u*u+v*v<=1,'coast cannot expand rock into an existing swimming route');
   }
  }
  const art=describeSolid(solid);
  assert.equal(art.points,solid.points,'rendering must prefer the same polygon used by collision');
 }
 assert.ok(count>=20);
});
test('coastline choice is fixed by authored coordinates and uses several distinct silhouettes',()=>{
 const variants=new Set();
 for(let i=0;i<30;i++){
  const args=[140+i*127,500+i*13,220,150],a=ellipse(...args),b=ellipse(...args);
  assert.deepEqual(a,b);assert.equal(a.x,args[0]);assert.equal(a.rx,220);assert.equal(a.ry,150);
  variants.add(a.coastline);
 }
 assert.equal(variants.size,3);
});
