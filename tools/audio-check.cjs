const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const project = path.resolve(__dirname, '..');
const outputArg = process.argv.find(value => value.startsWith('--out='));
const output = outputArg ? path.resolve(outputArg.slice(6)) : path.join(os.tmpdir(), 'jingge-audio-check');
// Playwright may be installed in this project or its containing workspace.
const { chromium } = require(require.resolve('playwright', { paths: [project, path.dirname(project)] }));

(async () => {
  const esbuild = require(path.join(project, 'node_modules/esbuild'));
  const bundle = await esbuild.build({
    stdin: { contents: "export { AudioEngine } from './src/audio/engine.js';", resolveDir: project },
    bundle: true, write: false, format: 'iife', globalName: 'WhaleAudio', target: 'chrome120',
  });
  const systemChrome = process.env.CHROME_PATH ?? path.join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe');
  const browser = await chromium.launch({ ...(fs.existsSync(systemChrome) ? { executablePath: systemChrome } : {}), headless: true });
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const sampleRate = 32000, seconds = 14;
    const context = new OfflineAudioContext(2, sampleRate * seconds, sampleRate);
    const audio = new WhaleAudio.AudioEngine({ context });
    await audio.init();
    audio.setMuted(true); await audio.suspend(true); await audio.suspend(false);
    const muteSurvivedResume = audio.master.gain.value === 0;
    audio.setMuted(false);
    const game = { state: 'SURFACE', level: 1, player: { x: 0, y: 0, vx: 100, vy: 0 }, enemies: [], boss: null };
    const events = [];
    for (let i = 0; i < 20; i++) events.push({ at: .3 + i * .12, name: 'eat', data: { kind: ['fry', 'lantern', 'manta', 'royal', 'clam'][i % 5], combo: i + 1, x: 0, y: 0 } });
    events.push({ at: .15, name: 'song.start', data: { response: true } });
    for (let i = 0; i < 4; i++) events.push({ at: .15 + i * 60 / 72, name: 'song.beat', data: { response: true, beat: i, bpm: 72 } });
    events.push({ at: .15 + 4 * 60 / 72, name: 'song.release', data: { quality: 'perfect' } },
      { at: 4, name: 'state.change', data: { to: 'DEEP' } },
      { at: 4.3, name: 'fish.tell', data: { kind: 'abyss', windup: .6, x: 0, y: 0 } },
      { at: 4.9, name: 'fish.attack', data: { kind: 'abyss', x: 0, y: 0 } },
      { at: 5.6, name: 'hurt', data: {} },
      { at: 6.2, name: 'env.warn', data: { kind: 'lava' } },
      { at: 6.8, name: 'env.fire', data: { kind: 'lava' } },
      { at: 7.2, name: 'state.change', data: { to: 'BOSS' } },
      { at: 7.4, name: 'boss.tell', data: { key: 'grok', skill: 'dash', windup: .7 } },
      { at: 8.1, name: 'boss.attack', data: { key: 'grok', skill: 'dash' } },
      { at: 8.8, name: 'boss.phase', data: { key: 'grok', phase: 3 } },
      { at: 10, name: 'boss.down', data: { key: 'grok' } });
    events.sort((a, b) => a.at - b.at);
    let cursor = 0, maxVoices = 0, maxNew = 0, vacuumVerified = false, vacuumValues, time = 1 / 60;
    audio.update(game);
    let suspension = context.suspend(time);
    const render = context.startRendering();
    while (time < seconds - .04) {
      await suspension;
      while (cursor < events.length && events[cursor].at <= context.currentTime + .009) {
        const event = events[cursor++];
        if (event.name === 'state.change') {
          game.state = event.data.to;
          if (game.state === 'BOSS') game.boss = { phase: 1 };
        }
        if (event.name === 'boss.phase') game.boss.phase = event.data.phase;
        if (event.name === 'boss.down') game.state = 'DAWN';
        audio.event(event.name, event.data);
      }
      maxNew = Math.max(maxNew, audio.issued);
      audio.update(game);
      if (context.currentTime > 8.82 && context.currentTime < 8.85) {
        vacuumValues = Object.fromEntries(Object.entries(audio.music.channels).map(([name, channel]) => [name, channel.dry.gain.value]));
        vacuumVerified = Object.values(vacuumValues).every(value => value < .0001);
      }
      maxVoices = Math.max(maxVoices, audio.voices.size);
      maxNew = Math.max(maxNew, audio.issued);
      time += 1 / 60;
      if (time < seconds - .04) suspension = context.suspend(time);
      await context.resume();
    }
    const buffer = await render;
    const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
    let peak = 0, sum = 0, clipped = 0;
    const pcm = new Int16Array(buffer.length * 2);
    for (let i = 0; i < buffer.length; i++) for (let channel = 0; channel < 2; channel++) {
      const sample = channels[channel][i];
      peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
      if (Math.abs(sample) >= .999) clipped++;
      pcm[i * 2 + channel] = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
    }
    const bytes = new Uint8Array(pcm.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const result = { peak, rms: Math.sqrt(sum / (buffer.length * 2)), clipped, maxVoices, maxNew, muteSurvivedResume, vacuumVerified, vacuumValues,
      voicesAfterRender: audio.voices.size, events: cursor, channels: 2, sampleRate, seconds, pcm: btoa(binary) };
    audio.destroy();
    return result;
  });
  const pcm = Buffer.from(result.pcm, 'base64'); delete result.pcm;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(result.sampleRate, 24); header.writeUInt32LE(result.sampleRate * 4, 28);
  header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'v2-audio-preview.wav'), Buffer.concat([header, pcm]));
  fs.writeFileSync(path.join(output, 'v2-audio-report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, output }));
  await browser.close();
  if (result.clipped || result.maxNew > 8 || result.maxVoices > 56 || result.rms < .001 || !result.muteSurvivedResume || !result.vacuumVerified) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
