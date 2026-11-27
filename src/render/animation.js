import { ANIMATION as A } from '../data/render.js';

const TAU=Math.PI*2;
const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
const damp=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

export function cell(image,index,cols,rows){
 const w=image.width/cols,h=image.height/rows,c=canvas(w,h);
 c.getContext('2d').drawImage(image,index%cols*w,Math.floor(index/cols)*h,w,h,0,0,w,h);return c;
}

function triangle(c,source,a,b,d){
 const cx=(a.x+b.x+d.x)/3,cy=(a.y+b.y+d.y)/3;
 c.save();c.beginPath();
 const points=[a,b,d];
 for(let i=0;i<points.length;i++){const p=points[i],x=cx+(p.x-cx)*1.018,y=cy+(p.y-cy)*1.018;i?c.lineTo(x,y):c.moveTo(x,y);}
 c.closePath();c.clip();
 const xx=(b.x-a.x)/(b.u-a.u),xy=(b.y-a.y)/(b.u-a.u),yx=(d.x-a.x)/(d.v-a.v),yy=(d.y-a.y)/(d.v-a.v);
 c.transform(xx,xy,yx,yy,a.x-xx*a.u-yx*a.v,a.y-xy*a.u-yy*a.v);c.drawImage(source,0,0);c.restore();
}

function cycle(image,def,key){
 const source=canvas(A.width,Math.round(image.height/image.width*A.width));
 const sc=source.getContext('2d');sc.imageSmoothingQuality='high';sc.drawImage(image,0,0,source.width,source.height);
 const margin=A.margin,frames=[],w=source.width,h=source.height;
 for(let f=0;f<def.samples;f++){
  const frame=canvas(w+margin*2,h+margin*2),c=frame.getContext('2d');
  const progress=f/(def.loop?def.samples:def.samples-1),phase=progress*TAU,grid=[];
  for(let y=0;y<=A.rows;y++){
   const row=[];
   for(let x=0;x<=A.cols;x++){
    const u=x/A.cols,v=y/A.rows,trailing=clamp((.8-u)/.8);
    const tail=Math.exp(-Math.pow((v-.65)/.28,2)),hair=Math.exp(-Math.pow((v-.24)/.3,2));
    // Integral temporal harmonics close perfectly at the cache seam.
    const root=Math.sin(phase-u*2)*.013,body=Math.sin(phase-u*3.5-.12)*.042;
    const tip=Math.sin(phase*2-u*4.8-.24)*.068;
    const head=Math.exp(-Math.pow((u-def.face[0])/.15,2)-Math.pow((v-def.face[1])/.15,2));
    const lock=1-head*.83,power=def.power,hem=clamp((v-.55)/.35)*Math.sin(u*Math.PI)**2;
    const dx=(root+body+tip)*trailing*power*w*.3*lock;
    let dy=(body*tail+tip*hair)*trailing*power*h*lock+Math.sin(phase-u*3)*hem*power*h*.012;
    const jaw=Math.exp(-Math.pow((u-def.face[0]-.05)/.1,2)-Math.pow((v-def.face[1]-.08)/.055,2));
    if(key==='sing')dy+=jaw*Math.sin(phase*2)*h*.009;
    if(key==='eat')dy+=jaw*Math.sin(progress*Math.PI)*h*.01;
    if(key==='bite')dy+=jaw*Math.sin(clamp(progress/.62)*Math.PI)*h*.013;
    row.push({u:u*w,v:v*h,x:margin+u*w+dx,y:margin+v*h+dy});
   }
   grid.push(row);
  }
  for(let y=0;y<A.rows;y++)for(let x=0;x<A.cols;x++){
   const a=grid[y][x],b=grid[y][x+1],d=grid[y+1][x],e=grid[y+1][x+1];triangle(c,source,a,b,d);triangle(c,source,e,d,b);
  }
  frames.push(frame);
 }
 const blend=canvas(w+margin*2,h+margin*2);
 return {frames,w,h,margin,loop:def.loop,duration:def.frames/def.fps,blend,blendContext:blend.getContext('2d'),
  offsetX:(def.face[0]-A.face[0])*w*A.faceLock,offsetY:(def.face[1]-A.face[1])*h*A.faceLock};
}

