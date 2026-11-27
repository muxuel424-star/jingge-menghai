import { P } from './palette.js';
import { ellipse,poly } from './sprites.js';
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
function trimCell(atlas,index){
 const sw=atlas.width/3,sh=atlas.height/2,canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
 const c=canvas.getContext('2d');c.drawImage(atlas,index%3*sw,Math.floor(index/3)*sh,sw,sh,0,0,sw,sh);
 const a=c.getImageData(0,0,sw,sh).data;let x0=sw,y0=sh,x1=0,y1=0;
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(a[(y*sw+x)*4+3]>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const out=document.createElement('canvas');out.width=x1-x0+1;out.height=y1-y0+1;
 out.getContext('2d').drawImage(canvas,x0,y0,out.width,out.height,0,0,out.width,out.height);return out;
}
function stamp(c,image,x,y,width,alpha=1,flip=1,rot=0){
 const h=image.height/image.width*width;c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(rot);c.scale(flip,1);
 c.drawImage(image,-width/2,-h,width,h);c.restore();
}
function topAt(s,x){
 if(!s.points)return s.y-Math.sqrt(Math.max(0,1-((x-s.x)/s.rx)**2))*s.ry;
 let y=Infinity;
 for(let i=0;i<s.points.length;i++){
  const a=s.points[i],b=s.points[(i+1)%s.points.length];
  if(x<Math.min(a.x,b.x)||x>Math.max(a.x,b.x)||a.x===b.x)continue;
  y=Math.min(y,a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x));
 }return y;
}
export class Scenery {
 constructor(atlas){this.images=Array.from({length:6},(_,i)=>trimCell(atlas,i));this.cache=new WeakMap();}
 plan(scene,theme){
  let plan=this.cache.get(scene);if(plan)return plan;
  plan=[];
  for(let i=0;i<(scene.solids||[]).length;i++){
   const s=scene.solids[i],seed=i*37+theme*113;
   if(s.rx&&s.ry){
    const x=s.x+(hash(seed)-.5)*s.rx*.55;
    plan.push({x,y:topAt(s,x)+10,w:Math.min(250,s.rx*.85),flip:hash(seed+9)>.5?1:-1,angle:0});
   }else if(s.points){
    for(let j=0;j<s.points.length;j++){
     const a=s.points[j],b=s.points[(j+1)%s.points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
     if(dx<95||Math.abs(dy)>dx*.6)continue;
     const count=Math.min(3,Math.max(1,Math.floor(length/240)));
     for(let k=0;k<count;k++){
      const focal=k===Math.floor(count/2);
      if(!focal&&(theme===1||theme===3))continue;
      const t=(k+.3+hash(seed+j+k)*.4)/count;
      plan.push({x:a.x+dx*t,y:a.y+dy*t+12,w:Math.min(240,length/count*.75)*(focal?1:.52)*( .75+hash(seed+k+9)*.3),flip:hash(seed+k+2)>.5?1:-1,angle:Math.atan2(dy,dx)*.3});
     }
    }
   }else if(s.rx||s.w){
    const rx=s.rx||s.w/2,ry=s.ry||s.h/2,count=Math.min(3,Math.max(1,Math.floor(rx/170)));
    for(let j=0;j<count;j++){
     const a=-Math.PI*.76+(j+.5)/count*Math.PI*.52;
     plan.push({x:s.x+Math.cos(a)*rx,y:s.y+Math.sin(a)*ry+12,w:Math.min(240,rx*.75)*( .7+hash(seed+j)*.3),flip:hash(seed+j+9)>.5?1:-1,angle:0});
    }
   }
  }
  this.cache.set(scene,plan);return plan;
 }
 edges(c,g,cam,time){
  const theme=g.level.level-1,image=this.images[theme],deep=g.scene.layer==='deep';
  for(const p of this.plan(g.scene,theme)){
   if(!cam.visible(p.x,p.y-p.w*.5,p.w))continue;
   const sway=theme===0?Math.sin(time*.65+p.x)*.008:0;
   stamp(c,image,p.x,p.y,p.w,deep?.72:.96,p.flip,p.angle+sway);
  }
 }
 landmarks(c,g,cam,time){
  const pal=g.level.palette,theme=g.level.level-1;
  for(const p of g.scene.landmarks||[]){
   if(!cam.visible(p.x,p.y,390))continue;
   const story=p.warm||/class|Desk|school|catNest|furniture|maidRoom|changing/i.test(p.kind);
   c.save();c.globalAlpha=story?.65:.38;
   if(theme===2||theme===0&&story)this.window(c,p.x,p.y-140,theme===2?165:145,pal,story);
   else if(theme===1)this.kiln(c,p.x,p.y-25,pal);
   else if(theme===3)this.factory(c,p.x,p.y-20,pal);
   else if(theme===4)this.arcade(c,p.x,p.y-30,pal);
   c.restore();
   const index=theme===0&&story?5:theme;
   stamp(c,this.images[index],p.x+(story?80:0),p.y+155,story?330:235,story?.8:.48,1,0);
   if(p.warm){
    c.strokeStyle=P.ink;c.lineWidth=2;c.beginPath();c.moveTo(p.x+90,p.y-210);c.lineTo(p.x+90,p.y-150);c.stroke();
    poly(c,[[p.x+80,p.y-150],[p.x+100,p.y-150],[p.x+106,p.y-132],[p.x+74,p.y-132]],P.lamp,P.ink,1.5);
   }
  }
  if(theme===4){
   let last=-Infinity;
   for(let i=1;i<(g.scene.mainPath||[]).length;i+=2){
    const p=g.scene.mainPath[i];if(p.x-last<650)continue;last=p.x;
    if(cam.visible(p.x+155,p.y+160,240))stamp(c,this.images[theme],p.x+155,p.y+240,250,.2,i%4===1?1:-1);
   }
  }
  if(g.scene.layer==='boss'){
   stamp(c,this.images[theme],g.scene.width*.08,g.scene.height+25,210,.25,1,0);
   stamp(c,this.images[theme],g.scene.width*.92,g.scene.height+20,185,.22,-1,0);
  }
 }
 window(c,x,y,size,pal,warm){
  c.save();c.translate(x,y);c.fillStyle=pal.base;c.strokeStyle=pal.mid;c.lineWidth=7;
  c.beginPath();c.moveTo(-size*.55,size*.6);c.lineTo(-size*.55,-size*.4);c.bezierCurveTo(-size*.55,-size*.95,size*.55,-size*.95,size*.55,-size*.4);c.lineTo(size*.55,size*.6);c.closePath();c.fill();c.stroke();
  c.strokeStyle=warm?pal.soul:pal.hi;c.lineWidth=2;c.beginPath();c.moveTo(0,-size*.78);c.lineTo(0,size*.6);c.moveTo(-size*.55,-size*.05);c.lineTo(size*.55,-size*.05);c.moveTo(-size*.55,size*.3);c.lineTo(size*.55,size*.3);c.stroke();
  c.fillStyle=pal.mid;c.fillRect(-size*.7,size*.62,size*1.4,9);c.restore();
 }
 kiln(c,x,y,pal){
  c.save();c.translate(x,y);c.fillStyle=pal.base;c.strokeStyle=pal.mid;c.lineWidth=5;
  c.beginPath();c.moveTo(-140,110);c.lineTo(-130,-35);c.bezierCurveTo(-125,-200,135,-200,140,-35);c.lineTo(150,110);c.closePath();c.fill();c.stroke();
  c.strokeStyle=pal.hi;c.lineWidth=2;c.beginPath();c.moveTo(-95,110);c.lineTo(-95,0);c.bezierCurveTo(-95,-70,95,-70,95,0);c.lineTo(95,110);c.stroke();
  for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*48,-110+Math.abs(i)*12);c.lineTo(i*50,-55);c.stroke();}
  c.restore();
 }
 factory(c,x,y,pal){
  c.save();c.translate(x,y);c.fillStyle=pal.base;c.fillRect(-190,-180,380,300);
  c.strokeStyle=pal.mid;c.lineWidth=6;for(let i=-1;i<=1;i++){const x=i*120;c.strokeRect(x-40,-105,80,220);c.beginPath();c.moveTo(x-50,-115);c.lineTo(x+50,-115);c.stroke();}
  ellipse(c,0,-160,31,31,pal.base,pal.mid,5);c.strokeStyle=pal.soul;c.lineWidth=2;c.beginPath();c.moveTo(0,-181);c.lineTo(0,-160);c.lineTo(14,-160);c.stroke();c.restore();
 }
 arcade(c,x,y,pal){
  c.save();c.translate(x,y);c.strokeStyle=pal.mid;c.lineWidth=15;
  for(let i=-1;i<=1;i++){const x=i*155;c.beginPath();c.moveTo(x-65,130);c.lineTo(x-65,-40);c.bezierCurveTo(x-65,-135,x+65,-135,x+65,-40);c.lineTo(x+65,130);c.stroke();}
  c.strokeStyle=pal.hi;c.lineWidth=2;c.beginPath();c.moveTo(-250,120);c.lineTo(250,120);c.stroke();c.restore();
 }
}
