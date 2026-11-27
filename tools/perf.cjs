const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { openBrowser } = require('./browser.cjs');

const LEVEL_KEYS = ['bay', 'porcelain', 'violet', 'magma', 'sanctuary'];
const LIMITS = { fps: 45, simMs: 3, drawMs: 12, drawImages: 260, readyMs: 3000, memoryMB: 220 };

function argument(args, key, fallback) {
  const index = args.indexOf(key);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return args.find(arg => arg.startsWith(key + '='))?.slice(key.length + 1) ?? fallback;
}

/** Rendering load fixtures, not a gameplay or progression acceptance test. */
async function fixture(page, key, boss, index) {
  await page.keyboard.up('d'); await page.keyboard.up('j'); await page.keyboard.up('f');
  return page.evaluate(({ key, boss, index }) => {
    const app = window.__jg2d, game = app.game;
    game.start(key); game.begin(); game.transition('DEEP');
    game.addMem(760, 100); game.evolutionTimer = 0;
    game.player.invuln = 1000000;
    if (boss) {
      game.enterBoss();
      // Start a phase-three attack load without pretending to have beaten phases one/two.
      game.boss.phase = 3; game.boss.recovery = 0;
      game.emit('boss.phase', { key: game.boss.key, phase: 3 });
    } else {
      const route = game.scene.mainPath;
      const point = route[Math.min(route.length - 1, Math.floor(route.length * .25))] ?? game.scene.spawn;
      game.player.x = point.x; game.player.y = point.y;
      game.player.prevX = point.x; game.player.prevY = point.y;
      game.terrain.resolve(game.player);
    }
    app.audio.setMuted(true); // Synthesis remains active; only the output master is muted.
    app.renderer.camera.ready = false;
    window.__jgPerf.scene = index;
    return { key, state: game.state, tier: game.player.tier, fish: game.fish.length,
      hazards: game.entities.hazards.length, boss: game.boss?.key ?? null };
  }, { key, boss, index });
}

