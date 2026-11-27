import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { replayHash } from './replay-hash.mjs';
import { Game } from '../src/sim/game.js';
import { Meta } from '../src/ui/meta.js';
import { LEVELS } from '../src/data/index.js';
import { controller, STEP } from './autoplay.mjs';

const out=resolve(process.argv.find(s=>s.startsWith('--out='))?.slice(6) ?? join(tmpdir(),'jingge-full-run'));
const seed=Number(process.argv.find(s=>s.startsWith('--seed='))?.slice(7)??21);
const meta=new Meta(null), game=new Game({seed,meta:meta.data});
mkdirSync(out,{recursive:true});
const report=[];
for (const level of LEVELS) {
  meta.fillMissions();
  game.start(level.key).begin();
  const nextInput=controller(game), inputs=[], events=[];
  const off=game.bus.on('*',(event,payload)=>{
    if(['state.change','fragment.collect','dream.deliver','melody.collect','evolve','boss.gate.result','boss.down','awakening','run.finish'].includes(event))
      events.push({frame:inputs.length,event,payload});
  });
  for(let frame=0;frame<60*900&&!game.ended;frame++) {
    const input=nextInput(frame); inputs.push(input);game.step(STEP,input);
  }
  off();
  const result=game.result;
  if(result)meta.settle(result);
  const snapshot=game.snapshot(), hash=replayHash(snapshot);
  const row={key:level.key,outcome:result?.outcome,story:game.storyCount,melody:game.melodyCount,time:game.time,frames:inputs.length,state:game.state,surface:game.surfaceTime,deep:game.deepTime,position:[game.player.x,game.player.y],conditions:game.conditions,tier:game.player.tier,mem:game.player.mem,hp:game.player.hp, boss:game.boss&&{phase:game.boss.phase,hp:game.boss.hp,gates:game.boss.gateHits},hash};
  report.push(row);console.log(JSON.stringify(row));
  writeFileSync(join(out,level.key+'.json'), JSON.stringify({seed,key:level.key,inputs,events,row,snapshot}));
  if(!result?.won)process.exitCode=1;
}
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
