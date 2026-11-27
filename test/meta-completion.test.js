import test from 'node:test';
import assert from 'node:assert/strict';
import { Meta, validateSave, freshSave } from '../src/ui/meta.js';
import { Game } from '../src/sim/game.js';
import { ACHIEVEMENTS } from '../src/data/meta.js';
import { MISSIONS } from '../src/data/items.js';
import { LEVELS, BOSSES, DIALOGUE, SPECIES } from '../src/data/index.js';
import { SOUVENIRS, AFTER_STORIES, SPECIES_NOTES, CODEX_FIELDS } from '../src/data/narrative.js';
const storage=()=>{const d=new Map();return {getItem:k=>d.get(k)||null,setItem:(k,v)=>d.set(k,v),removeItem:k=>d.delete(k)};};
const finish=(m,n,extra={})=>m.settle({level:n,outcome:'CLEARED',score:0,stats:{},...extra});

test('five independent later stories and all codex behaviour fields are authored',()=>{
 assert.equal(AFTER_STORIES.length,5);assert.equal(SOUVENIRS.length,5);
 assert.equal(new Set(SOUVENIRS.map(s=>s.id)).size,5);
 assert.equal(new Set(SOUVENIRS.map(s=>s.slot)).size,5);
 for(const entry of AFTER_STORIES){
  const story=DIALOGUE[entry.textKey];assert.ok(story?.length>12);
  assert.notEqual(story,DIALOGUE['boss.'+LEVELS[entry.level-1].boss+'.defeat']);
 }
 for(const kind of Object.keys(SPECIES))for(const field of CODEX_FIELDS)assert.ok(DIALOGUE[SPECIES_NOTES[kind][field]]);
 for(const level of LEVELS){
  for(let i=0;i<3;i++)assert.ok(DIALOGUE[`level.${level.level}.fragment.${i}`].length<=40);
  const lines=['enter','phase2','gate','phase3',level.boss==='gemini'?'instrument':'hurt','defeat'];
  assert.equal(lines.filter(key=>DIALOGUE[`boss.${level.boss}.${key}`]).length,6);
  assert.equal(BOSSES[level.boss].key,level.boss);
 }
});

test('awakening requires fifteen unique saved melodies and survives reload, including legacy counts',()=>{
 const s=storage(),m=new Meta(s);
 for(let n=1;n<=4;n++)finish(m,n,{melodies:[0,1,2]});
 finish(m,5,{melodies:[0,0,1,99]});assert.equal(m.awakening,false);
 finish(m,5,{melodies:[2]});assert.equal(m.awakening,true);
 const reload=new Meta(s);assert.equal(reload.data.unlocks.awakening,true);
 const legacy=freshSave();for(const l of Object.values(legacy.levels))l.melody=3;
 assert.equal(validateSave(legacy).unlocks.awakening,true);
 assert.equal(validateSave({unlocks:{awakening:true}}).unlocks.awakening,false);
});

test('failure streak is per dream, optional assistance persists, and a clear resets it',()=>{
 const s=storage(),m=new Meta(s);
 for(let i=0;i<2;i++)m.settle({level:2,outcome:'FADED',score:0});
 assert.equal(m.levels[2].failures,2);assert.equal(m.levels[1].failures,0);
 assert.equal(m.settings.assistance,false);m.settings.assistance=true;m.save(true);
 const reload=new Meta(s);assert.equal(reload.settings.assistance,true);assert.equal(reload.levels[2].failures,2);
 finish(reload,2);assert.equal(reload.levels[2].failures,0);
});

test('invalid collection ids cannot unlock collection achievements or poison room identities',()=>{
 const m=validateSave({souvenirs:[1,1,2,0,6,'3'],codex:{species:['fry','invalid','fry'],fragments:['1-1','9-1'],hearts:[1,9]}});
 assert.deepEqual(m.souvenirs,[1,2]);assert.deepEqual(m.codex.species,['fry']);
 assert.deepEqual(m.codex.fragments,['1-1']);assert.deepEqual(m.codex.hearts,[1]);
});

test('every achievement is awarded by real game results and permanent collections reload intact',()=>{
 const s=storage(),m=new Meta(s);
 for(let n=1;n<=5;n++){
  const g=new Game({meta:m.data,seed:n});g.start(LEVELS[n-1].key).begin();
  Object.assign(g.stats,{fry:60,abyss:1,hits:0,bossHits:0,dashSeconds:0,calmed:3,nightmaresSlept:3,maxGatePerfects:3,maxChain:12,perfects:10,shortcuts:2,souvenir:1,delivered:20});
  g.stats.fragments=3;g.stats.melodies=3;g.storyFragments=new Set([0,1,2]);g.melodies=new Set([0,1,2]);
  g.usedShortcuts=new Set(['a','b']);g.seen=new Set(Object.keys(SPECIES));g.delivered=20;g.souvenir=n;g.addMem(760,100);
  m.settle(g.finish('CLEARED'));
 }
 assert.deepEqual([...m.data.achievements].sort(),ACHIEVEMENTS.map(a=>a.id).sort());
 const reload=new Meta(s);assert.deepEqual(reload.data.souvenirs,[1,2,3,4,5]);
 assert.equal(reload.data.codex.fragments.length,15);assert.equal(reload.data.codex.hearts.length,5);
 assert.equal(reload.data.achievements.length,20);
});

test('all twelve mission conditions settle from the run snapshot and fifth-night task is scoped',()=>{
 for(const mission of MISSIONS){
  const m=new Meta(storage());for(const l of Object.values(m.levels))l.cleared=true;
  m.data.missions.active=[mission.id];
  const g=new Game({meta:m.data,seed:1});g.start(LEVELS[mission.level-1].key).begin();
  g.stats[mission.stat]=mission.target;g.time=mission.stat==='seconds'?mission.target:0;
  if(mission.stat==='fragments')g.storyFragments=new Set([0,1,2]);
  if(mission.stat==='melodies')g.melodies=new Set([0,1,2]);
  if(mission.stat==='souvenir')g.souvenir=mission.level;
  const result=g.finish('CLEARED');m.data.missions.active=[];
  assert.ok(m.settle(result).completed.some(x=>x.id===mission.id),mission.id);
 }
 const m=new Meta(storage());m.data.missions.active=['win'];
 assert.equal(finish(m,1).completed.some(x=>x.id==='win'),false);
});

test('three eligible task slots refill and collection carryover never becomes a task reward',()=>{
 const m=new Meta(storage());assert.equal(m.data.missions.active.length,3);
 m.data.missions.done=['fry60','frag3','chain12'];m.fillMissions();
 assert.ok(m.data.missions.active.includes('perfect3'));assert.ok(m.data.missions.active.includes('hidden'));
 m.data.missions.active=['frag3','melody','hidden'];
 const r={level:1,outcome:'CLEARED',fragments:[0,1,2],melodies:[0,1,2],delivered:40,stats:{fragments:0,melodies:0,delivered:0}};
 const receipt=m.settle(r);assert.equal(receipt.taskPay,0);assert.equal(m.data.stats.totalDreams,0);
 assert.equal(m.levels[1].fragments.reduce((a,b)=>a+b),3);assert.equal(m.levels[1].melody,3);
});