export function prepareHero(atlas){
 const out={};
 Object.entries(A).filter(([,d])=>d?.frames).forEach(([key,def],i)=>{out[key]=cycle(cell(atlas,i,4,2),def,key);});
 // A held dash keeps its hair and tail moving after its initial squeeze/lunge.
 out.dash.steady=cycle(cell(atlas,2,4,2),{...A.dash,samples:12,loop:true,power:.43},'dash');
 return out;
}

/** Phase is cycles for looping clips and 0..1 progress for one-shot clips. */
export function framePosition(clip,phase){
 return clip.loop?((phase%1+1)%1)*clip.frames.length:clamp(phase)*(clip.frames.length-1);
}

function sample(clip,phase){
 const position=framePosition(clip,phase),first=Math.floor(position),fraction=position-first;
 const second=clip.loop?(first+1)%clip.frames.length:Math.min(first+1,clip.frames.length-1);
 if(fraction<.0001||first===second)return clip.frames[first];
 const c=clip.blendContext;
 c.clearRect(0,0,clip.blend.width,clip.blend.height);
 c.globalCompositeOperation='source-over';c.globalAlpha=1-fraction;c.drawImage(clip.frames[first],0,0);
 // Two premultiplied weights sum to one: this is local image interpolation,
 // never additive scene lighting. Source-over here would pulse opacity to .75.
 c.globalCompositeOperation='lighter';c.globalAlpha=fraction;c.drawImage(clip.frames[second],0,0);
 c.globalCompositeOperation='source-over';c.globalAlpha=1;
 return clip.blend;
}

/** Shared continuous sampling for the hero and palace idle portrait. */
export function drawCycle(c,clip,phase,x,y,height,dir=1,opacity=1){
 if(opacity<=0)return;
 const frame=sample(clip,phase),scale=height/clip.h;
 const left=-(clip.w/2+clip.margin+(clip.offsetX||0))*scale,top=-(clip.h/2+clip.margin+(clip.offsetY||0))*scale;
 c.save();c.translate(x,y);c.scale(dir,1);c.globalAlpha*=opacity;
 c.drawImage(frame,left,top,(clip.w+clip.margin*2)*scale,(clip.h+clip.margin*2)*scale);c.restore();
}

