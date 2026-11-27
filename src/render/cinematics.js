import { P } from './palette.js';
import { VIEW, ANIMATION } from '../data/render.js';
import { text } from '../data/index.js';
import { drawCycle,cell } from './animation.js';
import { ellipse,poly,fish } from './sprites.js';
const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
export class Cinematics{
 constructor(bus,canvas){
  this.canvas=canvas;this.failure=null;this.failureAge=0;this.choir=0;this.lastLine=null;this.lastLineTime=0;this.descentLineTime=0;
  this.frozen=document.createElement('canvas');this.frozen.width=VIEW.w;this.frozen.height=VIEW.h;
  bus.on('evolve',()=>{const c=this.frozen.getContext('2d');c.filter='grayscale(1)';c.drawImage(canvas,0,0,VIEW.w,VIEW.h);c.filter='none';});
  bus.on('awakening',()=>{this.choir=14;});
  bus.on('run.finish',r=>{this.failure=r.won?null:r.outcome;this.failureAge=0;});
  bus.on('state.change',({from,to})=>{
   if(from==='DESCENT'&&to==='DEEP')this.descentLineTime=1;
   if(to==='BRIEF'||to==='DESCENT'||to==='TITLE'){this.failure=null;this.choir=0;this.lastLineTime=0;this.descentLineTime=0;}
  });
 }
 init(memories,bossRest){this.memories=memories;this.rest=Array.from({length:5},(_,i)=>cell(bossRest,i,3,2));}
 step(dt){this.choir=Math.max(0,this.choir-dt);this.lastLineTime=Math.max(0,this.lastLineTime-dt);this.descentLineTime=Math.max(0,this.descentLineTime-dt);if(this.failure)this.failureAge+=dt;}
 skipDefeat(boss){this.lastLine=text(boss.spec.dialogue.defeat);this.lastLineTime=2;}
 defeatSubtitle(c,boss){
  const t=4-boss.defeatTimer;if(t<.08){c.save();c.globalAlpha=.62;c.fillStyle=P.white;c.fillRect(0,0,VIEW.w,VIEW.h);c.restore();}
  if(t>=(boss.spec.defeat.lineAt??2.2))this.caption(c,text(boss.spec.dialogue.defeat));
 }
 get failureDone(){return this.failure&&this.failureAge>=4;}
 skipFailure(){if(this.failure)this.failureAge=Math.max(this.failureAge,2);}
 caption(c,line,y=VIEW.h-112){
  c.save();c.font='19px "STKaiti","KaiTi",serif';c.textAlign='center';
  const w=Math.min(VIEW.w-80,c.measureText(line).width+44);c.fillStyle=P.paper;c.fillRect((VIEW.w-w)/2,y-30,w,46);c.fillStyle=P.ink;c.fillText(line,VIEW.w/2,y);c.restore();
 }
 counter(c,g,hero){
  const k=g.counterkill;if(!k)return;
  const a=ease(1-k.remaining/2),p=g.player,f=k.fish;
  c.save();c.translate(p.x,p.y);c.rotate(-Math.sin(a*Math.PI)*.24*p.dir);
  drawCycle(c,hero.bite,Math.min(1,a*2),0,0,ANIMATION.height[p.tier]*(1+Math.sin(a*Math.PI)*.25),p.dir);
  c.restore();
  c.save();c.translate(p.x+(f.x-p.x)*(1-a),p.y+(f.y-p.y)*(1-a));c.rotate(a*TAU);c.scale(1-a*.98,1-a*.98);
  c.translate(-f.x,-f.y);fish(c,f,g.level.palette,0,false);c.restore();
 }
 evolution(c,g,hero){
  if(!(g.evolutionTimer>0))return;
  const t=1.2-g.evolutionTimer,p=g.player,x=VIEW.w/2,y=VIEW.h/2,newH=ANIMATION.height[p.tier],oldH=ANIMATION.height[Math.max(0,p.tier-1)];
  c.drawImage(this.frozen,0,0);const appear=ease((t-.5)/.5);
  if(t<.5)drawCycle(c,hero.idle,0,x,y,oldH,p.dir,1-ease(t/.4));
  if(t>.45){c.save();c.globalAlpha=appear;c.translate(x,y);c.scale(1,1+Math.sin(appear*Math.PI)*.08);drawCycle(c,t>1?hero.celebrate:hero.idle,t>1?(t-1)/.8:0,0,0,newH,p.dir);c.restore();}
  const spread=Math.sin(clamp((t-.2)/.9)*Math.PI),r=45+spread*130;
  if(t>.2&&t<1.1)for(let i=0;i<12;i++){
   const a=i/12*TAU;c.save();c.translate(x+Math.cos(a)*r,y+Math.sin(a)*r);c.rotate(a+spread*.8);
   poly(c,[[-8,-16],[8,-12],[12,15],[-10,19]],i%3===0?P.paper:P.hairShade,P.ink,1.5);c.restore();
  }
  if(t>=.1&&t<.14){c.save();c.globalAlpha=.7;c.fillStyle=P.white;c.fillRect(0,0,VIEW.w,VIEW.h);c.restore();}
 }
 descent(c,g,hero){
  const t=g.descentTime,progress=ease(t/2),cx=VIEW.w/2,cy=VIEW.h*.45;
  c.save();c.fillStyle=P.night;c.globalAlpha=clamp(t/2)*.9;c.fillRect(0,0,VIEW.w,VIEW.h);c.globalAlpha=1;
  if(t<2){c.translate(cx,cy);c.scale(1+progress*.08,1+progress*.08);drawCycle(c,hero.idle,t/hero.idle.duration,0,0,170,1);}
  if(t>=2&&t<4){
   const sw=this.memories.width/3,sh=this.memories.height/5;
   for(let i=0;i<3;i++){
    const local=clamp((t-2-i*.32)*3),w=220,h=150,x=cx+(i-1)*245-w/2,y=cy-h/2+(1-local)*25;
    c.save();c.globalAlpha=local;c.fillStyle=P.paper;c.fillRect(x-5,y-5,w+10,h+10);
    c.drawImage(this.memories,i*sw,(g.level.level-1)*sh,sw,sh,x,y,w,h);c.restore();
   }
  }else if(t>=4&&t<6){
   const a=ease((t-4)/2);c.translate(cx,cy);c.scale(1-a*.8,1+a*3);c.globalAlpha=1-a;
   drawCycle(c,hero.dash,a,0,0,180,1);c.globalAlpha=.38;
   c.strokeStyle=P.dream;c.lineWidth=1.5;for(let i=0;i<18;i++){const x=Math.sin(i*19)*300;c.beginPath();c.moveTo(x,-70-i*8);c.lineTo(x,100+i*18);c.stroke();}
  }else if(t>=6){
   const preview=this.backdrops.layer(g.level.level-1,true),a=ease((t-6)/1.5);
   if(preview)c.drawImage(preview,0,0,VIEW.w,VIEW.h);
   c.globalAlpha=1-a;c.fillStyle=g.level.palette.hi;c.fillRect(0,0,VIEW.w,VIEW.h);c.globalAlpha=1;
   drawCycle(c,hero.swim,t/hero.swim.duration,cx,cy+32,128,1);
  }
  c.restore();
  if(t>7.5)this.caption(c,text(g.level.client.lineKey));
  else if(t<2)this.caption(c,text('cinema.descent'));
  c.save();c.font='11px "Microsoft YaHei UI"';c.fillStyle=P.bone;c.textAlign='center';c.fillText(text('cinema.skip'),cx,VIEW.h-24);c.restore();
 }
 failureScene(c,g,hero){
  if(!this.failure)return;
  const t=this.failureAge,a=ease(t/3),x=VIEW.w/2,y=VIEW.h/2;
  c.save();c.fillStyle=P.night;c.globalAlpha=.6;c.fillRect(0,0,VIEW.w,VIEW.h);c.globalAlpha=1;
  if(this.failure==='FADED'){
   c.save();c.globalAlpha=1-a;drawCycle(c,hero.idle,t/hero.idle.duration,x,y-t*15,170,1);c.restore();
   c.fillStyle=g.level.palette.mid;
   for(let i=0;i<12;i++){c.save();c.globalAlpha=(1-a)*.55;c.translate(x+Math.sin(i*15)*(30+a*190),y+(i-6)*20-a*60);c.rotate(a+i);c.fillRect(-12,-18,24,36);c.restore();}
  }else if(this.failure==='DEVOURED'){
   c.save();c.globalAlpha=1-ease((t-.7)/.8);drawCycle(c,hero.hurt,Math.min(1,t),x,y,160*(1-a*.7),1);c.restore();
   const gap=180*(1-ease(t/1.2));c.fillStyle=P.ink;c.fillRect(0,0,VIEW.w,y-gap);c.fillRect(0,y+gap,VIEW.w,VIEW.h);
   for(let i=0;i<8;i++){const px=x-260+i*72;poly(c,[[px,y-gap-25],[px+28,y-gap+16],[px+48,y-gap-25]],P.bone,P.ink,1);poly(c,[[px,y+gap+25],[px+28,y+gap-16],[px+48,y+gap+25]],P.bone,P.ink,1);}
   if(t>1.3){c.fillStyle=P.night;c.globalAlpha=ease((t-1.3)/.4);c.fillRect(0,0,VIEW.w,VIEW.h);c.globalAlpha=1;}
  }else{
   const handX=x+160*(1-a),handY=y+110-a*80;
   c.save();c.globalAlpha=.9;poly(c,[[VIEW.w,VIEW.h],[handX+70,handY+20],[handX-50,handY-20],[handX-70,handY-5],[handX-15,handY+70],[VIEW.w,VIEW.h]],P.paper,P.ink,3);c.restore();
   drawCycle(c,hero.idle,t/hero.idle.duration,handX-15,handY-70,150,1);
  }
  if(t>1){c.fillStyle=P.lamp;c.globalAlpha=.08*ease((t-1)/2);c.fillRect(0,0,VIEW.w,VIEW.h);c.globalAlpha=1;}
  if(t>1.8)this.caption(c,text('cinema.'+this.failure.toLowerCase()));
  c.restore();
 }
 choirScene(c,g){
  if(this.choir<=0)return;
  const age=14-this.choir,active=Math.min(3,Math.floor(age/3.333)),alpha=Math.min(1,age*2,this.choir);
  c.save();c.globalAlpha=alpha*.08;c.fillStyle=P.lamp;c.fillRect(0,0,VIEW.w,VIEW.h);
  for(let i=0;i<4;i++){const im=this.rest[i],x=130+i*230;c.globalAlpha=alpha*(i===active?.48:.12);c.drawImage(im,x-65,115,130,130);}
  c.restore();if(age>11)this.caption(c,text('cinema.awakening'),VIEW.h-170);
 }
}
