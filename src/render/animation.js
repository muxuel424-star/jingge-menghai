import { ANIMATION as A } from '../data/render.js';
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function cell(image,index,cols,rows) {
 const w=image.width/cols,h=image.height/rows,c=canvas(w,h);
 c.getContext('2d').drawImage(image,index%cols*w,Math.floor(index/cols)*h,w,h,0,0,w,h);return c;
}
function triangle(c,source,a,b,d){
 const cx=(a.x+b.x+d.x)/3,cy=(a.y+b.y+d.y)/3;
 c.save();c.beginPath();for(const [i,p]of [a,b,d].entries()){const x=cx+(p.x-cx)*1.02,y=cy+(p.y-cy)*1.02;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.clip();
 const xx=(b.x-a.x)/(b.u-a.u),xy=(b.y-a.y)/(b.u-a.u),yx=(d.x-a.x)/(d.v-a.v),yy=(d.y-a.y)/(d.v-a.v);
 c.transform(xx,xy,yx,yy,a.x-xx*a.u-yx*a.v,a.y-xy*a.u-yy*a.v);c.drawImage(source,0,0);c.restore();
}
function cycle(image,def){
 const source=canvas(A.width,Math.round(image.height/image.width*A.width)),sc=source.getContext('2d');sc.drawImage(image,0,0,source.width,source.height);
 const margin=32,frames=[],w=source.width,h=source.height;
 for(let f=0;f<def.frames;f++){
  const frame=canvas(w+margin*2,h+margin*2),c=frame.getContext('2d'),phase=f/def.frames*Math.PI*2;
  const grid=[];
  for(let y=0;y<=A.rows;y++){const row=[];for(let x=0;x<=A.cols;x++){
   const u=x/A.cols,v=y/A.rows,trailing=Math.max(0,(.8-u)/.8);
   const tail=Math.exp(-Math.pow((v-.62)/.35,2)),hair=Math.exp(-Math.pow((v-.25)/.3,2));
   const root=Math.sin(phase*.6-u*2)*.02,body=Math.sin(phase-u*3.5-.12)*.05,tip=Math.sin(phase*1.6-u*5-.24)*.09;
   row.push({u:u*w,v:v*h,x:margin+u*w+(root+body+tip)*trailing*def.power*w*.3,y:margin+v*h+(body*tail+tip*hair)*trailing*def.power*h});
  }grid.push(row);}
  for(let y=0;y<A.rows;y++)for(let x=0;x<A.cols;x++){const a=grid[y][x],b=grid[y][x+1],d=grid[y+1][x],e=grid[y+1][x+1];triangle(c,source,a,b,d);triangle(c,source,e,d,b);}
  frames.push(frame);
 }
 return {frames,w,h,margin};
}
export function prepareHero(atlas){
 const out={};Object.entries(A).filter(([,d])=>d.frames).forEach(([key,def],i)=>out[key]=cycle(cell(atlas,i,4,2),def));return out;
}
export class Animator {
 constructor(){this.state='idle';this.old=null;this.clock=0;this.fade=1;this.eat=0;this.hurt=0;this.celebrate=0;this.turn=0;this.dir=1;this.lastBite=0;this.bite=0;}
 trigger(kind){if(kind==='eat')this.eat=.43;if(kind==='hurt')this.hurt=.29;if(kind==='evolve'||kind==='boss.down')this.celebrate=.8;}
 step(p,dt){
  this.clock+=dt;this.eat=Math.max(0,this.eat-dt);this.hurt=Math.max(0,this.hurt-dt);this.celebrate=Math.max(0,this.celebrate-dt);
  this.bite=Math.max(0,this.bite-dt);
  if(p.biteId>this.lastBite){this.lastBite=p.biteId;this.bite=A.bite.frames/A.bite.fps;if(this.state==='bite')this.clock=0;}
  else if(p.biteId<this.lastBite){this.lastBite=p.biteId;this.bite=0;}
  const state=this.hurt?'hurt':this.celebrate?'celebrate':this.bite>0?'bite':this.eat?'eat':p.singing?'sing':p.dashing?'dash':Math.hypot(p.vx,p.vy)>25?'swim':'idle';
  if(state!==this.state){this.old=this.state;this.state=state;this.clock=0;this.fade=0;}
  this.fade=Math.min(1,this.fade+dt/A.fade);
  if(this.dir!==p.dir){this.dir=p.dir;this.turn=A.turnHold;}this.turn=Math.max(0,this.turn-dt);
 }
 draw(c,cycles,p,x,y){
  const height=[128,192,281][p.tier],tilt=Math.max(-.22,Math.min(.22,p.vy/900))*p.dir+this.turn*.6;
  const draw=(state,alpha)=>{
   const v=cycles[state],def=A[state],loop=state==='idle'||state==='swim'||state==='sing';
   const fps=state==='swim'?Math.min(14,9+Math.hypot(p.vx,p.vy)/80):def.fps;
   const fi=loop?Math.floor(this.clock*fps)%v.frames.length:Math.min(v.frames.length-1,Math.floor(this.clock*fps));
   c.save();c.translate(x,y);c.rotate(tilt);c.scale(p.dir,1);c.globalAlpha*=alpha;
   const scale=height/v.h; c.drawImage(v.frames[fi],-(v.w/2+v.margin)*scale,-(v.h/2+v.margin)*scale,(v.w+2*v.margin)*scale,(v.h+2*v.margin)*scale);c.restore();
  };
  if(this.old&&this.fade<1)draw(this.old,1-this.fade);draw(this.state,this.fade);
 }
}