export class Animator {
 constructor(){
  this.state='idle';this.old=null;this.clock=0;this.oldClock=0;this.phase=0;this.oldPhase=0;
  this.fade=1;this.fadeDuration=A.fade;this.eat=0;this.hurt=0;this.celebrate=0;this.bite=0;this.lastBite=0;
  this.speed=0;this.rate=A.idle.fps/A.idle.frames;this.tilt=0;this.facing=1;this.dir=1;
  this.turn=0;this.turnAge=A.turnHold;this.turnFrom=1;this.turnTo=1;this.time=0;
  if(globalThis.document){
   const width=A.width+2*(A.margin+A.blendMargin);
   this.transition=canvas(width,width);this.transitionContext=this.transition.getContext('2d');
  }
 }
 trigger(kind){
  if(kind==='eat')this.eat=A.eat.frames/A.eat.fps;
  if(kind==='hurt')this.hurt=A.hurt.frames/A.hurt.fps;
  if(kind==='evolve'||kind==='boss.down')this.celebrate=A.celebrate.frames/A.celebrate.fps;
 }
 step(p,dt){
  this.clock+=dt;this.time+=dt;
  this.eat=Math.max(0,this.eat-dt);this.hurt=Math.max(0,this.hurt-dt);this.celebrate=Math.max(0,this.celebrate-dt);this.bite=Math.max(0,this.bite-dt);
  this.speed=damp(this.speed,Math.hypot(p.vx,p.vy),A.speedEase,dt);
  const swimming=this.state==='swim'?this.speed>A.swimExit:this.speed>A.swimEnter;
  const targetRate=p.singing?A.sing.fps/A.sing.frames:swimming?clamp(9+this.speed/80,9,14)/A.swim.frames:A.idle.fps/A.idle.frames;
  this.rate=damp(this.rate,targetRate,A.rateEase,dt);this.phase+=dt*this.rate;
  this.tilt=damp(this.tilt,clamp(p.vy/A.tiltSpeed,-A.maxTilt,A.maxTilt)*(p.dir||1),A.tiltEase,dt);
  if(p.biteId>this.lastBite){this.lastBite=p.biteId;this.bite=A.bite.frames/A.bite.fps;if(this.state==='bite')this.clock=0;}
  else if(p.biteId<this.lastBite){this.lastBite=p.biteId;this.bite=0;}
  // Swimming through a school must not replace the sprite on every fry.
  const state=this.hurt?'hurt':this.celebrate?'celebrate':this.bite>0?'bite':p.singing?'sing':p.dashing?'dash':this.eat&&this.speed<A.eatPoseSpeed?'eat':swimming?'swim':'idle';
  if(state!==this.state){
   this.old=this.state;this.oldClock=this.clock;this.oldPhase=this.phase;this.state=state;this.clock=0;
   this.fade=0;this.fadeDuration=state==='hurt'?A.hurtFade:A.fade;
  }
  this.fade=clamp(this.fade+dt/this.fadeDuration);
  if(this.fade===1)this.old=null;
  const dir=p.dir||1;
  if(dir!==this.dir){this.dir=dir;this.turnFrom=this.facing;this.turnTo=dir;this.turnAge=0;}
  this.turnAge=Math.min(A.turnHold,this.turnAge+dt);
  const t=this.turnAge/A.turnHold;
  this.facing=this.turnFrom+(this.turnTo-this.turnFrom)*smooth(t);this.turn=Math.sin(t*Math.PI);
 }
 pose(c,cycles,state,clock,phase,height,opacity){
  let clip=cycles[state],progress=clip.loop?phase:clock/clip.duration;
  if(state==='dash'&&clock>=clip.duration){clip=clip.steady||clip;progress=phase;}
  drawCycle(c,clip,progress,0,0,height,1,opacity);
 }
 draw(c,cycles,p,x,y){
  const height=A.height[p.tier],blend=smooth(this.fade);
  const direction=Math.abs(this.facing)<A.minTurnWidth?Math.sign(this.facing||this.dir)*A.minTurnWidth:this.facing;
  const active=A[this.state],progress=clamp(this.clock/(active.frames/active.fps));
  const breathing=Math.sin(this.time*TAU*.72),tailLift=Math.sin(this.phase*TAU)*clamp(this.speed/230);
  let stretch=1,squash=1,bob=breathing*(this.state==='idle'?1.5:.55),lean=this.tilt;
  if(this.state==='dash'){
   const prep=Math.exp(-Math.pow((progress-.12)/.13,2)),push=Math.exp(-Math.pow((progress-.48)/.2,2));
   stretch=1-.065*prep+.095*push+.035*progress;squash=1+.05*prep-.055*push;lean+=tailLift*.015;
  }else if(this.state==='bite'){
   stretch=1-.04*Math.sin(progress*Math.PI*2)+.075*Math.sin(progress*Math.PI);squash=1-.045*Math.sin(progress*Math.PI);
  }else if(this.state==='hurt'){stretch=1-.09*(1-progress);squash=1+.075*(1-progress);lean-=this.dir*(1-progress)*.07;}
  else if(this.state==='eat'||this.eat>0){const swallow=Math.sin(this.eat/(A.eat.frames/A.eat.fps)*Math.PI);stretch=1+.018*swallow;squash=1-.012*swallow;}
  else if(this.state==='celebrate'){bob-=Math.sin(progress*Math.PI)*5;lean+=Math.sin(progress*TAU)*.055;}
  else {stretch=1+clamp(this.speed/500)*.025;squash=1+breathing*.008;lean+=tailLift*.012;}
  const turnOffset=(this.facing-direction)*(A.face[0]-.5)*height*stretch;
  c.save();c.translate(x+turnOffset,y+bob);c.rotate(lean+this.turn*.035*this.dir);c.scale(direction*stretch,squash*(1+this.turn*.025));
  if(this.old&&blend<1&&this.transition){
   const t=this.transitionContext,w=this.transition.width;
   t.clearRect(0,0,w,w);t.save();t.translate(w/2,w/2);
   t.globalCompositeOperation='source-over';this.pose(t,cycles,this.old,this.oldClock,this.oldPhase,A.width,1-blend);
   t.globalCompositeOperation='lighter';this.pose(t,cycles,this.state,this.clock,this.phase,A.width,blend);
   t.restore();
   const scale=height/A.width;c.drawImage(this.transition,-w/2*scale,-w/2*scale,w*scale,w*scale);
  }else this.pose(c,cycles,this.state,this.clock,this.phase,height,1);
  c.restore();
 }
}
