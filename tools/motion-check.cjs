// Reproducible visual review, not a gameplay clear or physical-GPU benchmark.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { openBrowser, project } = require('./browser.cjs');
const args = process.argv.slice(2);
const option = (key, fallback) => args.find(a => a.startsWith(key + '='))?.slice(key.length + 1) ?? fallback;
const output = path.resolve(option('--out', path.join(os.tmpdir(), 'jingge-motion-check')));
const source = path.resolve(project, option('--source', 'dist/play.html'));
const scenes = [{ key: 'bay', x: 1400, y: 700 }, { key: 'porcelain', x: 1830, y: 1100 }];
const sequence = [
  { name: 'idle', keys: [], ms: 400 },
  { name: 'swim-right', keys: ['d'], ms: 1100 },
  { name: 'turn-left', keys: ['a'], ms: 700 },
  { name: 'settle', keys: [], ms: 350 },
  { name: 'dash-right', keys: ['d', 'Shift'], ms: 700 },
  { name: 'bite-right', keys: ['d', 'j'], ms: 900 },
  { name: 'turn-again', keys: ['a'], ms: 600 },
  { name: 'sing', keys: ['f'], ms: 650 },
  { name: 'release', keys: [], ms: 200 },
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  // Lock this run's HTML before other agents rebuild the shared dist directory.
  const bytes = fs.readFileSync(source);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const locked = path.join(project, 'dist', 'motion-review-' + sha256.slice(0, 12) + '.html');
  if (!fs.existsSync(locked)) fs.writeFileSync(locked, bytes);
  fs.writeFileSync(path.join(output, 'bundle.html'), bytes);
  const harness = await openBrowser({ out: output, shots: true, viewport: { width: 1280, height: 720 } });
  const page = harness.page;
  const started = Date.now();
  try {
    await page.goto(harness.base + '/dist/' + path.basename(locked), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__jg2d?.ready);
    const readyMs = Date.now() - started;
    const cache = await page.evaluate(() => {
      const clips={},seen=new Set();let frameBytes=0,blendBytes=0;
      const add=(canvas,blend=false)=>{if(!canvas||seen.has(canvas))return;seen.add(canvas);const n=canvas.width*canvas.height*4;if(blend)blendBytes+=n;else frameBytes+=n;};
      const visit=(name,cycle)=>{clips[name]={frames:cycle.frames.length,size:[cycle.frames[0].width,cycle.frames[0].height]};for(const frame of cycle.frames)add(frame);add(cycle.blend,true);if(cycle.steady)visit(name+'.steady',cycle.steady);};
      for(const [name,cycle]of Object.entries(__jg2d.renderer.hero))visit(name,cycle);
      add(__jg2d.renderer.animator.transition,true);
      return {clips,frameBytes,blendBytes,totalBytes:frameBytes+blendBytes};
    });
    await page.evaluate(() => {
      window.__motionReview = { running: true, rows: [], phase: 'setup' };
      const capture = time => {
        const run = window.__motionReview;
        if (!run.running) return;
        const { game, renderer, metrics } = __jg2d, p = game.player, a = renderer.animator;
        run.rows.push({ t: time, phase: run.phase, level: game.level.key, state: game.state,
          x: p.x, y: p.y, vx: p.vx, vy: p.vy, dir: p.dir, biteId: p.biteId,
          hitstop: game.hitstop, mode: a.state, clock: a.clock, fade: a.fade,
          motionPhase: a.phase ?? a.swimPhase ?? null, speed: a.speed ?? null, tilt: a.tilt ?? null, facing: a.facing ?? a.facingScale ?? null,
          camX: renderer.camera.x, camY: renderer.camera.y, shake: renderer.camera.shake,
          drawMs: renderer.metrics.drawMs, frameMs: metrics.frameMs });
        requestAnimationFrame(capture);
      };
      requestAnimationFrame(capture);
      const canvas = document.querySelector('#game');
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(canvas.captureStream(60), { mimeType, videoBitsPerSecond: 6000000 });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      window.__motionRecorder = { recorder, chunks, mimeType };
      recorder.start(250);
    });
    let activeKeys = [];
    for (const scene of scenes) {
      for (const key of activeKeys) await page.keyboard.up(key);
      activeKeys = [];
      await page.evaluate(scene => {
        const a = __jg2d, g = a.game;
        g.start(scene.key).begin();
        g.player.x = scene.x; g.player.y = scene.y; g.player.prevX = scene.x; g.player.prevY = scene.y;
        g.terrain.resolve(g.player); a.renderer.camera.ready = false;
        // Hide temporary stage-entry captions, which are unrelated to motion review.
        a.renderer.fx.noticeT = 0; a.renderer.fx.storyT = 0;
        window.__motionReview.phase = scene.key + '/setup';
      }, scene);
      await page.waitForTimeout(200);
      for (const part of sequence) {
        for (const key of activeKeys) if (!part.keys.includes(key)) await page.keyboard.up(key);
        for (const key of part.keys) if (!activeKeys.includes(key)) await page.keyboard.down(key);
        activeKeys = part.keys;
        await page.evaluate(phase => { window.__motionReview.phase = phase; }, scene.key + '/' + part.name);
        await page.waitForTimeout(part.ms);
        if (['idle', 'swim-right', 'turn-left', 'dash-right', 'bite-right', 'sing'].includes(part.name)) {
          await harness.shot(scene.key + '-' + part.name);
        }
      }
    }
    for (const key of activeKeys) await page.keyboard.up(key);
    const video = await page.evaluate(async () => {
      const { recorder, chunks, mimeType } = window.__motionRecorder;
      const stopped = new Promise(resolve => recorder.onstop = resolve); recorder.stop(); await stopped;
      const bytes = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
      window.__motionReview.running = false;
      return { base64: btoa(binary), rows: window.__motionReview.rows, mimeType };
    });
    fs.writeFileSync(path.join(output, 'motion.webm'), Buffer.from(video.base64, 'base64'));
    fs.writeFileSync(path.join(output, 'frames.json'), JSON.stringify(video.rows));
    let mp4 = null;
    try {
      mp4 = path.join(output, 'motion.mp4');
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(output, 'motion.webm'),
        '-vf', 'fps=60', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'pipe' });
    } catch (error) { mp4 = null; console.error('MP4 encoding unavailable:', String(error.message).slice(0, 150)); }
    const intervals = video.rows.slice(1).map((row, i) => row.t - video.rows[i].t).sort((a, b) => a - b);
    const report = { source: path.relative(project, source), sha256, bytes: bytes.length, readyMs, cache:cache.clips,
      cacheMB: cache.totalBytes / 1048576, frameCacheMB:cache.frameBytes/1048576, interpolationBuffersMB:cache.blendBytes/1048576,
      sampledFrames: video.rows.length, frameIntervalP95: intervals[Math.floor(intervals.length * .95)], mp4,
      scenarios: scenes, sequence, pageErrors: harness.pageErrors, consoleErrors: harness.consoleErrors, failures: harness.failures,
      limits: ['Initial scene positions use fixtures. All subsequent movement and action changes use actual keyboard input.',
        'MediaRecorder adds capture/encoding cost; frame timing is diagnostic and is not the performance acceptance sample.'] };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: !report.pageErrors.length, output, readyMs, cacheMB: report.cacheMB, sampledFrames: report.sampledFrames, mp4 }));
  } finally { await harness.close(); }
})().catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
