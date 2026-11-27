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
 const grade=document.createElement('canvas');grade.width=1920;grade.height=1080;
 const ctx=grade.getContext('2d'),beams=SEA.map(beam);
 let current=-1,deepGrade=false;
 return {
  beams,
  layer(index,deep){
   if(current!==index||deepGrade!==deep){
    current=index;deepGrade=deep;
    // Grade only when entering a layer. Grading the full image every frame allocates large GPU surfaces.
    ctx.filter=deep?'brightness(.82) contrast(1.25)':'brightness(1.12)';
    ctx.drawImage(atlas[index],0,0,grade.width,grade.height);ctx.filter='none';
   }
   return grade;
  }
 };
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
  const index=g.level.level-1,row=atlas.layer(index,deep),h=VIEW.h*1.5;
  if(row){
   const w=row.width/row.height*h,offset=Math.max(0,Math.min(w-VIEW.w,cam.x*.2));
   c.save();c.globalAlpha=deep?.48:.62;c.drawImage(row,-offset,(VIEW.h-h)/2-cam.y*.05,w,h);c.restore();
  }
  c.save();c.translate(VIEW.w*.75-cam.x*.025%220,-80);c.rotate(.26);c.drawImage(atlas.beams[index],-150,0);c.restore();
 }
 ridge(c,g,cam,.5,false,mix(pal.base,P.ink,.22));
 ridge(c,g,cam,.5,true,mix(pal.base,P.ink,.25));
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
