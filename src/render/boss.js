import { P } from './palette.js';
import { ellipse,poly,instrument } from './sprites.js';
import { cell } from './animation.js';
const TAU=Math.PI*2;
export class BossRenderer {
 constructor(atlas){this.cells=[0,1,2,3,4].map(i=>cell(atlas,i,3,2));}
 draw(c,g,time){
  const b=g.boss;if(!b)return;const pal=g.level.palette,a=b.attack;
  for(const s of g.scene.safePoints||[]){ellipse(c,s.x,s.y,30,12,pal.base);c.strokeStyle=P.bone;c.lineWidth=2;c.beginPath();c.moveTo(s.x-9,s.y);c.lineTo(s.x+9,s.y);c.moveTo(s.x,s.y-9);c.lineTo(s.x,s.y+9);c.stroke();}
  for(const i of g.entities.instruments)instrument(c,i,pal,time);
  if(a&&b.tell>0){
   const target=a.target,pat=a.skill.tellShape,pattern=a.skill.pattern;c.save();c.globalAlpha=.3;c.fillStyle=P.fear;c.strokeStyle=P.fear;c.lineWidth=3;c.setLineDash([10,7]);
   if(['rain','coverRain','coverShock'].includes(pattern)){
    c.globalAlpha=.12;c.fillRect(0,0,g.scene.width,g.scene.height);c.globalAlpha=.8;c.strokeStyle=pal.hi;
    for(const safe of g.scene.safePoints||[]){ellipse(c,safe.x,safe.y,56,56,pal.base,pal.hi);}
   }else if(pattern==='halfRain'){
    c.fillRect(g.scene.width/2,0,g.scene.width/2,g.scene.height);c.strokeRect(g.scene.width/2,0,g.scene.width/2,g.scene.height);
   }else if(pattern==='grid'){
    const count=Array.isArray(a.skill.count)?a.skill.count[b.phase-1]:a.skill.count||3;
    for(let i=0;i<count;i++){c.beginPath();c.moveTo(g.scene.width*(i+.5)/count,0);c.lineTo(g.scene.width*(i+.5)/count,g.scene.height);c.moveTo(0,g.scene.height*(i+.5)/count);c.lineTo(g.scene.width,g.scene.height*(i+.5)/count);c.stroke();}
   }else if(pattern==='sweep'){
    c.beginPath();c.arc(b.x,b.y,a.skill.radius||180,0,Math.PI);c.closePath();c.fill();
   }else if(pattern==='darkness'){
    ellipse(c,b.x,b.y,220,220,pal.base,pal.hi);
   }else if(pat==='line'||pat==='fan'){
    const angle=Math.atan2(target.y-b.y,target.x-b.x);
    c.translate(b.x,b.y);c.rotate(angle);
    if(pat==='fan')poly(c,[[0,0],[600,-210],[600,210]],P.fear,null);else c.fillRect(0,-25,650,50);
   }else{c.beginPath();c.arc(target.x,target.y,100,0,TAU);c.stroke();c.beginPath();c.moveTo(target.x-16,target.y);c.lineTo(target.x+16,target.y);c.moveTo(target.x,target.y-16);c.lineTo(target.x,target.y+16);c.stroke();}
   c.restore();
  }
  for(const p of b.areas){
   c.save();c.strokeStyle=p.tellT>0?P.fear:pal.hi;c.lineWidth=3;
   if(p.kind==='yarn'){c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x2,p.y2);c.stroke();}
   else{c.globalAlpha=.17;ellipse(c,p.x,p.y,p.r,p.r,P.fear);c.globalAlpha=1;c.setLineDash([7,5]);c.beginPath();c.arc(p.x,p.y,p.r,0,TAU);c.stroke();}c.restore();
  }
  const image=this.cells[g.level.level-1],h=b.down?225:310,w=h*image.width/image.height;
  c.save();c.translate(b.x,b.y+Math.sin(time*2)*5+(b.down?(4-b.defeatTimer)*12:0));
  if(b.hidden>0)c.globalAlpha=.12;else if(b.invuln>0)c.globalAlpha=.7;
  c.rotate(b.down?.12:Math.sin(time*2)*.025);
  const compress=b.tell>0?.94:b.attack?1.03:1;c.scale(b.dir===1?-compress:compress,1/compress);
  c.drawImage(image,-w/2,-h*.55,w,h);c.restore();
  if(b.gate||b.gateOpen>0){
   c.strokeStyle=b.gate?P.dream:P.lamp;c.lineWidth=2;
   c.beginPath();c.ellipse(b.x,b.y,105+Math.sin(time*5)*4,140,0,0,TAU);c.stroke();
   if(b.gate){for(let i=0;i<4;i++){const a=i/4*TAU-time;c.beginPath();c.arc(b.x+Math.cos(a)*115,b.y+Math.sin(a)*145,4,0,TAU);c.fillStyle=i===3?P.lamp:P.dream;c.fill();}}
  }
  for(const p of b.bullets){
   if(p.kind==='ring'){
    c.strokeStyle=pal.hi;c.lineWidth=4;c.beginPath();const gap=p.gap||0,gw=p.gapWidth||.8;c.arc(p.x,p.y,p.radius||p.r,gap+gw,gap+TAU-gw);c.stroke();
   }else{
    c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(p.vy,p.vx)+time);
    poly(c,[[0,-p.r],[p.r,0],[0,p.r],[-p.r,0]],pal.hi);c.restore();
   }
  }
 }
}

