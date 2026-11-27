import { Game } from './sim/game.js';
import { EventBus } from './sim/bus.js';
import { TUNING as T } from './data/tuning.js';
import { LEVELS } from './data/index.js';
import { Meta } from './ui/meta.js';
import { Screens } from './ui/screens.js';
import { Renderer } from './render/renderer.js';
import { drawMap } from './render/hud.js';
import { AudioEngine } from './audio/engine.js';
const canvas=document.querySelector('#game'),root=document.querySelector('#screens');
const meta=new Meta(),bus=new EventBus(),game=new Game({seed:267125,meta:meta.data,bus});
const renderer=new Renderer(canvas,bus,meta.settings),audio=new AudioEngine({bus});
let mode='TITLE',previousMode='TITLE',last=0,ready=false,paused=false,briefTime=0;
const held={x:0,y:0,dash:false,bite:false,sing:false},keys=new Set();
const metrics={simMs:0,frameMs:0,frames:0,maxSimMs:0,maxFrameMs:0};
const screens=new Screens(root,meta,action);
function clearInput(){keys.clear();held.x=held.y=0;held.dash=held.bite=held.sing=false;game.cancelHeld();}
function show(next){mode=next;paused=!['PLAY','BRIEF'].includes(next);if(next==='BRIEF')briefTime=0;clearInput();screens.show(next,game);audio.suspend(['PAUSE','MAP'].includes(next)||next==='SETTINGS'&&previousMode==='PAUSE');}
function unlockAudio(){audio.init().then(()=>audio.setMuted(meta.settings.muted));}
function action(name,data={}){
 if(name!=='settings.changed')unlockAudio();
 bus.emit(name==='accept'||name==='begin'?'ui.confirm':'ui.pick',{});
 if(name==='select'){screens.selected=+data.level;show('ORDERS');}
 else if(name==='orders'){meta.fillMissions();show('ORDERS');}
 else if(name==='accept'){
  game.start(LEVELS.find(l=>l.level===screens.selected).key);show('BRIEF');
 }else if(name==='begin'){game.begin();show('PLAY');}
 else if(name==='revisit'){
  game.start(LEVELS.find(l=>l.level===screens.selected).key,{retry:true});show('PLAY');
 }else if(name==='retry'){game.retry();show('PLAY');}
 else if(name==='pause'){if(mode==='PLAY'&&game.state!=='DESCENT'&&!game.boss?.down)show('PAUSE');else if(mode==='PAUSE'||mode==='MAP')show('PLAY');}
 else if(name==='resume')show('PLAY');
 else if(name==='map'){if(game.state==='DESCENT'||game.boss?.down)return;show(mode==='MAP'?'PLAY':'MAP');const map=document.querySelector('#map');if(map)drawMap(map,game);}
 else if(name==='skip'&&game.state==='DESCENT')game.skipDescent();
 else if(name==='room')show('ROOM');
 else if(name==='home'){game.transition('TITLE');meta.save(true);show('TITLE');}
 else if(name==='settings'){previousMode=mode;show('SETTINGS');}
 else if(name==='settings.back')show(previousMode);
 else if(name==='settings.changed'){audio.setMuted(meta.settings.muted);}
 else if(name==='shop')show('SHOP');
 else if(name==='journal')show('JOURNAL');
 else if(name==='buy'){meta.buy(data.key);show('SHOP');}
}
bus.on('state.change',({to})=>{
 meta.save(true);
 if(to==='DAWN'){meta.settle(game.result,{level:game.level.level,tier:game.player.tier});show(game.result.won?'DAWN':'ENDING');bus.emit('ui.seal',{});}
 else if(to==='BRIEF')show('BRIEF');
 else if(to==='SURFACE'||to==='DEEP'||to==='BOSS'||to==='DESCENT')show('PLAY');
});
document.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();if(['tab',' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
 if(e.repeat){if(mode==='PLAY')keys.add(k);return;}
 if(k==='m'){meta.settings.muted=!meta.settings.muted;audio.setMuted(meta.settings.muted);meta.save(true);return;}
 if(k==='escape'){
  if(mode==='ENDING'){renderer.cinema.skipFailure();}
  else if(mode==='PLAY'&&game.boss?.down){renderer.cinema.skipDefeat(game.boss);game.skipDescent();}
  else if((game.state==='DESCENT'||game.evolutionTimer>0)&&mode==='PLAY')game.skipDescent();
  else if(mode==='PLAY')show('PAUSE');else if(mode==='PAUSE'||mode==='MAP')show('PLAY');else if(mode==='SETTINGS')show(previousMode);
  return;
 }
 if(k==='tab'&&(mode==='PLAY'||mode==='MAP')){
  action('map');return;
 }
 if(k==='enter'&&mode==='BRIEF'){action('begin');return;}
 if(mode==='PLAY'){keys.add(k);unlockAudio();}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{clearInput();if(mode==='PLAY'&&game.state!=='DESCENT')show('PAUSE');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(mode==='PLAY')show('PAUSE');}last=0;});
