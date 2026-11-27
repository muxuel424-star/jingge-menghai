import test from 'node:test';
import assert from 'node:assert/strict';
import { Animator } from '../src/render/animation.js';
const player=()=>({biteId:0,tier:0,vx:0,vy:0,dir:1,singing:false,dashing:false});
test('holding continuous bite restarts its motion instead of freezing on the last frame',()=>{
 const a=new Animator(),p=player();p.biteId=1;a.step(p,1/60);
 for(let i=0;i<12;i++)a.step(p,1/60);
 assert.equal(a.state,'bite');assert.ok(a.clock>.1);
 p.biteId=2;a.step(p,1/60);assert.equal(a.state,'bite');assert.equal(a.clock,0);
 a.trigger('hurt');a.step(p,1/60);assert.equal(a.state,'hurt');
});
test('returning to a new run cannot trigger a phantom bite from a reset identifier',()=>{
 const a=new Animator(),p=player();p.biteId=5;a.step(p,1/60);p.biteId=0;a.step(p,1/60);
 assert.equal(a.state,'idle');
});

