import { P } from './palette.js';
import { FX,VIEW } from '../data/render.js';
import { text,SPECIES } from '../data/index.js';
const TAU=Math.PI*2;
export class Effects {
 constructor(bus,camera,animator){
  this.camera=camera;
  this.pool=Array.from({length:FX.limit},()=>({ttl:0}));this.next=0;this.notice='';this.noticeT=0;this.story='';this.storyT=0;this.flash=0;this.hurtAngle=0;this.hurtT=0;
  const add=(type,p)=>this.add(type,p);
  for(const name of ['eat','dream.collect','dream.deliver','song.release','hurt','bite','evolve','boss.hurt','boss.down','shield.break','melody.collect'])bus.on(name,p=>add(name,p));
  for(const name of Object.keys(FX.shake))bus.on(name,p=>{if(name==='bite'&&!p.hit)return;camera.impulse(FX.shake[name]);});
  bus.on('notify',p=>{this.notice=p.text||'';this.noticeT=p.ttl||3;});
  bus.on('fragment.collect',p=>{this.story=text(p.textKey);this.storyT=7;});
  bus.on('song.release',p=>{this.notice={perfect:'完美',good:'应答',miss:'错拍'}[String(p.quality).toLowerCase()]||'';this.noticeT=1.2;});
  for(const name of ['eat','hurt','evolve','boss.down'])bus.on(name,()=>animator.trigger(name));
  bus.on('boss.enter',p=>this.dialogue(p.key,'enter'));
  bus.on('boss.phase',p=>this.dialogue(p.key,'phase'+p.phase));
  bus.on('boss.gate',p=>this.dialogue(p.key,'gate'));
  bus.on('boss.down',p=>{this.dialogue(p.key,'defeat');this.storyT=4;});
 }
 dialogue(key,line){this.story=text('boss.'+key+'.'+line);this.storyT=4;}
 add(type,p){
  if(type==='bite'&&!p.hit)return;
  const e=this.pool[this.next++%FX.limit];e.type=type;e.x=p.x||0;e.y=p.y||0;e.ttl=type==='song.release'?.9:type==='evolve'?1.2:.5;e.life=e.ttl;e.radius=p.radius||80;e.quality=p.quality;
  e.label=type==='eat'?'+'+(SPECIES[p.kind]?.mem||p.mem||3)+' 忆质':type==='dream.deliver'?'+'+p.count+' 梦':type==='melody.collect'?'♫':'';
  if(type==='hurt'){this.flash=.05;this.hurtT=.4;this.hurtAngle=Math.atan2((p.fromY??p.y)-p.y,(p.fromX??p.x)-p.x);}
 }
 step(dt){for(const e of this.pool)if(e.ttl>0)e.ttl-=dt;this.noticeT-=dt;this.storyT-=dt;this.flash-=dt;this.hurtT-=dt;}
 world(c){
  c.textAlign='center';c.font='12px "Microsoft YaHei UI"';
  for(const e of this.pool){
   if(e.ttl<=0)continue;const age=1-e.ttl/e.life;
   c.save();c.globalAlpha=Math.min(1,e.ttl*4);
   if(e.type==='song.release'){
    c.strokeStyle=P.dream;c.lineWidth=2;
    for(let i=0;i<3;i++){c.beginPath();c.arc(e.x,e.y,Math.max(1,e.radius*age-i*16),0,TAU);c.stroke();}
    for(let i=0;i<4;i++){const a=i/4*TAU;c.beginPath();c.moveTo(e.x+Math.cos(a)*e.radius*age,e.y+Math.sin(a)*e.radius*age);c.lineTo(e.x+Math.cos(a)*(e.radius*age+15),e.y+Math.sin(a)*(e.radius*age+15));c.stroke();}
   }else if(e.type==='hurt'||e.type==='bite'||e.type==='boss.hurt'||e.type==='shield.break'){
    c.strokeStyle=e.type==='hurt'?P.fear:P.white;c.lineWidth=2;
    for(let i=0;i<8;i++){const a=i/8*TAU+.15*Math.sin(i*31);c.beginPath();c.moveTo(e.x+Math.cos(a)*(12+age*25),e.y+Math.sin(a)*(12+age*25));c.lineTo(e.x+Math.cos(a)*(25+age*38),e.y+Math.sin(a)*(25+age*38));c.stroke();}
   }else if(e.type==='eat'||e.type==='dream.collect'||e.type==='dream.deliver'){
    c.strokeStyle=P.dream;c.lineWidth=2;c.beginPath();
    for(let i=0;i<25;i++){const a=i*.4+age*6,r=(25-i)*(1-age);const x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
   }
   if(e.label){c.fillStyle=P.bone;c.fillText(e.label,e.x,e.y-25-age*30);}
   c.restore();
  }
 }
 screen(c,game,settings){
  if(!settings.contrast&&game.player?.stability<30&&game.state!=='TITLE'){
   c.save();c.globalAlpha=(1-game.player.stability/30)*.18;c.fillStyle=P.night;c.fillRect(0,0,VIEW.w,VIEW.h);c.restore();
  }
  if(this.flash>0){c.save();c.globalAlpha=.12;c.fillStyle=P.white;c.fillRect(0,0,VIEW.w,VIEW.h);c.restore();}
  if(this.hurtT>0){c.save();c.translate(VIEW.w/2,VIEW.h/2);c.rotate(this.hurtAngle);c.strokeStyle=P.fear;c.lineWidth=5;c.beginPath();c.arc(0,0,95,-.22,.22);c.stroke();c.restore();}
  if(game.evolutionTimer>0){
   const age=1-game.evolutionTimer/1.2,x=this.camera.screenX(game.player.x),y=this.camera.screenY(game.player.y);
   if(age>.07&&age<.15){c.save();c.globalAlpha=.6;c.fillStyle=P.white;c.fillRect(0,0,VIEW.w,VIEW.h);c.restore();}
   c.save();c.strokeStyle=P.bone;c.lineWidth=3;c.globalAlpha=Math.sin(age*Math.PI)*.7;
   for(let i=0;i<12;i++){const a=i/12*TAU,r=50+Math.sin(age*Math.PI)*100; c.save();c.translate(x+Math.cos(a)*r,y+Math.sin(a)*r);c.rotate(a+age*3);c.strokeRect(-8,-14,16,28);c.restore();}
   c.restore();
  }
  c.textAlign='center';
  if(this.noticeT>0){c.font='14px "Microsoft YaHei UI"';const w=Math.min(680,c.measureText(this.notice).width+38);c.fillStyle=P.paper;c.fillRect((VIEW.w-w)/2,88,w,32);c.fillStyle=P.ink;c.fillText(this.notice,VIEW.w/2,109);}
  if(this.storyT>0){c.font='18px "STKaiti","KaiTi",serif';const w=Math.min(760,c.measureText(this.story).width+48);c.fillStyle=P.paper;c.fillRect((VIEW.w-w)/2,VIEW.h-150,w,48);c.fillStyle=P.ink;c.fillText(this.story,VIEW.w/2,VIEW.h-120);}
 }
}
