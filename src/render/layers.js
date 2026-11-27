import { P,mix } from './palette.js';
import { VIEW,FX } from '../data/render.js';
import { ellipse,poly } from './sprites.js';
export function prepareBackdrops(atlas){
 const rows=[],h=atlas.height/5;
 for(let row=0;row<5;row++){
  const canvas=document.createElement('canvas');canvas.width=atlas.width;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.drawImage(atlas,0,row*h,atlas.width,h,0,0,atlas.width,h);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),fade=24;
  for(let y=0;y<canvas.height;y++){
   const alpha=Math.min(1,y/fade,(canvas.height-1-y)/5);
   if(alpha>=1)continue;
   for(let x=0;x<canvas.width;x++)pixels.data[(y*canvas.width+x)*4+3]*=alpha;
  }
  ctx.putImageData(pixels,0,0);rows.push(canvas);
 }
 return rows;
}
function structure(c,x,y,size,theme,color,detail=false){
 c.save();c.translate(x,y);c.scale(size,size);c.fillStyle=color;c.strokeStyle=color;c.lineWidth=14;c.lineCap='round';
 if(theme==='bay'){
  for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(i*35,80);c.bezierCurveTo(i*45,20,i*100,-10,i*65,-95);c.stroke();c.beginPath();c.moveTo(i*35,10);c.lineTo(i*85,-30);c.stroke();}
 }else if(theme==='porcelain'){
  c.beginPath();c.moveTo(-120,20);c.lineTo(110,20);c.lineTo(60,80);c.lineTo(-65,80);c.fill();
  c.fillRect(-10,-150,14,175);poly(c,[[-6,-140],[-6,-10],[95,-10]],color,null);
  for(let i=-2;i<=2;i++)c.fillRect(i*32,32,6,52);
 }else if(theme==='violet'){
  c.fillRect(-55,-90,110,175);c.fillRect(-105,-125,210,18);
  c.fillStyle=detail?P.night:color;c.fillRect(-35,-65,70,90);c.fillStyle=color;c.fillRect(-3,-65,6,90);c.fillRect(-35,-23,70,7);
  poly(c,[[-135,70],[-110,-20],[-85,60]],color,null);
 }else if(theme==='magma'){
  c.fillRect(-80,-90,160,180);c.fillRect(-120,-118,240,24);
  c.fillStyle=detail?P.night:color;c.fillRect(-45,-58,90,148);c.fillStyle=color;
  ellipse(c,0,-125,35,35,color,null);if(detail){c.strokeStyle=P.bone;c.lineWidth=3;c.beginPath();c.moveTo(0,-149);c.lineTo(0,-125);c.lineTo(13,-118);c.stroke();}
 }else{
  c.lineWidth=19;c.beginPath();c.moveTo(-110,95);c.lineTo(-110,-10);c.bezierCurveTo(-110,-140,110,-140,110,-10);c.lineTo(110,95);c.stroke();
  for(let i=-1;i<=1;i+=2){c.lineWidth=12;c.beginPath();c.moveTo(i*110,-35);c.quadraticCurveTo(i*175,-75,i*145,-125);c.stroke();}
 }
 c.restore();
}
export function background(c,game,cam,time,atlas){
 const pal=game.level.palette,deep=game.state!=='SURFACE'&&game.state!=='BRIEF',theme=game.level.key;
 c.fillStyle=deep?mix(pal.base,P.ink,.42):pal.base;c.fillRect(0,0,VIEW.w,VIEW.h);
 if(atlas){
  const row=atlas[game.level.level-1],h=330,w=row.width/row.height*h;
  const offset=Math.max(0,Math.min(w-VIEW.w,cam.x*.2));
  c.save();c.globalAlpha=deep?.52:.72;
  c.drawImage(row,-offset,VIEW.h-h-cam.y*.035,w,h);c.restore();
 }
 for(let layer=0;layer<2;layer++){
  const parallax=layer?.5:.2,spacing=layer?390:540,scale=layer?1:.9;
  const ox=cam.x*parallax,oy=cam.y*parallax;
  const color=layer?mix(pal.mid,pal.base,.56):mix(pal.mid,pal.base,.78);
  const first=Math.floor(ox/spacing)-1,last=first+5;
  for(let i=first;i<=last;i++){
   const x=i*spacing-ox+VIEW.w/2;
   const y=VIEW.h*.63-oy*.3+Math.sin(i*2.6+game.level.level)*90+cam.y*.1;
   structure(c,x,y,scale*(.7+(i%3+3)%3*.3),theme,color,!!layer);
  }
 }
 c.save();c.globalAlpha=FX.lightAlpha;c.fillStyle=pal.hi;
 const beamX=VIEW.w*.7-cam.x*.06%400;
 poly(c,[[beamX-110,-40],[beamX+110,-40],[beamX-35,VIEW.h+40],[beamX-255,VIEW.h+40]],pal.hi,null);c.restore();
 c.fillStyle=pal.hi;
 for(let i=0;i<28;i++){
  const x=((i*193.7-cam.x*.2)%VIEW.w+VIEW.w)%VIEW.w;
  const y=((i*67-time*(4+i%3)-cam.y*.12)%VIEW.h+VIEW.h)%VIEW.h;
  c.globalAlpha=.13;c.beginPath();c.arc(x,y,i%4===0?2:1,0,Math.PI*2);c.fill();
 }c.globalAlpha=1;
}
export function foreground(c,game,cam,time){
 c.save();c.fillStyle=P.ink;c.globalAlpha=.6;
 for(let i=0;i<3;i++){
  const x=((i*477-cam.x*1.35)%1400+1400)%1400-180;
  c.beginPath();c.moveTo(x,VIEW.h+50);
  c.bezierCurveTo(x-50,VIEW.h-60,x+Math.sin(time+i)*30,VIEW.h-80,x+12,VIEW.h-120);
  c.bezierCurveTo(x+45,VIEW.h-75,x+45,VIEW.h-10,x+60,VIEW.h+50);c.fill();
 }c.restore();
}
export function landmarks(c,game,cam,time){
 const pal=game.level.palette,deep=game.scene.layer==='deep';
 for(const p of game.scene.landmarks||[]){
  if(!cam.visible(p.x,p.y,200))continue;
  c.save();c.globalAlpha=.45;
  structure(c,p.x,p.y-200,.6,game.level.key,deep?pal.base:mix(pal.hi,pal.mid,.6),true);c.restore();
  if(p.warm){ellipse(c,p.x+65,p.y-220,12,18,P.lamp);c.strokeStyle=P.ink;c.lineWidth=2;c.beginPath();c.moveTo(p.x+65,p.y-239);c.lineTo(p.x+65,p.y-275);c.stroke();}
 }
}
export function gates(c,game,cam){
 const pal=game.level.palette;
 for(const g of game.scene.gates||[]){
  if(!cam.visible(g.x,g.y,g.h))continue;
  const open=game.player.tier>=g.tier;
  c.save();c.globalAlpha=open?.23:1;c.fillStyle=pal.base;c.strokeStyle=P.ink;c.lineWidth=3;
  const left=g.x-g.w/2,top=g.y-g.h/2;
  c.fillRect(left,top,g.w,g.h);c.strokeRect(left,top,g.w,g.h);
  c.strokeStyle=pal.hi;c.lineWidth=2;
  for(let y=top+10;y<top+g.h;y+=22){c.beginPath();c.moveTo(left+3,y);c.lineTo(left+g.w-3,y+18);c.stroke();}
  for(let i=0;i<=g.tier;i++)ellipse(c,g.x, g.y+(i-g.tier/2)*22,7,5,pal.soul);
  c.restore();
 }
}
export function workplace(c,hero,time,souvenirs=[]){
 c.fillStyle=P.night;c.fillRect(0,0,VIEW.w,VIEW.h);
 c.fillStyle=P.water;c.fillRect(0,65,VIEW.w,VIEW.h-65);
 c.strokeStyle=P.ink;c.lineWidth=24;c.beginPath();c.moveTo(525,500);c.lineTo(525,200);c.bezierCurveTo(525,-45,890,-45,890,200);c.lineTo(890,500);c.stroke();
 c.fillStyle=P.night;c.fillRect(550,180,315,290);
 c.strokeStyle=P.water;c.lineWidth=8;c.beginPath();c.moveTo(705,75);c.lineTo(705,450);c.moveTo(550,280);c.lineTo(865,280);c.stroke();
 c.strokeStyle=P.bone;c.lineWidth=2;c.beginPath();c.moveTo(805,0);c.lineTo(805,90);c.stroke();
 poly(c,[[780,90],[830,90],[850,140],[760,140]],P.lamp);
 c.save();c.globalAlpha=.08;poly(c,[[770,145],[840,145],[960,540],[535,540]],P.lamp,null);c.restore();
 for(let i=0;i<8;i++){const x=580+(i*43+time*8)%260,y=200+Math.sin(i*2+time)*50;c.globalAlpha=.18;ellipse(c,x,y,7,3,P.dream,null);}
 c.globalAlpha=1;c.fillStyle=P.ink;c.fillRect(0,480,VIEW.w,60);c.fillStyle=P.water;c.fillRect(0,480,VIEW.w,9);
 for(let i=0;i<souvenirs.length;i++)ellipse(c,580+i*40,466,14,12,P.bone);
 if(hero){const def=hero.idle,v=def.frames[Math.floor(time*6)%def.frames.length],h=370,scale=h/def.h;c.drawImage(v,655-(def.w/2+def.margin)*scale,100+(Math.sin(time*2)*4)-def.margin*scale,(def.w+def.margin*2)*scale,(def.h+def.margin*2)*scale);}
}
