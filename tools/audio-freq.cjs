const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { AudioContextProbe } = require('./audio-probe.cjs');
const project = path.resolve(__dirname, '..');
const out = path.resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? path.join(os.tmpdir(), 'jingge-audio-freq'));

(async () => {
  const load = file => import(pathToFileURL(path.join(project, file)));
  const [{ AudioEngine }, { MODES, BOSS_TELLS, BABBLE }, { BOSSES }] = await Promise.all([
    load('src/audio/engine.js'), load('src/data/audio.js'), load('src/data/index.js')]);
  const rows = [], failures = [], tells = [];
  for (const level of [1, 2, 3, 4, 5]) {
    const ctx = new AudioContextProbe(), audio = new AudioEngine({ context: ctx }); await audio.init(); audio.level = level;
    const events = [
      ...['fry', 'lantern', 'manta', 'royal', 'abyss', 'clam', 'crystal', 'chest'].map(kind => ['eat', { kind, combo: 4 }]),
      ...['lamp', 'shield', 'magnet', 'bait', 'haste', 'heal', 'smoke', 'sonar'].map(key => ['item.pickup', { key }]),
      ...['fry', 'lantern', 'manta', 'royal', 'abyss', 'jelly', 'tapir', 'guard', 'nightmare'].flatMap(kind => [
        ['fish.tell', { kind, windup: .8 }], ['fish.attack', { kind }]]),
      ...Object.keys(BABBLE).map(speaker => ['dialogue', { speaker }]),
      ...['perfect', 'good', 'miss'].map(quality => ['song.release', { quality }]),
      ...['thermalVent', 'steam', 'eruption', 'fallingTimber', 'lightGrate', 'echoRing'].flatMap(kind => [['env.warn', { kind }], ['env.fire', { kind }]]),
      ['song.start', { response: true }], ['song.cancel', {}], ['song.resonate', {}], ['bite', { hit: true }], ['bite', { hit: false }],
      ...['dash', 'hurt', 'heal', 'evolve', 'frenzy', 'counterkill', 'dream.deliver', 'dream.scatter', 'nightmare.calm',
        'shield.break', 'fish.crack', 'current.enter', 'jelly.bounce', 'hazard.vent', 'instrument.hit', 'boss.stone',
        'boss.yarn.bounce', 'ui.pick', 'ui.confirm', 'ui.seal', 'dawn.bell'].map(name => [name, {}]),
      ...Object.values(BOSSES).flatMap(boss => boss.skills.flatMap(skill => [
        ['boss.tell', { key: boss.key, skill: skill.key, pattern: skill.pattern, windup: Math.max(.2, skill.tell) }],
        ['boss.attack', { key: boss.key, skill: skill.key, pattern: skill.pattern }]])),
      ['boss.hurt', { key: 'grok', back: true }], ['boss.phase', { key: 'grok', phase: 2 }], ['boss.down', { key: 'grok' }],
    ];
    for (const [event, payload] of events) {
      const begin = ctx.nodes.length; audio.issued = 0; audio.event(event, payload);
      for (let frame = 0; frame < 1200; frame++) {
        ctx.advance(1 / 60); audio.issued = 0; audio.sfx.flush();
        if (!audio.sfx.pending.length && !audio.voices.size) break;
      }
      const nodes = ctx.nodes.slice(begin), tonal = nodes.filter(node => node.kind === 'oscillator' && node.frequency.events.length);
      let maxError = 0;
      for (const node of tonal) for (const { value } of node.frequency.events) {
        const error = Math.min(...MODES[level].scale.map(note => {
          const octave = Math.round(Math.log2(value / note)); return Math.abs(value / (note * 2 ** octave) - 1);
        }));
        maxError = Math.max(maxError, error);
        if (error > .03 || (value < 120 && node.type !== 'sine')) failures.push({ level, event, value, wave: node.type, error });
      }
      for (const node of nodes.filter(node => node.kind === 'filter')) for (const { value } of node.frequency.events) {
        if (value >= 2000 && value <= 4000) failures.push({ level, event, forbiddenFilterHz: value });
      }
      rows.push({ level, event, kind: payload.kind ?? payload.key, skill: payload.skill, tonalSources: tonal.length, maxRelativeScaleError: maxError });
    }
    audio.destroy();
  }
  for (const boss of Object.values(BOSSES)) for (const skill of boss.skills) {
    tells.push({ boss: boss.key, skill: skill.key, score: BOSS_TELLS[boss.key]?.[skill.key] });
    if (!BOSS_TELLS[boss.key]?.[skill.key]) failures.push({ missingTell: `${boss.key}.${skill.key}` });
  }
  const report = { kind: 'actual-engine-frequency-table-scan', cases: rows.length, bossTells: tells.length, failures, rows, tells,
    limitations: ['Records WebAudio parameters emitted by actual AudioEngine.tone using a graph double; this is a pitch/table test, not a listening or clipping test.',
      'LFO modulation is excluded; acoustic output and clipping are checked by tools/audio-check.cjs in real Chrome OfflineAudioContext.'] };
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'audio-frequency-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: report.cases, bossTells: report.bossTells, failures: failures.length, output: out }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
