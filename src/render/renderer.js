import { VIEW } from '../data/render.js';
import { Camera } from './camera.js';
import { TerrainRenderer } from './terrain.js';
import { Animator,prepareHeroFrames,drawCycle } from './animation.js';
import { Cinematics } from './cinematics.js';
import { BossRenderer } from './boss.js';
import { Scenery } from './scenery.js';
import { Effects } from './fx.js';
import { HUD } from './hud.js';
import { background,foreground,gates,workplace,prepareBackdrops } from './layers.js';
import { hazards,objectives } from './world.js';
import { fish,ellipse,setSpriteAtlases } from './sprites.js';
import { P } from './palette.js';
import { text } from '../data/index.js';
import { ecology } from './ecology.js';
import { TUNING as T } from '../data/tuning.js';
import idleURL from '../../assets/side/act-hero-idle.webp';
import swimURL from '../../assets/side/act-hero-swim.webp';
import dashURL from '../../assets/side/act-hero-dash.webp';
import biteURL from '../../assets/side/act-hero-bite.webp';
import singURL from '../../assets/side/act-hero-sing.webp';
import hurtURL from '../../assets/side/act-hero-hurt.webp';
import eatURL from '../../assets/side/act-hero-eat.webp';
import celebrateURL from '../../assets/side/act-hero-celebrate.webp';
import bossURL from '../../assets/side/atlas-boss.webp';
import restURL from '../../assets/side/atlas-boss-rest.webp';
import memoryURL from '../../assets/side/atlas-memories.webp';
import bayURL from '../../assets/side/bg-bay.webp';
import ferryURL from '../../assets/side/bg-ferry.webp';
import violetURL from '../../assets/side/bg-violet.webp';
import abyssURL from '../../assets/side/bg-abyss.webp';
import templeURL from '../../assets/side/bg-temple.webp';
import sceneryURL from '../../assets/side/atlas-scenery.webp';
import materialsURL from '../../assets/side/atlas-materials.webp';
import fishURL from '../../assets/side/atlas-fish.webp';
import lootURL from '../../assets/side/atlas-loot.webp';
import landmarkURL from '../../assets/side/atlas-landmark.webp';
const image=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});
function edibleMarker(player,fish){
 if(fish.tier<0)return null;
 const behind=(player.x-fish.x)*fish.dir<0;
 return fish.kind!=='abyss'&&fish.tier<=player.tier&&(fish.kind!=='royal'||!fish.armored||behind);
}
export class Renderer {
 constructor(canvas,bus,settings){
  this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.settings=settings;this.camera=new Camera();this.animator=new Animator();
  this.terrain=new TerrainRenderer();this.fx=new Effects(bus,this.camera,this.animator);this.hud=new HUD();this.clock=0;
  this.cinema=new Cinematics(bus,canvas);this.metrics={drawImages:0,maxDrawImages:0,drawMs:0};
  const draw=this.c.drawImage.bind(this.c);this.c.drawImage=(...a)=>{this.metrics.drawImages++;draw(...a);};
  bus.on('state.change',()=>{this.camera.ready=false;this.terrain.clear();});
 }
 async init(){
  const urls=[idleURL,swimURL,dashURL,biteURL,singURL,hurtURL,eatURL,celebrateURL,bossURL,restURL,memoryURL,sceneryURL,materialsURL,fishURL,lootURL,landmarkURL];
  const [images,seas]=await Promise.all([Promise.all(urls.map(image)),Promise.all([bayURL,ferryURL,violetURL,abyssURL,templeURL].map(image))]);
  this.hero=prepareHeroFrames(Object.fromEntries(['idle','swim','dash','bite','sing','hurt','eat','celebrate'].map((key,i)=>[key,images[i]])));
  this.bossView=new BossRenderer(images[8],images[9]);this.cinema.init(images[10],images[9]);this.backdrop=prepareBackdrops(seas);this.cinema.backdrops=this.backdrop;
  this.scenery=new Scenery(images[11]);this.terrain.setMaterials(images[12]);setSpriteAtlases(images[13],images[14],images[15]);this.resize();
 }
 resize(){const cssScale=this.canvas.getBoundingClientRect().width/VIEW.w;const dpr=Math.min(VIEW.dpr,Math.max(1,cssScale)*(globalThis.devicePixelRatio||1));this.canvas.width=Math.round(VIEW.w*dpr);this.canvas.height=Math.round(VIEW.h*dpr);this.dpr=dpr;}
 step(g,dt){this.clock+=dt;this.camera.step(g,dt,this.settings);this.animator.step(g.player,dt);this.fx.step(dt);this.cinema.step(dt);}
 draw(g,alpha,mode,meta){
  const start=performance.now(),c=this.c,cam=this.camera;
  this.metrics.drawImages=0;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.lineJoin='round';c.lineCap='round';c._jgContrast=this.settings.contrast;
  if(['TITLE','ORDERS','SHOP','JOURNAL','ROOM','DAWN'].includes(mode)||mode==='SETTINGS'&&g.state==='TITLE'){
   workplace(c,this.hero,this.clock,meta.data.souvenirs);
   if(mode==='DAWN'&&this.cinema.lastLineTime>0)this.cinema.caption(c,this.cinema.lastLine,VIEW.h-24);
   this.metrics.drawMs=performance.now()-start;return;
  }
  background(c,g,cam,this.clock,this.backdrop);cam.begin(c);
  this.scenery.landmarks(c,g,cam,this.clock);this.terrain.draw(c,g.scene,cam,g.level.palette,g.scene.layer==='deep',this.settings.contrast);this.scenery.edges(c,g,cam,this.clock);gates(c,g,cam);hazards(c,g,cam);
  objectives(c,g,cam,this.clock);ecology(c,g,cam,this.clock);
  for(const f of g.fish)if(f!==g.counterkill?.fish&&cam.visible(f.x,f.y,f.r))fish(c,f,g.level.palette,this.clock,this.settings.contrast,g.state==='DEEP'?edibleMarker(g.player,f):null);
  for(const f of g.entities.nightmares||[])if(cam.visible(f.x,f.y,f.r))fish(c,f,g.level.palette,this.clock,this.settings.contrast);
  for(const f of g.chain){ellipse(c,f.x,f.y,10,5,P.dream,P.ink,1);}
  if(g.boss)this.bossView.draw(c,g,this.clock);
  const p=g.player,x=p.prevX+(p.x-p.prevX)*alpha,y=p.prevY+(p.y-p.prevY)*alpha;
  if(p.singing){c.strokeStyle=P.dream;c.lineWidth=1.5;for(let i=0;i<2;i++){c.beginPath();c.arc(x,y,45+i*19+(g.song.phase%1)*16,0,Math.PI*2);c.stroke();}}
  if(p.shield>0){c.strokeStyle=P.bone;c.lineWidth=2;c.beginPath();c.ellipse(x,y,70*p.size,74*p.size,0,0,Math.PI*2);c.stroke();}
  c.save();if(p.invuln>0&&Math.floor(p.invuln*14)%2)c.globalAlpha=.5;if(!g.counterkill&&!g.boss?.down)this.animator.draw(c,this.hero,p,x,y);c.restore();
  this.cinema.counter(c,g,this.hero);
  this.fx.world(c);cam.end(c);foreground(c,g,cam,this.clock);
  if(g.boss?.darkness&&!g.boss.down&&!this.settings.contrast){
   const lamp=p.buffs.some(b=>b.key==='lamp'),x=cam.screenX(lamp?p.x:g.boss.x),y=cam.screenY(lamp?p.y:g.boss.y),r=(lamp?420:T.bossAttack.lampRadius)*cam.scale;
   c.save();c.fillStyle=P.ink;c.globalAlpha=.92;c.beginPath();c.rect(0,0,VIEW.w,VIEW.h);
   const cone=g.boss.lampCone;
   if(lamp||!cone){c.moveTo(x+r,y);c.arc(x,y,r,0,Math.PI*2);}
   else{c.moveTo(x,y);c.arc(x,y,r,cone.angle-cone.halfAngle,cone.angle+cone.halfAngle);c.closePath();}
   c.fill('evenodd');c.restore();
  }
  if(mode==='PLAY'&&!g.boss?.down)this.hud.draw(c,g);
  if(!g.boss?.down)this.fx.screen(c,g,this.settings);
  this.cinema.evolution(c,g,this.hero);this.cinema.choirScene(c,g);
  if(g.state==='DESCENT')this.cinema.descent(c,g,this.hero);
  else if(g.state==='DEEP'&&this.cinema.descentLineTime>0)this.cinema.caption(c,text(g.level.client.lineKey));
  if(g.state==='BOSS'&&g.boss?.down){
   const b=g.boss,fade=Math.min(1,(4-b.defeatTimer)/.72);
   const heroX=cam.screenX(x)*(1-fade)+315*fade,heroY=cam.screenY(y)*(1-fade)+272*fade;
   const bossX=cam.screenX(b.x)*(1-fade)+632*fade,bossY=cam.screenY(b.y)*(1-fade)+248*fade;
   c.save();c.fillStyle=P.night;c.globalAlpha=.32*fade;c.fillRect(0,0,VIEW.w,VIEW.h);c.restore();
   drawCycle(c,this.hero.idle,this.clock/this.hero.idle.duration,heroX,heroY,188,1);
   this.bossView.ending(c,g,bossX,bossY,heroX,heroY);this.cinema.defeatSubtitle(c,b);
  }
  if(mode==='ENDING')this.cinema.failureScene(c,g,this.hero);
  if(mode==='PAUSE'||mode==='MAP'||mode==='SETTINGS'){c.fillStyle=P.ink;c.globalAlpha=.35;c.fillRect(0,0,VIEW.w,VIEW.h);c.globalAlpha=1;}
  this.metrics.maxDrawImages=Math.max(this.metrics.maxDrawImages,this.metrics.drawImages);this.metrics.drawMs=performance.now()-start;
 }
}
