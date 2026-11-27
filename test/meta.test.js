import test from 'node:test';
import assert from 'node:assert/strict';
import { Meta, migrate } from '../src/ui/meta.js';
import { Game } from '../src/sim/game.js';
const storage = () => { const d = new Map(); return { getItem:k=>d.get(k)||null, setItem:(k,v)=>d.set(k,v), removeItem:k=>d.delete(k) }; };
test('v1 migration preserves pearls/upgrades once, then removes legacy', () => {
 const s=storage(); s.setItem('jg_hunt_save_v1',JSON.stringify({pearls:237,upg:{fin:3,echo:2},runs:9}));
 const a=migrate(s); assert.equal(a.pearls,237); assert.equal(a.upg.fin,3); assert.equal(a.stats.runs,9);
 assert.equal(s.getItem('jg_hunt_save_v1'),null); a.pearls=17; s.setItem('jg_save_v2',JSON.stringify(a)); assert.equal(migrate(s).pearls,17);
});
test('settlement is idempotent, wages fail at 30%, missions use only this run', () => {
 const s=storage(), m=new Meta(s), r={level:1,outcome:'FADED',score:4000,stats:{fry:59}};
 const a=m.settle(r), pearls=m.pearls; assert.equal(a.pay,3); assert.equal(a.completed.length,0);
 m.settle(r); assert.equal(m.pearls,pearls);
 const next={level:1,outcome:'CLEARED',score:4000,stats:{fry:1}};
 assert.equal(m.settle(next).completed.some(x=>x.id==='fry60'),false);
});
test('unavailable storage degrades to memory and finishing unlocks next dream', () => {
 const m=new Meta({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});
 assert.equal(m.persistent,false); m.settle({level:1,outcome:'CLEARED',rank:'A',score:1000});
 assert.equal(m.levels[2].unlocked,true); assert.equal(m.levels[1].best,'A');
});
test('the actual simulation result settles once without double-counting wages', () => {
 const s=storage(),m=new Meta(s),g=new Game({meta:m.data,seed:91});g.start('bay').begin();
 g.stats.score=4000;g.pearls=7;g.storyFragments=new Set([0,1,2]);g.stats.fragments=3;
 g.melodies=new Set([0,2]);g.stats.melodies=2;g.stats.maxGatePerfects=3;g.addMem(760,100);
 g.stats.score=4000;
 const result=g.finish('CLEARED'),receipt=m.settle(result);
 assert.equal(receipt.pay,10+7+20+30);assert.equal(receipt.fragments,3);assert.equal(receipt.melodies,2);
 assert.ok(m.data.achievements.includes('giant'));assert.ok(m.data.achievements.includes('perfect3'));
 const reloaded=new Meta(s);assert.deepEqual(reloaded.levels[1].melodyIds,[0,2]);assert.equal(reloaded.data.lastSeed,91);
 const retry=new Game({meta:reloaded.data});retry.start('bay',{retry:true});
 assert.equal(retry.storyCount,3);assert.deepEqual([...retry.melodies],[0,2]);
});
test('readable legacy data remains available in memory if writes are blocked', () => {
 const old=JSON.stringify({pearls:77,upg:{fin:2}});
 const m=new Meta({getItem:k=>k==='jg_hunt_save_v1'?old:null,setItem(){throw Error('quota')},removeItem(){throw Error('must not delete')}});
 assert.equal(m.pearls,77);assert.equal(m.upg.fin,2);assert.equal(m.persistent,false);
});

