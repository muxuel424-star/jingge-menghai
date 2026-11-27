// Marsaglia xorshift128. State is serializable for save/replay.
export class RNG {
  constructor(seed = 1) {
    const string = String(seed); let hash = 2166136261;
    for (const c of string) { hash ^= c.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    this.seed = seed; this.state = [hash >>> 0, (hash ^ 362436069) >>> 0, (hash ^ 521288629) >>> 0, (hash ^ 88675123) >>> 0];
  }
  next() {
    const s = this.state; let t = s[0] ^ (s[0] << 11);
    s[0] = s[1]; s[1] = s[2]; s[2] = s[3];
    s[3] = (s[3] ^ (s[3] >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    return s[3] / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.next(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(array) { return array[this.int(0, array.length - 1)]; }
  clone() { const rng = new RNG(this.seed); rng.state = [...this.state]; return rng; }
}
export const createRng = seed => new RNG(seed);
export default RNG;
