// Musical tuning is data, independent of WebAudio and the simulation.
export const MODES = Object.freeze({
  1: { key: 'D', scale: [293.66, 329.63, 369.99, 440, 493.88], melody: [293.66, 329.63, 369.99, 440], notes: ['D', 'E', 'F#', 'A'], beats: [0, 1, 2, 3] },
  2: { key: 'A', scale: [220, 261.63, 293.66, 329.63, 392], melody: [440, 392, 329.63, 293.66, 261.63], notes: ['A', 'G', 'E', 'D', 'C'], beats: [0, 1, 2, 2.5, 3] },
  3: { key: 'F#', scale: [185, 220, 246.94, 277.18, 329.63], melody: [185, 277.18, 329.63, 185], notes: ['F#', 'C#', 'E', 'F#'], beats: [0, 1, 2, 3] },
  4: { key: 'C', scale: [130.81, 155.56, 174.61, 196, 233.08], melody: [130.81, 196, 130.81, 196], notes: ['C', 'G', 'C', 'G'], beats: [0, 1, 2, 3] },
  5: { key: 'G', scale: [196, 220, 246.94, 293.66, 329.63], melody: [196, 220, 246.94, 293.66, 329.63], notes: ['G', 'A', 'B', 'D', 'E'], beats: [0, 1, 2, 3, 4] },
});

export const SONG_DEFAULTS = Object.freeze({
  bpm: 72, beats: 4, perfect: .08, responsePerfect: .11, good: .16,
  maxPhrases: 2.2, radius: 220, stun: 1.5, cooldown: 6,
  echoCooldown: .8, echoRadius: .08, resonanceDuration: 8, resonanceRadius: 1.4,
  perfectStun: 1.4, perfectRadius: 1.3, perfectCooldown: .6, perfectMem: 8,
  missStun: .6, missRadius: .85, missBreath: 10,
});

export const MIX = Object.freeze({
  sfx: .9, music: .55, ambient: .45, voice: .7, master: .9,
  reverb: .6, voices: 56, voicesPerFrame: 8, maxSfxDuration: 1.5,
  attack: .008, release: .03, floor: .0001, lookahead: .12,
  fadeIn: 1.2, fadeOut: .8, phaseSilence: .4, bossBpm: 84,
  impulseDuration: 3.2, impulseDecay: 3, noiseDuration: 2,
  distant: 500, inaudible: 900, pan: .7,
});

export const BABBLE = Object.freeze({
  player: { pitch: 1.25, wave: 'triangle', count: 6, gap: .13 },
  grok: { pitch: 1.18, wave: 'square', count: 8, gap: .08 },
  qwen: { pitch: 1.05, wave: 'triangle', count: 7, gap: .14 },
  gemini: { pitch: 1.35, wave: 'sine', count: 5, gap: .12 },
  zhipu: { pitch: .84, wave: 'triangle', count: 6, gap: .15 },
  claude: { pitch: .9, wave: 'sine', count: 7, gap: .18 },
});

export const BOSS_PITCH = Object.freeze({ grok: 1.18, qwen: 1.5, gemini: 1.8, zhipu: .84, claude: 1.05 });
export const STEM_LEVELS = Object.freeze({ pad: .25, pulse: .75, tension: .7, deep: .7, boss: .85 });

export function modeFor(level = 1) {
  const id = typeof level === 'object' ? (level.level ?? level.id ?? level.index ?? level.pressure ?? 1) : level;
  return MODES[Number(id)] ?? MODES[1];
}

export function quantize(frequency, level = 1) {
  const scale = modeFor(level).scale;
  let best = scale[0], distance = Infinity;
  for (let octave = -4; octave <= 4; octave++) {
    for (const note of scale) {
      const candidate = note * 2 ** octave;
      const delta = Math.abs(Math.log2(Math.max(1, frequency) / candidate));
      if (delta < distance) { best = candidate; distance = delta; }
    }
  }
  return best;
}
