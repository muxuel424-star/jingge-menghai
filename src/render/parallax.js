import { P,SEA,mix } from './palette.js';
import { VIEW } from '../data/render.js';
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
function beam(pal){
 const canvas=document.createElement('canvas');canvas.width=300;canvas.height=720;
 const c=canvas.getContext('2d'),g=c.createLinearGradient(0,0,300,0);
 g.addColorStop(0,pal.hi+'00');g.addColorStop(.28,pal.hi+'09');g.addColorStop(.5,pal.hi+'20');g.addColorStop(.72,pal.hi+'09');g.addColorStop(1,pal.hi+'00');
 c.fillStyle=g;c.fillRect(0,0,300,720);return canvas;
}
export function prepareBackdrops(atlas){
 const rows=[],h=atlas.height/5;
 for(let row=0;row<5;row++){
  const canvas=document.createElement('canvas');canvas.width=atlas.width;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.drawImage(atlas,0,row*h,atlas.width,h,0,0,atlas.width,h);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let y=0;y<canvas.height;y++){
   const alpha=Math.min(1,y/24,(canvas.height-1-y)/5);
   if(alpha>=1)continue;
   for(let x=0;x<canvas.width;x++)pixels.data[(y*canvas.width+x)*4+3]*=alpha;
  }
  ctx.putImageData(pixels,0,0);canvas.beam=beam(SEA[row]);rows.push(canvas);
 }
 return rows;
}
function ridge(c,g,cam,factor,ceiling,color){
 const size=190,ox=cam.x*factor,first=Math.floor((ox-VIEW.w/2)/size)-1;
 const level=(ceiling?50:g.scene.height*.93)*factor-cam.y*factor+VIEW.h/2;
 const sign=ceiling?1:-1;
 c.beginPath();c.moveTo(-200,ceiling?-200:VIEW.h+250);
 for(let i=first;i<first+9;i++){
  const x=i*size-ox+VIEW.w/2,y=level+sign*(35+hash(i+g.level.level*31)*100);
  if(g.level.level===1||g.level.level===2)c.bezierCurveTo(x-150,y-sign*18,x-80,y+sign*35,x,y);
  else{c.lineTo(x-115,y-sign*18);c.lineTo(x-65,y+sign*22);c.lineTo(x,y);}
 }
 c.lineTo(VIEW.w+300,ceiling?-200:VIEW.h+250);c.closePath();c.fillStyle=color;c.fill();
}
export function background(c,g,cam,time,atlas){
 const pal=g.level.palette,deep=g.scene.layer==='deep'||g.state==='BOSS'||g.state==='DESCENT';
 c.fillStyle=deep?mix(pal.base,P.ink,.35):pal.base;c.fillRect(0,0,VIEW.w,VIEW.h);
 ridge(c,g,cam,.13,false,mix(pal.mid,pal.base,.84));
 if(atlas){
  const row=atlas[g.level.level-1],h=190,w=row.width/row.height*h;
  const offset=Math.max(0,Math.min(w-VIEW.w,cam.x*.17));
  c.save();c.globalAlpha=deep?.5:.67;c.drawImage(row,-offset,VIEW.h-h-105-cam.y*.025,w,h);c.restore();
  c.save();c.translate(VIEW.w*.75-cam.x*.025%220,-80);c.rotate(.26);c.drawImage(row.beam,-150,0);c.restore();
 }
 ridge(c,g,cam,.26,false,mix(pal.base,P.ink,.22));
 ridge(c,g,cam,.22,true,mix(pal.base,P.ink,.25));
 for(let i=0;i<24;i++){
  const x=((i*193.7-cam.x*.2)%VIEW.w+VIEW.w)%VIEW.w;
  const y=((i*67-time*(3+i%3)-cam.y*.12)%VIEW.h+VIEW.h)%VIEW.h;
  c.fillStyle=pal.hi;c.globalAlpha=.12;c.beginPath();c.arc(x,y,i%5===0?1.8:.85,0,Math.PI*2);c.fill();
 }c.globalAlpha=1;
}
export function foreground(c,g,cam,time){
 c.save();c.globalAlpha=.58;c.fillStyle=P.ink;c.strokeStyle=P.ink;
 for(let i=0;i<3;i++){
  const x=((i*477-cam.x*1.35)%1500+1500)%1500-130;
  for(let j=0;j<3;j++){
   const dx=j*13,top=VIEW.h-35-hash(i*11+j)*60,sway=Math.sin(time*.7+i+j)*9;
   c.beginPath();c.moveTo(x+dx-5,VIEW.h+10);c.bezierCurveTo(x+dx-15,VIEW.h-25,x+dx+sway-8,top+12,x+dx+sway,top);
   c.bezierCurveTo(x+dx+sway+6,top+25,x+dx+10,VIEW.h-20,x+dx+8,VIEW.h+10);c.fill();
  }
 }c.restore();
}
