const { openBrowser } = require('./browser.cjs');
const { copyFileSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const assert = require('node:assert/strict');

const arg = (key, fallback) => process.argv.find(a => a.startsWith(key+'='))?.slice(key.length+1) ?? fallback;
const inputDir = resolve(arg('--input',join(tmpdir(),'jingge-full-run')));
const out = resolve(arg('--out',join(tmpdir(),'jingge-browser-replay')));
const record = process.argv.includes('--record');
const report = [];
async function run() {
  const {replayHash}=await import('./replay-hash.mjs');
  const levels=JSON.parse(readFileSync(join(inputDir,'report.json'),'utf8'));
  mkdirSync(out,{recursive:true});
  const h=await openBrowser({out,shots:true,recordVideo:record?{dir:out,size:{width:960,height:540}}:undefined});
  try {
    await h.context.addInitScript(() => {
      // The test advances simulation and rendering from the recorded input clock.
      window.requestAnimationFrame = () => 0;
    });
    await h.load();
    await h.page.evaluate(()=>{const a=__jg2d;a.renderer.draw(a.game,1,a.screen,a.meta);});
    await h.shot('01-title');
    let index=0;
    for (const level of levels) {
      const replay=JSON.parse(readFileSync(join(inputDir,level.key+'.json'),'utf8'));
      assert.equal(replay.row.outcome,'CLEARED');
      const start=await h.page.evaluate(seed=>{
        const app=__jg2d;app.game.seed=seed;app.renderer.draw(app.game,1,app.screen,app.meta);return app.screen;
      },replay.seed);
      assert.equal(start,'TITLE');
      if(record)await h.page.waitForTimeout(750);
      await h.page.locator('[data-action="orders"]').click();
      await h.page.locator('[data-action="select"][data-level="'+(++index)+'"]').click();
      await h.page.locator('[data-action="accept"]').click();
      assert.equal(await h.page.evaluate(()=>__jg2d.screen),'BRIEF');
      if(record)await h.page.waitForTimeout(750);
      await h.page.locator('[data-action="begin"]').click();

      const observed=await h.page.evaluate(async ({replay,record})=>{
        const app=__jg2d, g=app.game, step=1/60, states=[g.state], events=[];
        const off=g.bus.on('*',(name,p)=>{
          if (['fragment.collect','melody.collect','boss.gate.result','boss.down','awakening'].includes(name))
            events.push([name,p.quality??null]);
        });
        g.events.length=0;
        const pace=record?setTimeout:null;
        let display=performance.now(), afterStep=display, screenshots=[];
        for(let i=0;i<replay.inputs.length;i++){
          const inCinematic=g.state==='DESCENT'||g.state==='BOSS'||g.evolutionTimer>0||g.counterkill;
          app.step(1,replay.inputs[i]);app.renderer.step(g,step); app.audio.update(g);
          const changed=states.at(-1)!==g.state;
          if(changed)states.push(g.state);
          const milestone=changed||g.state==='DESCENT'&&Math.abs(g.descentTime-3.5)<step/2||g.boss?.down&&Math.abs(g.boss.defeatTimer-1.5)<step/2;
          if(milestone||record&&i%2===0||i+1===replay.inputs.length){
            app.renderer.draw(g,1,app.screen,app.meta);
            if(record){
              afterStep=performance.now();
              display=Math.max(display+(inCinematic?1000/30:1000/120),afterStep);
              await new Promise(resolve=>pace(resolve,Math.max(0,display-afterStep)));
            }
          }
          if(milestone)
            screenshots.push({state:g.state,frame:i,canvas:app.renderer.canvas.toDataURL('image/webp',.88)});
        }
        off();
        const snapshot=g.snapshot();return {snapshot,states,events,screenshots,screen:app.screen,grade:g.result?.grade};
      },{replay,record});
      const hash=replayHash(observed.snapshot);
      if(hash!==replay.row.hash)writeFileSync(join(out,level.key+'-mismatch.json'),JSON.stringify({node:replay.snapshot,browser:observed.snapshot},null,2));
      assert.deepEqual(observed.states,['SURFACE','DESCENT','DEEP','BOSS','DAWN'],level.key);
      assert.equal(observed.screen,'DAWN');
      assert.equal(hash,replay.row.hash,level.key+' browser replay hash');
      for (const [id,s] of observed.screenshots.entries()) {
        const name=index+'-'+level.key+'-'+id+'-'+s.state+'.webp';
        writeFileSync(join(out,name),Buffer.from(s.canvas.split(',')[1],'base64'));
      }
      await h.shot(index+'-'+level.key+'-receipt');
      if(record)await h.page.waitForTimeout(1600);
      report.push({key:level.key,hash,states:observed.states,grade:observed.grade,events:observed.events});
      console.log(level.key+' '+observed.screen+' '+hash.slice(0,10));
      await h.page.locator('[data-action="orders"]').click();
      await h.page.locator('[data-action="home"]').click();
    }
    assert.deepEqual(h.consoleErrors,[]);assert.deepEqual(h.pageErrors,[]);assert.deepEqual(h.failures,[]);
    writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
  } finally {
    const video=h.page.video();
    const videoPath=video?await video.path():null;
    await h.close();
    if(videoPath)copyFileSync(videoPath,join(out,'campaign.webm'));
  }
}
run().catch(error=>{console.error(error.stack);process.exitCode=1;});