window.addEventListener('resize',()=>renderer.resize());
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(mode!=='PLAY'||e.pointerType==='touch')return;
 if(e.button===0)held.bite=true;else if(e.button===2)held.sing=true;
 canvas.setPointerCapture(e.pointerId);unlockAudio();e.preventDefault();
});
const releaseMouse=e=>{if(e.button===0)held.bite=false;if(e.button===2)held.sing=false;};
canvas.addEventListener('pointerup',releaseMouse);
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{held.bite=held.sing=false;});
for(const b of document.querySelectorAll('[data-hold]')){
 b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held[b.dataset.hold]=true;unlockAudio();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>held[b.dataset.hold]=false);
}
document.querySelector('[data-action="pause"]')?.addEventListener('click',()=>action('pause'));
const stick=document.querySelector('#stick'),knob=stick.querySelector('span');let stickId=null;
const moveStick=e=>{const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,d=Math.max(r.width*.4,Math.hypot(x,y));held.x=x/d;held.y=y/d;knob.style.transform='translate('+held.x*25+'px,'+held.y*25+'px)';};
stick.addEventListener('pointerdown',e=>{e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);unlockAudio();});
stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,()=>{stickId=null;held.x=held.y=0;knob.style.transform='';});
function frame(now){
 const begin=performance.now(),dt=last?Math.min(T.sim.maxDt,(now-last)/1000):0;last=now;
 if(ready){
  if(mode==='BRIEF'&&(briefTime+=dt)>=T.run.briefMax)action('begin');
  if(mode==='PLAY'||mode==='BRIEF'){
   const start=performance.now();
   game.step(dt,{x:(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+held.x,
    y:(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+held.y,
    dash:keys.has('shift')||held.dash,bite:keys.has('j')||held.bite,sing:keys.has('f')||keys.has(' ')||held.sing});
   metrics.simMs=performance.now()-start;metrics.maxSimMs=Math.max(metrics.maxSimMs,metrics.simMs);
  }
  const animateMenu=['TITLE','ORDERS','SHOP','JOURNAL','ROOM','DAWN','ENDING'].includes(mode)||mode==='SETTINGS'&&game.state==='TITLE';
  renderer.step(game,paused&&!animateMenu?0:dt);renderer.draw(game,Math.max(0,Math.min(1,game.accumulator/T.sim.step)),mode,meta);audio.update(game);
  if(mode==='ENDING'&&renderer.cinema.failureDone)show('DAWN');
 }
 metrics.frames++;metrics.frameMs=performance.now()-begin;metrics.maxFrameMs=Math.max(metrics.maxFrameMs,metrics.frameMs);
 requestAnimationFrame(frame);
}
async function boot(){
 await renderer.init();audio.setMuted(meta.settings.muted);ready=true;document.querySelector('#loading').textContent='';show('TITLE');requestAnimationFrame(frame);
}
window.addEventListener('pagehide',()=>meta.flush());
window.__jg2d={game,meta,renderer,audio,screens,metrics,action,get screen(){return mode;},get ready(){return ready;},step:(n,input={})=>{for(let i=0;i<n;i++)game.step(T.sim.step,input);}};
boot().catch(error=>{console.error(error);document.querySelector('#loading').textContent='鲸宫没能亮灯，请重新打开游戏。';});