async function runPerf(args = process.argv.slice(2)) {
  const seconds = Number(argument(args, '--seconds', '60'));
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 600) throw new Error('--seconds must be between 5 and 600.');
  const out = argument(args, '--out', path.join(os.tmpdir(), 'jingge-perf-check'));
  const check = await openBrowser({ preview: args.includes('--preview') || args.includes('--preview=v2'), out,
    viewport: { width: 1920, height: 1080 } });
  let cdp;
  try {
    const bundle = fs.readFileSync(path.resolve(__dirname,'..',check.entry));
    const started = performance.now(); await check.load(); const readyMs = performance.now() - started;
    // A real browser gesture unlocks audio so its normal scheduler is part of the sample.
    await check.page.locator('[data-action="orders"]').click();
    cdp = await check.context.newCDPSession(check.page);
    const browserVersion = await cdp.send('Browser.getVersion');
    const heap = [], scenarios = [];
    await check.page.evaluate(capacity => {
      const store = window.__jgPerf = { scene: 0, n: 0, stopped: false, previous: 0,
        data: Array.from({ length: 6 }, () => new Float64Array(capacity)) };
      const sample = timestamp => {
        if (store.stopped) return;
        if (store.previous && store.n < capacity) {
          const app = window.__jg2d, i = store.n++;
          store.data[0][i] = timestamp - store.previous;
          store.data[1][i] = app.metrics.simMs;
          store.data[2][i] = app.renderer.metrics.drawMs;
          store.data[3][i] = app.metrics.frameMs;
          store.data[4][i] = app.renderer.metrics.drawImages;
          store.data[5][i] = store.scene;
        }
        store.previous = timestamp; requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, Math.ceil(seconds * 300) + 1000);
    const samplingStarted = performance.now(), durationMs = seconds * 1000 / (LEVEL_KEYS.length * 2);
    for (const key of LEVEL_KEYS) {
      for (const boss of [false, true]) {
        const index = scenarios.length;
        const scene = await fixture(check.page, key, boss, index);
        scenarios.push({ ...scene, name: key + (boss ? '/boss-phase-3' : '/deep'), index });
        await check.page.keyboard.down(boss ? 'f' : 'd');
        if (!boss) await check.page.keyboard.down('j');
        const until = performance.now() + durationMs;
        while (performance.now() < until) {
          await check.page.waitForTimeout(Math.min(1000, Math.max(1, until - performance.now())));
          const usage = await cdp.send('Runtime.getHeapUsage');
          heap.push({ seconds: (performance.now() - samplingStarted) / 1000, scene: index,
            usedMB: usage.usedSize / 1048576, totalMB: usage.totalSize / 1048576,
            embedderMB: usage.embedderHeapUsedSize === undefined ? null : usage.embedderHeapUsedSize / 1048576,
            backingStorageMB: usage.backingStorageSize === undefined ? null : usage.backingStorageSize / 1048576 });
        }
        console.log('sampled ' + scenarios[index].name);
      }
    }
    await check.page.keyboard.up('d'); await check.page.keyboard.up('j'); await check.page.keyboard.up('f');
    const measured = await check.page.evaluate(() => {
      const s = window.__jgPerf; s.stopped = true;
      const stats = values => {
        if (!values.length) return null;
        const sorted = values.slice().sort((a,b) => a-b);
        return { mean: values.reduce((sum,v) => sum+v,0) / values.length,
          p50: sorted[Math.floor((sorted.length-1)*.5)], p95: sorted[Math.floor((sorted.length-1)*.95)],
          p99: sorted[Math.floor((sorted.length-1)*.99)], max: sorted[sorted.length-1] };
      };
      const summarize = indices => {
        const values = column => indices.map(i => s.data[column][i]);
        const delta = values(0), wall = delta.reduce((sum,v) => sum+v,0);
        return { frames: indices.length, wallSeconds: wall / 1000, fps: wall ? indices.length*1000/wall : 0,
          frameIntervalMs: stats(delta), simMs: stats(values(1)), drawMs: stats(values(2)),
          cpuFrameMs: stats(values(3)), drawImages: stats(values(4)),
          framesOver22ms: delta.filter(v => v>1000/45+.1).length };
      };
      const all = Array.from({length:s.n},(_,i) => i);
      return { all: summarize(all), scenes: Array.from({length:10},(_,scene) => summarize(all.filter(i => s.data[5][i]===scene))),
        memoryAPI: !!performance.memory, userAgent: navigator.userAgent,
        backingCanvas: { width:window.__jg2d.renderer.canvas.width, height:window.__jg2d.renderer.canvas.height },
        terrainChunks: window.__jg2d.renderer.terrain.chunks.size };
    });
    const maxHeap = Math.max(0, ...heap.map(s => s.usedMB));
    const errors = { page: check.pageErrors, console: check.consoleErrors, requests: check.failures };
    const report = { kind:'headless-browser-performance-sample', requestedSeconds:seconds, readyMs, limits:LIMITS,
      bundle:{entry:check.entry,bytes:bundle.length,sha256:crypto.createHash('sha256').update(bundle).digest('hex')},
      browser:browserVersion, viewport:{width:1920,height:1080,deviceScaleFactor:1},
      fixture:'Five authored deep layers and phase-three boss arenas, largest player body, invulnerable only for uninterrupted profiling. Ordinary game simulation/render/audio remain running. These fixtures do not validate normal progression.',
      measurementLimits:['Headless Chrome on this host is not a physical integrated-GPU acceptance test.',
        'CDP JavaScript heap excludes some canvas, decoded image, audio and GPU memory; it cannot establish the 220MB total-memory budget.',
        'No forced GC is performed. Frame interval outliers are recorded but not attributed to GC without a profiler trace.'],
      ...measured, scenarios:scenarios.map((s,i) => ({...s,...measured.scenes[i]})),
      heap:{maxUsedMB:maxHeap,firstUsedMB:heap[0]?.usedMB,lastUsedMB:heap.at(-1)?.usedMB,samples:heap}, errors,
      checks:{fps:measured.all.fps>=LIMITS.fps,simP95:measured.all.simMs.p95<=LIMITS.simMs,
        drawP95:measured.all.drawMs.p95<=LIMITS.drawMs,drawImageMax:measured.all.drawImages.max<=LIMITS.drawImages,
        firstReady:readyMs<=LIMITS.readyMs,noPageErrors:errors.page.length===0,noConsoleErrors:errors.console.length===0,
        totalMemory:'not verified by JS heap',physicalIGPU:'not verified by headless sample'} };
    delete report.scenes;
    fs.writeFileSync(path.join(check.output,'perf-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({report:path.join(check.output,'perf-report.json'),readyMs,fps:report.all.fps,
      simP95Ms:report.all.simMs.p95,drawP95Ms:report.all.drawMs.p95,maxDrawImages:report.all.drawImages.max,
      jsHeapMaxMB:maxHeap,checks:report.checks},null,2));
    if (Object.values(report.checks).some(value => value===false)) process.exitCode=1;
    return report;
  } finally { try { await cdp?.detach(); } finally { await check.close(); } }
}

module.exports = { runPerf };
if (require.main === module) runPerf().catch(error => { console.error(error.stack ?? error); process.exitCode=1; });
