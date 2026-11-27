import { P } from './palette.js';
import { VIEW } from '../data/render.js';
import { ellipse,poly } from './sprites.js';
import { drawCycle } from './animation.js';
export { background,foreground,prepareBackdrops } from './parallax.js';
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
 if(hero)drawCycle(c,hero.idle,time/hero.idle.duration,655,285+Math.sin(time*2)*3,370,1,1);
}
