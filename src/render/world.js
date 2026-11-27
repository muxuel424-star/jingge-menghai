import { P } from './palette.js';
import { ellipse,poly,pickup } from './sprites.js';
const TAU=Math.PI*2;
export function hazards(c,g,cam){
 const pal=g.level.palette;
 for(const h of g.entities.hazards){
  if(!cam.visible(h.x,h.y,Math.max(h.w,h.h)))continue;
  const color=h.tellT>0||h.active?P.fear:pal.mid,top=h.y-h.h/2,left=h.x-h.w/2;
  c.save();c.strokeStyle=P.ink;c.lineWidth=2;
  if(['current','upcurrent','downcurrent','thermalVent','steam'].includes(h.kind)){
   if(h.kind==='thermalVent'||h.kind==='steam')poly(c,[[left,h.y+h.h/2],[left+h.w*.3,h.y+h.h/2-35],[left+h.w*.75,h.y+h.h/2-35],[left+h.w,h.y+h.h/2]],pal.mid);
   c.globalAlpha=h.active?.36:.12;c.fillStyle=pal.hi;c.fillRect(left,top,h.w,h.h);c.globalAlpha=.65;c.strokeStyle=pal.hi;
   const up=h.kind!=='downcurrent'&&h.kind!=='current';
   for(let i=0;i<5;i++){const t=(g.time*.35+i*.2)%1,x=left+h.w*(.2+(i%3)*.3),y=up?top+h.h*(1-t):top+h.h*t;
    c.beginPath();c.moveTo(x-8,y+(up?8:-8));c.lineTo(x,y);c.lineTo(x+8,y+(up?8:-8));c.stroke();}
  }else if(h.kind==='vortex'){
   c.strokeStyle=pal.hi;c.lineWidth=3;for(let i=1;i<=3;i++){c.beginPath();c.ellipse(h.x,h.y,h.w/2*i/3,h.h/2*i/3,g.time*.7+i,0,Math.PI*1.4);c.stroke();}
  }else if(h.kind==='swingingDoor'){
   const a=h.hinge||{x:h.x,y:top},b=h.tip||{x:h.x,y:top+h.h};
   c.translate(a.x,a.y);c.rotate(Math.atan2(b.x-a.x,b.y-a.y)*-1);c.fillStyle=pal.mid;c.fillRect(-h.w/2,0,h.w,h.h);c.strokeRect(-h.w/2,0,h.w,h.h);
   c.strokeStyle=pal.hi;c.beginPath();c.moveTo(-h.w*.3,20);c.lineTo(h.w*.3,h.h-20);c.stroke();
  }else if(h.kind==='fallingTimber'){
   if(h.tellT>0){c.strokeStyle=P.fear;c.setLineDash([6,6]);c.strokeRect(left,top,h.w,h.h);}
   c.fillStyle=pal.mid;c.fillRect(left,h.logY??top,h.w,28);c.strokeRect(left,h.logY??top,h.w,28);
  }else if(h.kind==='ricochetShards'){
   for(const s of h.shards||[])poly(c,[[s.x-s.r,s.y+s.r],[s.x,s.y-s.r],[s.x+s.r,s.y]],pal.hi);
  }else if(h.kind==='lightGrate'){
   poly(c,[[left,top-12],[left+h.w,top-12],[left+h.w,top+12],[left,top+12]],pal.mid);
   if(h.active||h.tellT>0){c.strokeStyle=color;c.lineWidth=h.active?5:2;c.setLineDash(h.active?[]:[10,7]);for(let i=0;i<4;i++){c.beginPath();c.moveTo(left+h.w*i/3,top);c.lineTo(left+h.w*i/3,top+h.h);c.stroke();}}
  }else if(h.kind==='echoRing'){
   c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(h.x,h.y,Math.max(1,h.ringRadius||15),0,TAU);c.stroke();
  }else if(h.kind==='lava'){
   poly(c,[[left,top+20],[left+h.w*.3,top],[left+h.w*.7,top+10],[left+h.w,top],[left+h.w,top+h.h],[left,top+h.h]],pal.hi);
  }else{
   c.globalAlpha=.6;c.fillStyle=pal.mid;c.fillRect(left,top,h.w,h.h);c.strokeRect(left,top,h.w,h.h);
  }c.restore();
 }
}
export function objectives(c,g,cam,time){
 const pal=g.level.palette,p=g.player,scene=g.scene;c.font='11px "Microsoft YaHei UI"';c.fillStyle=P.bone;c.textAlign='center';
 if(scene.well&&cam.visible(scene.well.x,scene.well.y,80)){
  const w=scene.well;ellipse(c,w.x,w.y+30,55,20,pal.mid);poly(c,[[w.x-50,w.y+15],[w.x-50,w.y+45],[w.x+50,w.y+45],[w.x+50,w.y+15]],pal.mid);
  ellipse(c,w.x,w.y+10,54,17,P.bone);ellipse(c,w.x,w.y+9,42,10,P.dream);
  c.strokeStyle=P.dream;c.lineWidth=2;for(let i=0;i<2;i++){c.beginPath();c.ellipse(w.x,w.y-20-i*18,28+i*7,6,0,0,TAU);c.stroke();}
  if(Math.hypot(p.x-w.x,p.y-w.y)<220){c.fillStyle=P.bone;c.fillText('月光井 · 梦链送到这里',w.x,w.y-75);}
 }
 if(scene.exit&&cam.visible(scene.exit.x,scene.exit.y,100)){
  const e=scene.exit,open=g.state!=='SURFACE'||g.riftOpen;
  c.save();c.translate(e.x,e.y);poly(c,[[0,-85],[35,-30],[14,5],[40,50],[0,88],[-33,45],[-18,-12],[-34,-55]],pal.base);
  c.strokeStyle=open?P.dream:pal.mid;c.lineWidth=3;c.beginPath();c.moveTo(0,-67);c.lineTo(-8,-15);c.lineTo(15,15);c.lineTo(-1,63);c.stroke();
  if(open){c.beginPath();c.ellipse(0,0,50+Math.sin(time*2)*3,90,0,0,TAU);c.stroke();}
  c.restore();if(Math.hypot(p.x-e.x,p.y-e.y)<230){c.fillStyle=P.bone;c.fillText(open?'裂隙 · 向梦里游':'找到三段心事，裂隙就会打开',e.x,e.y-110);}
 }
 const lamp=p.buffs.some(b=>b.key==='lamp');
 for(const f of g.entities.fragments){
  if(f.collected||!cam.visible(f.x,f.y,50))continue;
  const shown=!f.hidden||lamp||g.checkCondition(f.condition);
  c.save();c.globalAlpha=shown?1:.15;c.translate(f.x,f.y+Math.sin(time*2)*4);
  poly(c,[[-14,-20],[15,-20],[15,13],[7,21],[-14,21]],P.paper);
  c.strokeStyle=P.line;c.lineWidth=1;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-7,-10+i*8);c.lineTo(8,-10+i*8);c.stroke();}c.restore();
 }
 for(const f of g.entities.melodies){if(f.collected||!cam.visible(f.x,f.y,50))continue;c.fillStyle=P.bone;c.font='32px serif';c.fillText('♫',f.x,f.y+Math.sin(time*3)*4);}
 for(const f of g.entities.pickups)if(cam.visible(f.x,f.y,40))pickup(c,f,pal,time,Math.hypot(p.x-f.x,p.y-f.y)<90);
 for(const s of scene.shortcuts||[]){
  if(!cam.visible(s.from.x,s.from.y,40))continue;c.strokeStyle=pal.hi;c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();c.ellipse(s.from.x,s.from.y,28,40,0,0,TAU);c.stroke();c.setLineDash([]);
 }
 const souvenir=scene.souvenir;
 if(souvenir&&!g.stats.souvenir&&cam.visible(souvenir.x,souvenir.y,40)&&(lamp||Math.hypot(p.x-souvenir.x,p.y-souvenir.y)<150)){
  c.fillStyle=P.bone;c.strokeStyle=P.ink;c.lineWidth=2;c.fillRect(souvenir.x-14,souvenir.y-10,28,20);c.strokeRect(souvenir.x-14,souvenir.y-10,28,20);
 }
}

