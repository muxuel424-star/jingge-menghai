/** Minimal WebAudio graph double: records the parameters used by real tone(). */
class AudioParamProbe {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.events.push({ value, time }); this.value = value; return this; }
  exponentialRampToValueAtTime(value, time) { return this.setValueAtTime(value, time); }
  linearRampToValueAtTime(value, time) { return this.setValueAtTime(value, time); }
  setTargetAtTime(value, time) { return this.setValueAtTime(value, time); }
  cancelScheduledValues() { return this; }
}
class AudioNodeProbe {
  constructor(context, kind) {
    this.context = context; this.kind = kind; this.type = 'sine'; this.connections = [];
    for (const key of ['gain', 'frequency', 'detune', 'Q', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release']) {
      this[key] = new AudioParamProbe();
    }
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections.length = 0; this.disconnected = true; }
  start(time = this.context.currentTime) { this.startAt = time; }
  stop(time = this.context.currentTime) { this.stopAt = time; }
}
class AudioContextProbe {
  constructor() { this.currentTime = 0; this.sampleRate = 100; this.nodes = []; this.state = 'running'; this.destination = this.node('destination'); }
  node(kind) { const node = new AudioNodeProbe(this, kind); this.nodes.push(node); return node; }
  createGain() { return this.node('gain'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createConvolver() { return this.node('convolver'); }
  createBiquadFilter() { return this.node('filter'); }
  createStereoPanner() { return this.node('panner'); }
  createBufferSource() { return this.node('noise'); }
  createOscillator() { return this.node('oscillator'); }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, getChannelData(channel) { return data[channel]; } };
  }
  advance(seconds) {
    this.currentTime += seconds;
    for (const node of this.nodes) if (node.onended && node.stopAt <= this.currentTime && !node.ended) {
      node.ended = true; node.onended();
    }
  }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}
module.exports = { AudioContextProbe };
