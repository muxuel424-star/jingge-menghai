import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { movePlayer } from '../src/sim/systems/movement.js';
import { Animator } from '../src/render/animation.js';
const dt=1/60;
function fixture(){
 const g=new Game();g.state='SURFACE';
 // Open water isolates stamina/input from attacks, terrain and the invulnerability flash.
 g.terrain={resolve(){}};
 const animator=new Animator();
 let starts=0;g.bus.on('dash',()=>starts++);
 return {g,animator,get starts(){return starts;},step(input,frames=1){for(let i=0;i<frames;i++){movePlayer(g,dt,{x:1,y:0,...input});animator.step(g.player,dt);}}};
}
test('holding sprint through exhaustion starts once, then remains swimming while stamina recovers',()=>{
 const f=fixture();f.step({dash:true},240);
 assert.equal(f.g.player.dashing,false);assert.equal(f.g.player.dashExhausted,true);
 assert.equal(f.starts,1);assert.equal(f.animator.state,'swim');
 for(let i=0;i<600;i++){
  f.step({dash:true});
  assert.equal(f.g.player.dashing,false);assert.equal(f.animator.state,'swim');
 }
 assert.equal(f.g.player.dash,100);assert.equal(f.starts,1);
 assert.equal(f.g.player.invuln,0);assert.equal(f.g.player.hp,100);
});
test('releasing an exhausted sprint re-arms it for the next keyboard or touch press',()=>{
 const f=fixture();f.step({dash:true},240);
 f.step({dash:false});assert.equal(f.g.player.dashExhausted,false);
 f.step({dash:true});
 assert.equal(f.g.player.dashing,true);assert.equal(f.animator.state,'dash');assert.equal(f.starts,2);
});
test('holding sprint with empty stamina cannot enter a one-frame regeneration loop',()=>{
 const f=fixture();f.g.player.dash=0;f.step({dash:true},300);
 assert.equal(f.starts,0);assert.equal(f.g.player.dashing,false);assert.equal(f.g.player.dash,100);
 f.step({dash:false});f.step({dash:true});
 assert.equal(f.starts,1);assert.equal(f.g.player.dashing,true);
});
