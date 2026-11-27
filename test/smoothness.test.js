import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { EventBus } from '../src/sim/bus.js';
import { createFish } from '../src/sim/entities/fish.js';
import { tickFeeding } from '../src/sim/systems/feeding.js';
import { Camera } from '../src/render/camera.js';
import { Effects } from '../src/render/fx.js';
test('swimming through small fry does not freeze the world, a big lunge still has impact',()=>{
 const g=new Game();g.start('bay').begin();g.transition('DEEP');
 let f=createFish('fry',g.player.x,g.player.y,100,g.rng);g.entities.fish=[f];g.player.biteWindow=0;
 tickFeeding(g);assert.equal(g.player.mem,3);assert.equal(g.hitstop,0);
 g.addMem(260,100);g.evolutionTimer=0;g.player.biteWindow=.1;g.player.hitIds.clear();
 f=createFish('lantern',g.player.x,g.player.y,101,g.rng);g.entities.fish=[f];
 tickFeeding(g);assert.ok(g.hitstop>0);assert.ok(f.eaten);
});
test('missing a bite has no camera shake and dense impacts do not compound into jitter',()=>{
 const bus=new EventBus(),camera=new Camera();new Effects(bus,camera,{trigger(){}});
 bus.emit('bite',{hit:false});assert.equal(camera.shake,0);
 bus.emit('bite',{hit:true});assert.equal(camera.shake,4);
 for(let i=0;i<12;i++)bus.emit('eat',{kind:'fry'});
 assert.equal(camera.shake,4);
 bus.emit('hurt',{amount:10});assert.equal(camera.shake,8);
});
test('impact pauses keep interpolation fixed instead of replaying the previous movement segment',()=>{
 const g=new Game();g.start('bay').begin();g.step(1/60,{});g.step(1/60,{x:1});
 assert.notEqual(g.player.prevX,g.player.x);
 const x=g.player.x;g.hitstop=.06;g.step(1/60,{x:1});
 assert.equal(g.player.x,x);assert.equal(g.player.prevX,x);
});
