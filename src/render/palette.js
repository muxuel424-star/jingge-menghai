export { P, SEA } from '../data/palette.js';

export function mix(a,b,f) {
 const n = v => parseInt(v.slice(1),16), x=n(a), y=n(b);
 const ch = s => Math.round(((x>>s)&255)*(1-f)+((y>>s)&255)*f).toString(16).padStart(2,'0');
 return '#'+ch(16)+ch(8)+ch(0);
}
