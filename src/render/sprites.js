import { P } from './palette.js';
import { SPECIES, text } from '../data/index.js';
const TAU=Math.PI*2;
const FISH_CELLS={fry:0,lantern:1,manta:2,royal:3,nightmare:4,jelly:5};
const LOOT_CELLS={clam:0,chest:1,bait:2};
let fishArt=[],lootArt=[],landmarkArt=[];
function cells(atlas,cols,rows){
 const w=atlas.width/cols,h=atlas.height/rows;
 return Array.from({length:cols*rows},(_,i)=>{
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.drawImage(atlas,i%cols*w,Math.floor(i/cols)*h,w,h,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h).data;
  let left=w,right=0,top=h,bottom=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {canvas,left,top,w:right-left+1,h:bottom-top+1};
 });
}
export function setSpriteAtlases(fish,loot,landmarks){fishArt=cells(fish,3,2);lootArt=cells(loot,2,2);landmarkArt=cells(landmarks,3,2);}
function paint(c,art,x,y,w){if(!art||art.w<=0||art.h<=0)return;const h=w*art.h/art.w;c.drawImage(art.canvas,art.left,art.top,art.w,art.h,x-w/2,y-h/2,w,h);}
export function landmarkSprite(c,index,x,y,w){paint(c,landmarkArt[index],x,y,w);}
export function ellipse(c,x,y,rx,ry,color,stroke=P.ink,width=2){
 c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width*(c._jgContrast?1.5:1);c.stroke();}
}
export function poly(c,points,color,stroke=P.ink,width=2){
 c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width*(c._jgContrast?1.5:1);c.stroke();}
}
export function fish(c,f,pal,time,contrast,edible=null){
 if(f.eaten||f.hp<=0||f.respawn>0)return;
 const k=f.kind,r=f.r||13,wiggle=Math.sin(time*7+f.phase)*r*.12;
 c.save();c.translate(f.x,f.y);c.scale(f.dir||1,1);c.lineJoin='round';c.lineCap='round';
 if(f.stun>0||f.sleep>0)c.rotate(.14*Math.sin(time*3));
 if(f.tellT>0&&k==='royal'){c.save();c.globalAlpha=.18;poly(c,[[r,-14],[r+250,-14],[r+250,14],[r,14]],P.fear,null);c.restore();}
 if(k==='abyss'&&f.action==='suction'){
  c.save();c.globalAlpha=f.tellT>0?.16:.08;poly(c,[[r*.5,0],[r+205,-145],[r+205,145]],f.tellT>0?P.fear:pal.hi,null);c.restore();
  c.strokeStyle=pal.hi;c.lineWidth=2;for(let i=0;i<3;i++){const t=(time*1.8+i/3)%1,x=r+180*(1-t);c.beginPath();c.moveTo(x+10,-12);c.lineTo(x,0);c.lineTo(x+10,12);c.stroke();}
 }
 if(k==='manta'&&f.action==='vortex'){
  c.strokeStyle=f.tellT>0?P.fear:pal.hi;c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.arc(0,0,55+i*22,time*3+i,time*3+i+Math.PI*1.4);c.stroke();}
 }
 if(k==='lantern'&&f.action==='flash'){
  c.save();c.globalAlpha=.6;c.strokeStyle=f.tellT>0?P.fear:pal.hi;c.lineWidth=2;c.beginPath();c.arc(0,0,114*(1-Math.min(.8,f.tellT||0)),0,TAU);c.stroke();c.restore();
 }
 const sprite=fishArt[FISH_CELLS[k]];
 if(sprite&&!(k==='royal'&&!f.armored)){
  c.save();c.rotate(Math.sin(time*6+f.phase)*.065);
  paint(c,sprite,0,0,r*(k==='manta'?3.2:k==='nightmare'?2.4:2.75));c.restore();
 }else if(k==='jelly'){
  poly(c,[[-r,-r*.25],[r,-r*.25],[r*.5,r*.3],[-r*.5,r*.3]],pal.hi);
  poly(c,[[-r*.15,-r*.25],[r*.2,-r*.9],[r*.6,-r*.25]],pal.soul);
  c.strokeStyle=pal.hi;c.lineWidth=2;for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(i*r*.4,r*.3);c.quadraticCurveTo(i*r*.4+wiggle,r*.9,i*r*.4-wiggle,r*1.4);c.stroke();}
 }else if(k==='manta'){
  poly(c,[[-r*.8,0],[-r*.55,-r*.4],[0,-r*(.7+Math.sin(time*4)*.25)],[r*.9,-r*.15],[r,0],[r*.5,r*.2],[0,r*(.7+Math.sin(time*4)*.25)],[-r*.7,r*.2]],pal.mid);
  poly(c,[[-r*.7,0],[-r*1.6,wiggle],[-r*.8,r*.15]],pal.hi);
  ellipse(c,r*.5,-r*.06,r*.08,r*.08,P.bone,null);
 }else if(k==='guard'){
  for(let i=-1;i<=1;i++){c.strokeStyle=pal.mid;c.lineWidth=r*.3;c.beginPath();c.moveTo(-r*.6,r*.8);c.lineTo(i*r*.5,-r*.5);c.lineTo(i*r*.7,-r*.9);c.stroke();}
  const open=f.action==='open'?r*.45:r*.08;
  poly(c,[[r*.1,-open],[r,-r*.7],[r*.6,-r*.1],[r,0]],pal.hi);
  poly(c,[[r*.1,open],[r,r*.7],[r*.6,r*.1],[r,0]],pal.mid);
  ellipse(c,-r*.2,0,r*.4,r*.5,pal.base);
 }else if(k==='tapir'){
  ellipse(c,0,0,r,r*.65,P.bone);ellipse(c,-r*.2,-r*.05,r*.52,r*.55,pal.base,null);
  poly(c,[[r*.7,-r*.1],[r*1.15,r*.1],[r*1.05,r*.7],[r*.8,r*.7]],P.bone);
  ellipse(c,-r*.7,-r*.5,r*.23,r*.3,pal.hi);
  ellipse(c,r*.56,-r*.12,r*.055,r*.055,P.ink,null);
  for(let i=-1;i<=1;i+=2)ellipse(c,i*r*.45,r*.6,r*.18,r*.25,pal.mid);
 }else if(k==='nightmare'){
  for(let i=0;i<7;i++){const a=i/7*TAU,rot=time*.4;poly(c,[[Math.cos(a)*r*.5,Math.sin(a)*r*.5],[Math.cos(a+rot)*r*1.22,Math.sin(a+rot)*r*1.22],[Math.cos(a+.5)*r*.8,Math.sin(a+.5)*r*.8]],pal.base);}
  ellipse(c,0,0,r,r*.78,pal.base);
  poly(c,[[r*.6,-r*.5],[r*.15,0],[r*.8,r*.2],[r*.25,r*.55],[r,0]],P.night,null);
  ellipse(c,-r*.2,-r*.2,r*.1,r*.18,pal.hi,null);
 }else{
  const big=k==='abyss',royal=k==='royal',lantern=k==='lantern',dream=k==='dreamfish';
  const ry=big?r*.64:royal?r*.64:lantern?r*.72:r*.52;
  poly(c,[[-r*.5,0],[-r*1.4,-ry*.8+wiggle],[-r*1.28,ry*.7+wiggle]],pal.mid);
  ellipse(c,0,0,r,ry,royal?pal.mid:dream?P.dream:lantern?pal.soul:pal.hi);
  c.save();c.beginPath();c.ellipse(0,0,r,ry,0,0,TAU);c.clip();
  c.fillStyle=royal||big?pal.base:pal.mid;c.fillRect(-r,ry*.15,r*2,ry);c.restore();
  poly(c,[[-r*.3,ry*.1],[r*.1,ry*.7],[r*.3,ry*.25]],pal.mid,P.ink,1);
  if(royal){
   for(let i=-1;i<=1;i++){poly(c,[[i*r*.45,-ry*.5],[i*r*.45+r*.22,0],[i*r*.45,ry*.6],[i*r*.45-r*.2,0]],f.armored?pal.soul:pal.base);}
   poly(c,[[-r*.45,-ry*.6],[-r*.1,-ry*1.55],[r*.2,-ry*.7]],pal.hi);
  }
  if(lantern||big){
   c.strokeStyle=P.ink;c.lineWidth=2;c.beginPath();c.moveTo(r*.3,-ry*.6);c.quadraticCurveTo(r*.1,-ry*1.7,r*.8,-ry*1.5);c.stroke();
   ellipse(c,r*.8,-ry*1.5,r*.17,r*.17,P.lamp);
  }
  if(big){
   ellipse(c,r*.63,r*.1,r*.45,ry*.65,P.ink);
   for(let i=-1;i<=1;i++){poly(c,[[r*.48+i*r*.15,-ry*.4],[r*.55+i*r*.15,-ry*.1],[r*.63+i*r*.15,-ry*.4]],P.bone,null);}
  }
  ellipse(c,r*.48,-ry*.22,r*.12,r*.13,P.white,P.ink,1);
  ellipse(c,r*.52,-ry*.2,r*.05,r*.07,P.ink,null);
 }
 if(f.tellT>0){c.strokeStyle=P.fear;c.lineWidth=contrast?5:3;c.beginPath();c.moveTo(r+8,-r);c.lineTo(r+8,-r-18);c.stroke();ellipse(c,r+8,-r-25,2.5,2.5,P.fear,null);}
 if(f.stun>0||f.sleep>0){c.strokeStyle=P.dream;c.lineWidth=2;c.beginPath();c.ellipse(0,-r-10,r*.6,4,0,0,TAU);c.stroke();}
 if(edible!==null&&!(f.tellT>0)){
  if(edible)ellipse(c,0,-r-13,2.5,2.5,P.dream,P.ink,1);
  else{c.fillStyle=P.fear;c.fillRect(-2.5,-r-16,5,5);}
 }
 c.restore();
}
export function pickup(c,p,pal,time,near){
 if(p.taken||p.collected)return;
 const r=16; c.save();c.translate(p.x,p.y+Math.sin(time*2+p.x)*3);
 ellipse(c,0,0,r+4,r+4,pal.base,P.ink);
 c.strokeStyle=P.bone;c.lineWidth=2;
 const key=p.key||p.kind;
 if(lootArt[LOOT_CELLS[key]])paint(c,lootArt[LOOT_CELLS[key]],0,0,33);
 else if(key==='shield'){poly(c,[[-10,-11],[10,-11],[9,5],[0,13],[-9,5]],P.bone);poly(c,[[-5,-5],[5,-5],[0,7]],pal.mid,null);}
 else if(key==='magnet'){c.beginPath();c.arc(0,-3,9,0,Math.PI);c.lineTo(-9,-11);c.moveTo(9,-3);c.lineTo(9,-11);c.stroke();}
 else if(key==='haste'){poly(c,[[-10,7],[5,-13],[1,-1],[12,-4],[-4,14]],pal.hi);}
 else if(key==='heal'){c.fillStyle=pal.hi;c.fillRect(-3,-11,6,22);c.fillRect(-11,-3,22,6);}
 else if(key==='lamp'){poly(c,[[-7,-9],[7,-9],[10,8],[-10,8]],P.lamp);c.strokeRect(-5,-15,10,6);}
 else if(key==='sonar'){c.beginPath();c.arc(0,0,10,-2,2);c.arc(0,0,5,-2,2);c.stroke();}
 else if(key==='smoke'){ellipse(c,0,0,8,11,pal.mid);c.fillStyle=P.bone;c.fillRect(-4,-14,8,4);}
 else if(key==='crystal'){poly(c,[[-9,2],[0,-17],[11,0],[0,17]],pal.hi);}
 else if(key==='chest'){c.fillStyle=P.bone;c.fillRect(-12,-9,24,18);c.strokeStyle=P.ink;c.strokeRect(-12,-9,24,18);c.beginPath();c.moveTo(0,-9);c.lineTo(0,9);c.stroke();}
 else if(key==='clam'){ellipse(c,0,0,12,8,P.bone);ellipse(c,1,-2,5,5,P.white,null);}
 else{poly(c,[[0,-11],[11,-3],[7,11],[-7,11],[-11,-3]],pal.hi);}
 c.restore();
 if(near&&key)c.fillText(text('item.'+key),p.x,p.y-32);
}
export function instrument(c,p,pal,time){
 const ready=!(p.cd>0),key=p.key||p.kind||p.type||'';c.save();c.translate(p.x,p.y);
 c.globalAlpha=ready?1:.45;c.lineWidth=3;c.strokeStyle=P.ink;
 if(/Bell|bell/.test(key)){poly(c,[[-24,20],[-17,-15],[-8,-27],[8,-27],[17,-15],[24,20]],pal.soul);ellipse(c,0,22,28,6,pal.hi);ellipse(c,0,28,6,7,P.bone);}
 else if(/cup|bowl|porcelain|kiln/i.test(key)){ellipse(c,0,0,30,14,P.bone);c.fillStyle=pal.mid;c.fillRect(-29,0,58,20);ellipse(c,0,20,29,13,pal.mid);ellipse(c,0,0,27,9,pal.hi);}
 else if(/clock/i.test(key)){ellipse(c,0,0,29,29,P.bone);c.strokeStyle=P.ink;c.beginPath();c.moveTo(0,-20);c.lineTo(0,0);c.lineTo(14,8);c.stroke();}
 else if(/lamp/i.test(key)){poly(c,[[-16,-22],[16,-22],[23,20],[-23,20]],P.lamp);c.strokeRect(-8,-35,16,13);}
 else{ellipse(c,0,0,29,22,pal.soul);poly(c,[[-20,-10],[-17,-30],[-4,-20],[10,-22],[24,-29],[22,-7]],pal.soul);ellipse(c,0,8,19,9,P.bone);}
 if(ready){c.strokeStyle=P.dream;c.lineWidth=2;c.beginPath();c.arc(0,0,42+Math.sin(time*2)*3,0,TAU);c.stroke();}
 c.restore();
}
