import test from 'node:test';
import assert from 'node:assert/strict';
import { Animator, framePosition } from '../src/render/animation.js';
import { ANIMATION } from '../src/data/render.js';
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
test('swim phase remains continuous through speed changes and stopping',()=>{
 const a=new Animator(),p=player();
 for(let i=0;i<30;i++)a.step(p,1/60);
 const idlePhase=a.phase;p.vx=195;
 let previous=a.phase;
 for(let i=0;i<30;i++){a.step(p,1/60);assert.ok(a.phase>previous);assert.ok(a.phase-previous<.03);previous=a.phase;}
 assert.equal(a.state,'swim');assert.ok(a.phase>idlePhase);
 p.vx=0;for(let i=0;i<60;i++)a.step(p,1/60);
 assert.equal(a.state,'idle');assert.ok(a.phase>previous);
});
test('outgoing pose retains its own frozen clock while incoming action starts',()=>{
 const a=new Animator(),p=player();for(let i=0;i<30;i++)a.step(p,1/60);
 p.singing=true;a.step(p,1/60);
 assert.equal(a.old,'idle');assert.equal(a.state,'sing');assert.equal(a.clock,0);
 const oldClock=a.oldClock,oldPhase=a.oldPhase;
 a.step(p,1/60);a.step(p,1/60);
 assert.equal(a.oldClock,oldClock);assert.equal(a.oldPhase,oldPhase);assert.ok(a.clock>0);assert.ok(a.phase>oldPhase);
});
test('reversal has an intermediate facing and can reverse again without snapping',()=>{
 const a=new Animator(),p=player();p.dir=-1;a.step(p,1/60);
 assert.ok(a.facing<1&&a.facing>0);
 let last=a.facing;for(let i=0;i<5;i++){a.step(p,1/60);assert.ok(a.facing<last);last=a.facing;}
 p.dir=1;a.step(p,1/60);assert.ok(Math.abs(a.facing-last)<.1);
 for(let i=0;i<30;i++)a.step(p,1/60);assert.equal(a.facing,1);
 assert.ok(ANIMATION.minTurnWidth>=.25);
});
test('automatic eating while swimming does not replace locomotion on every fry',()=>{
 const a=new Animator(),p=player();p.vx=195;
 for(let i=0;i<30;i++)a.step(p,1/60);assert.equal(a.state,'swim');
 for(let i=0;i<20;i++){a.trigger('eat');a.step(p,1/60);assert.equal(a.state,'swim');}
 a.trigger('hurt');a.step(p,1/60);assert.equal(a.state,'hurt');
});
test('cached loop sampling is fractional and crosses the final frame continuously',()=>{
 const loop={loop:true,frames:Array(24)},once={loop:false,frames:Array(10)};
 assert.equal(framePosition(loop,.125),3);assert.ok(Math.abs(framePosition(loop,.13)-3.12)<1e-12);
 assert.ok(framePosition(loop,.999)>23.9);assert.equal(framePosition(loop,1),0);
 assert.equal(framePosition(once,1.5),9);assert.equal(framePosition(once,-1),0);
});
