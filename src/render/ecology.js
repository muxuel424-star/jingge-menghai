import { P } from './palette.js';
import { ellipse } from './sprites.js';
export function ecology(c,g,cam,time){
 const pal=g.level.palette;
 for(const r of g.entities.remains||[]){
  if(!cam.visible(r.x,r.y,30))continue;
  c.save();c.globalAlpha=Math.min(1,r.ttl||r.remaining||1)*.7;
  for(let i=0;i<5;i++)ellipse(c,r.x+Math.cos(i*17)*(6+i*3),r.y+Math.sin(i*13)*(4+i*2),2,1,pal.hi,null);
  c.restore();
 }
 for(const b of g.entities.breakables||[]){
  if(b.broken||!cam.visible(b.x,b.y,b.ry))continue;
  c.save();ellipse(c,b.x,b.y,b.rx,b.ry,pal.mid,P.ink,2);
  c.beginPath();c.ellipse(b.x,b.y,b.rx,b.ry,0,0,Math.PI*2);c.clip();c.strokeStyle=P.bone;c.lineWidth=1;
  for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(b.x-35,b.y+i*14-25);c.lineTo(b.x+35,b.y+i*14+25);c.stroke();}
  if(b.hp<b.maxHp){c.strokeStyle=P.ink;c.lineWidth=3;c.beginPath();c.moveTo(b.x+4,b.y-b.ry);c.lineTo(b.x-7,b.y-6);c.lineTo(b.x+9,b.y+5);c.lineTo(b.x-4,b.y+b.ry);c.stroke();}
  c.restore();
 }
}
