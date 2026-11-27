const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { openBrowser } = require('./browser.cjs');

async function runSmoke(args = []) {
  const options = { preview: args.includes('--preview'), shots: args.includes('--shots'),
    out: args.find(value => value.startsWith('--out='))?.slice(6),
    legacy: { pearls: 137, runs: 12, upg: { belly: 2, fin: 1, fat: 0, echo: 3 } } };
  const harness = await openBrowser(options);
  const { page } = harness, checks = [], fixtures = [];
  const record = (name, condition, details) => { assert.ok(condition, `${name}: ${JSON.stringify(details)}`); checks.push({ name, details }); };
  const state = () => page.evaluate(() => ({ state: __jg2d.game.state, screen: __jg2d.screen,
    x: __jg2d.game.player.x, y: __jg2d.game.player.y, time: __jg2d.game.time,
    holding: __jg2d.game.song.holding, pearls: __jg2d.meta.pearls,
    muted: __jg2d.meta.settings.muted, audioMuted: __jg2d.audio.muted }));
  const waitScreen = name => page.waitForFunction(expected => __jg2d.screen === expected, name);
  const readonly = async label => {
    const unchanged = await page.evaluate(() => {
      const { game, renderer, meta } = __jg2d, before = JSON.stringify(game.snapshot());
      renderer.draw(game, .5, __jg2d.screen, meta);
      return JSON.stringify(game.snapshot()) === before;
    });
    record(`renderer does not mutate snapshot: ${label}`, unchanged);
  };
  let report;
  try {
    await harness.load();
    record('title loads', (await state()).screen === 'TITLE');
    const idleBefore=await page.evaluate(()=>({clock:__jg2d.renderer.clock,time:__jg2d.game.time}));
    await page.waitForFunction(clock=>__jg2d.renderer.clock>clock+.08,idleBefore.clock);
    const idleAfter=await page.evaluate(()=>({clock:__jg2d.renderer.clock,time:__jg2d.game.time}));
    record('palace idle animation runs while menu simulation remains frozen',idleAfter.clock>idleBefore.clock&&idleAfter.time===idleBefore.time,{idleBefore,idleAfter});
    const migration = await page.evaluate(() => ({ pearls: __jg2d.meta.pearls, upg: __jg2d.meta.upg,
      runs: __jg2d.meta.data.stats.runs, old: localStorage.getItem('jg_hunt_save_v1') }));
    record('legacy save migrates pearls and upgrades once', migration.pearls === 137 && migration.upg.echo === 3 && migration.runs === 12 && migration.old === null, migration);
    await page.reload(); await page.waitForFunction(() => __jg2d.ready);
    record('reload preserves migrated pearls', (await state()).pearls === 137);
    await harness.shot('01-title'); await readonly('title');
    await page.locator('[data-action="orders"]').click(); await waitScreen('ORDERS');
    record('five dispatch cards render', await page.locator('.order').count() === 5);
    await harness.shot('02-orders');
    await page.locator('[data-action="accept"]').click(); await waitScreen('BRIEF');
    record('brief opens', (await state()).state === 'BRIEF');
    await page.keyboard.press('Enter'); await waitScreen('PLAY');
    record('brief begins surface', (await state()).state === 'SURFACE');
    const beforeMove = await state();
    await page.keyboard.down('d'); await page.waitForTimeout(320); await page.keyboard.up('d');
    record('real keyboard moves player', (await state()).x > beforeMove.x + 15, { before: beforeMove.x, after: (await state()).x });
    await page.evaluate(()=>{__jg2d.game.player.dash=2;});
    await page.keyboard.down('d');await page.keyboard.down('Shift');
    await page.waitForFunction(()=>__jg2d.game.player.dashExhausted&&!__jg2d.game.player.dashing);
    const exhausted=await page.evaluate(()=>new Promise(resolve=>{
      const modes=new Set();let frames=0,restarts=0,invuln=0;
      const sample=()=>{const a=__jg2d;frames++;restarts+=Number(a.game.player.dashing);invuln=Math.max(invuln,a.game.player.invuln);modes.add(a.renderer.animator.state);
        if(frames<45)requestAnimationFrame(sample);else resolve({frames,restarts,invuln,modes:[...modes],stamina:a.game.player.dash});};requestAnimationFrame(sample);
    }));
    record('held exhausted sprint stays swimming instead of flashing between poses',exhausted.restarts===0&&exhausted.modes.every(mode=>mode==='swim')&&exhausted.invuln===0,exhausted);
    await page.keyboard.up('Shift');await page.waitForFunction(()=>!__jg2d.game.player.dashExhausted);
    await page.keyboard.down('Shift');await page.waitForFunction(()=>__jg2d.game.player.dashing);
    record('a fresh sprint press works after exhaustion and release',await page.evaluate(()=>__jg2d.game.player.dashing));
    await page.keyboard.up('Shift');await page.keyboard.up('d');
    await page.keyboard.down('f'); await page.waitForTimeout(160);
    record('real F key starts singing', (await state()).holding);
    await page.keyboard.press('Escape'); await waitScreen('PAUSE'); await page.keyboard.up('f');
    const paused = await state(); await page.waitForTimeout(160);
    record('pause freezes world and cancels held song', (await state()).time === paused.time && !paused.holding);
    await page.keyboard.press('Escape'); await waitScreen('PLAY');
    await page.keyboard.press('Tab'); await waitScreen('MAP');
    const mapped = await state(); await page.waitForTimeout(120);
    record('Tab map freezes world', (await state()).time === mapped.time && await page.locator('#map').count() === 1);
    await page.keyboard.press('Tab'); await waitScreen('PLAY');
    await page.locator('.play-tools [data-action="map"]').click();await waitScreen('MAP');
    record('on-screen map opens through the same pause path', await page.locator('#map').count() === 1);
    await page.locator('.map-panel [data-action="resume"]').click();await waitScreen('PLAY');
    await page.waitForFunction(()=>!__jg2d.game.blockHeld);
    await page.mouse.move(640,360);await page.mouse.down({button:'right'});
    await page.waitForFunction(()=>__jg2d.game.song.active);
    await page.mouse.up({button:'right'});
    await page.waitForFunction(()=>!__jg2d.game.song.active);
    record('right mouse button starts and releases whale song', true);
    await page.keyboard.press('m');
    record('M toggles saved mute setting', (await state()).muted && (await state()).audioMuted);
    await page.keyboard.press('Escape'); await waitScreen('PAUSE');
    await page.locator('[data-action="settings"]').click(); await waitScreen('SETTINGS');
    record('settings reflects mute', await page.locator('[data-setting="muted"]').isChecked());
    await page.locator('[data-setting="muted"]').uncheck();
    record('settings toggles mute back', !(await state()).muted);
    await page.locator('[data-action="settings.back"]').click(); await waitScreen('PAUSE');
    await page.locator('[data-action="resume"]').click(); await waitScreen('PLAY');
    await page.waitForFunction(() => !__jg2d.game.blockHeld && !__jg2d.game.song.blockedUntilUp);
    await page.keyboard.down('f');
    await page.waitForFunction(() => __jg2d.game.song.active && __jg2d.game.song.age >= __jg2d.game.song.phraseSeconds - .025);
    await page.keyboard.up('f');
    await page.waitForFunction(() => !__jg2d.game.song.active && !!__jg2d.game.song.lastRelease);
    const release = await page.evaluate(() => __jg2d.game.song.lastRelease);
    record('real F release is accepted at four-beat ring closure', ['perfect', 'good'].includes(release.quality), { quality: release.quality, error: release.error });
    await harness.shot('03-surface'); await readonly('surface');
    await page.evaluate(() => __jg2d.game.transition('DESCENT'));
    fixtures.push('Entered DESCENT directly to check its screen, rather than claiming natural surface completion.');
    record('descent screen opens', (await state()).state === 'DESCENT');
    await harness.shot('04-descent');
    await page.keyboard.press('Escape');
    const skip = await page.evaluate(() => __jg2d.game.descentTime);
    record('Escape skips descent to last section', skip >= 3, skip);
    await page.evaluate(() => __jg2d.step(310));
    record('descent reaches deep', (await state()).state === 'DEEP');
    await page.waitForFunction(()=>!__jg2d.game.blockHeld);
    const biteBefore=await page.evaluate(()=>__jg2d.game.player.biteId);
    await page.mouse.move(640,360);await page.mouse.down({button:'left'});
    await page.waitForFunction(id=>__jg2d.game.player.biteId>id,biteBefore);
    await page.mouse.up({button:'left'});
    record('left mouse button initiates a deep-dream lunge', true);
    await harness.shot('04-deep'); await readonly('deep');
    const levels = [1, 2, 3, 4, 5];
    const rendered = [];
    for (let index = 0; index < levels.length; index++) {
      const details = await page.evaluate(({ key, index }) => {
        const { game, renderer, meta } = __jg2d;
        // Fixture coverage deliberately bypasses collection and combat progress.
        game.start(key); game.begin(); renderer.step(game, .016); renderer.draw(game, .5, 'PLAY', meta);
        const actual = game.level.key;
        game.transition('DESCENT'); game.transition('DEEP'); renderer.step(game, .016); renderer.draw(game, .5, 'PLAY', meta);
        game.addMem(760, 0, 'browser-fixture'); game.enterBoss();
        game.boss.phase = 3; game.boss.intro = 0;
        game.player.x = game.boss.x - 280; game.player.y = game.boss.y + 80;
        game.player.prevX = game.player.x; game.player.prevY = game.player.y;
        renderer.camera.ready = false; renderer.step(game, .1); renderer.draw(game, .5, 'PLAY', meta);
        return { requested: key, actual, boss: game.boss.key, state: game.state,
          finite: Number.isFinite(game.player.x) && Number.isFinite(game.player.y), level: game.level.level };
      }, { key: levels[index], index });
      record(`level ${index + 1} surface/deep/boss render`, details.level === index + 1 && details.state === 'BOSS' && details.finite, details);
      rendered.push(details); await readonly(`boss ${details.boss}`);
      await page.waitForTimeout(80); await harness.shot(`${String(index + 5).padStart(2, '0')}-boss-${details.boss}`);
    }
    fixtures.push('Rendered all five levels using direct stage/size/Boss fixtures. This smoke check does not claim natural clears.');
    await page.evaluate(() => __jg2d.game.finish('CLEARED')); await waitScreen('DAWN');
    record('dawn receipt renders', await page.locator('.receipt-row').count() >= 6);
    record('dawn music is not suspended by its menu', await page.evaluate(() => !__jg2d.audio.userSuspended));
    await page.waitForTimeout(850);
    await harness.shot('10-dawn'); await readonly('dawn');
    const final = await state();
    await page.reload(); await page.waitForFunction(() => __jg2d.ready);
    record('receipt pearls survive reload', (await state()).pearls === final.pearls, { before: final.pearls, after: (await state()).pearls });
    for(const outcome of ['RESCUED','FADED','DEVOURED']){
      await page.evaluate(outcome=>{
        const {game}=__jg2d;
        game.start('bay');game.begin();
        if(outcome!=='RESCUED')game.transition('DEEP');
        if(outcome==='DEVOURED')game.enterBoss();
        game.finish(outcome);
      },outcome);
      await waitScreen('ENDING');
      record(outcome+' plays its own failure scene',await page.evaluate(outcome=>__jg2d.renderer.cinema.failure===outcome,outcome));
      await harness.shot('ending-'+outcome.toLowerCase());
      await page.keyboard.press('Escape');await waitScreen('DAWN');
    }
    fixtures.push('Forced the three outcomes to validate the individual scene and DAWN transition.');
    record('no browser page exceptions', harness.pageErrors.length === 0, harness.pageErrors);
    record('no console errors', harness.consoleErrors.length === 0, harness.consoleErrors);
    record('no failed resources, including favicon', harness.failures.length === 0, harness.failures);
    report = { ok: true, entry: harness.entry, checks, fixtures, rendered, consoleErrors: harness.consoleErrors,
      pageErrors: harness.pageErrors, resources: harness.failures, output: harness.output };
    console.log(JSON.stringify({ ok: true, checks: checks.length, entry: harness.entry, output: harness.output }));
    return report;
  } catch (error) {
    await harness.shot('failure').catch(() => {});
    report = { ok: false, entry: harness.entry, error: error.stack ?? String(error), state: await state().catch(() => null), checks, fixtures,
      consoleErrors: harness.consoleErrors, pageErrors: harness.pageErrors, resources: harness.failures, output: harness.output };
    throw error;
  } finally {
    fs.writeFileSync(path.join(harness.output, 'smoke-report.json'), JSON.stringify(report, null, 2));
    await harness.close();
  }
}

module.exports = { runSmoke };
if (require.main === module) runSmoke(process.argv.slice(2)).catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
