import { VIEW } from '../data/render.js';
import { Camera } from './camera.js';
import { TerrainRenderer } from './terrain.js';
import { Animator,prepareHero } from './animation.js';
import { BossRenderer } from './boss.js';
import { Scenery } from './scenery.js';
import { Effects } from './fx.js';
import { HUD } from './hud.js';
import { background,foreground,gates,workplace,prepareBackdrops } from './layers.js';
import { hazards,objectives } from './world.js';
import { fish,ellipse,poly } from './sprites.js';
import { P } from './palette.js';
import { text } from '../data/index.js';
import { TUNING as T } from '../data/tuning.js';
import heroURL from '../../assets/side/act-hero-atlas.webp';
import bossURL from '../../assets/side/atlas-boss.webp';
import backgroundURL from '../../assets/side/atlas-backgrounds.webp';
import sceneryURL from '../../assets/side/atlas-scenery.webp';
import materialsURL from '../../assets/side/atlas-materials.webp';
const image=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});
export class Renderer {
 constructor(canvas,bus,settings){
  this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.settings=settings;this.camera=new Camera();this.animator=new Animator();
  this.terrain=new TerrainRenderer();this.fx=new Effects(bus,this.camera,this.animator);this.hud=new HUD();this.clock=0;
  this.metrics={drawImages:0,maxDrawImages:0,drawMs:0};
  const draw=this.c.drawImage.bind(this.c);this.c.drawImage=(...a)=>{this.metrics.drawImages++;draw(...a);};
  bus.on('state.change',()=>{this.camera.ready=false;this.terrain.clear();});
 }
 async init(){const [h,b,bg,scenery,materials]=await Promise.all([image(heroURL),image(bossURL),image(backgroundURL),image(sceneryURL),image(materialsURL)]);this.hero=prepareHero(h);this.bossView=new BossRenderer(b);this.backdrop=prepareBackdrops(bg);this.scenery=new Scenery(scenery);this.terrain.setMaterials(materials);this.resize();}
 resize(){const cssScale=this.canvas.getBoundingClientRect().width/VIEW.w;const dpr=Math.min(VIEW.dpr,Math.max(1,cssScale)*(globalThis.devicePixelRatio||1));this.canvas.width=Math.round(VIEW.w*dpr);this.canvas.height=Math.round(VIEW.h*dpr);this.dpr=dpr;}
 step(g,dt){this.clock+=dt;this.camera.step(g,dt,this.settings);this.animator.step(g.player,dt);this.fx.step(dt);}
 draw(g,alpha,mode,meta){
  const start=performance.now(),c=this.c,cam=this.camera;
  this.metrics.drawImages=0;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.lineJoin='round';c.lineCap='round';c._jgContrast=this.settings.contrast;
  if(['TITLE','ORDERS','SHOP','JOURNAL','DAWN'].includes(mode)||mode==='SETTINGS'&&g.state==='TITLE'){
   workplace(c,this.hero,this.clock,meta.data.souvenirs);this.metrics.drawMs=performance.now()-start;return;
  }
  background(c,g,cam,this.clock,this.backdrop);cam.begin(c);
  this.scenery.landmarks(c,g,cam,this.clock);this.terrain.draw(c,g.scene,cam,g.level.palette,g.scene.layer==='deep',this.settings.contrast);this.scenery.edges(c,g,cam,this.clock);gates(c,g,cam);hazards(c,g,cam);
  objectives(c,g,cam,this.clock);
  for(const f of g.fish)if(cam.visible(f.x,f.y,f.r))fish(c,f,g.level.palette,this.clock,this.settings.contrast);
  for(const f of g.entities.nightmares||[])if(cam.visible(f.x,f.y,f.r))fish(c,f,g.level.palette,this.clock,this.settings.contrast);
  for(const f of g.chain){ellipse(c,f.x,f.y,10,5,P.dream,P.ink,1);}
  if(g.boss)this.bossView.draw(c,g,this.clock);
  const p=g.player,x=p.prevX+(p.x-p.prevX)*alpha,y=p.prevY+(p.y-p.prevY)*alpha;
  if(p.singing){c.strokeStyle=P.dream;c.lineWidth=1.5;for(let i=0;i<2;i++){c.beginPath();c.arc(x,y,45+i*19+(g.song.phase%1)*16,0,Math.PI*2);c.stroke();}}
  if(p.shield>0){c.strokeStyle=P.bone;c.lineWidth=2;c.beginPath();c.ellipse(x,y,70*p.size,74*p.size,0,0,Math.PI*2);c.stroke();}
  c.save();if(p.invuln>0&&Math.floor(p.invuln*14)%2)c.globalAlpha=.5;this.animator.draw(c,this.hero,p,x,y);c.restore();
  this.fx.world(c);cam.end(c);foreground(c,g,cam,this.clock);
  if(g.boss?.darkness&&!g.boss.down&&!this.settings.contrast){
   const lamp=p.buffs.some(b=>b.key==='lamp'),x=cam.screenX(lamp?p.x:g.boss.x),y=cam.screenY(lamp?p.y:g.boss.y),r=(lamp?420:T.bossAttack.lampRadius)*cam.scale;
   c.save();c.fillStyle=P.ink;c.globalAlpha=.92;c.beginPath();c.rect(0,0,VIEW.w,VIEW.h);c.moveTo(x+r,y);c.arc(x,y,r,0,Math.PI*2);c.fill('evenodd');c.restore();
  }
  if(mode==='PLAY')this.hud.draw(c,g);
  this.fx.screen(c,g,this.settings);
  if(g.state==='DESCENT')this.descent(c,g);
  if(mode==='PAUSE'||mode==='MAP'||mode==='SETTINGS'){c.fillStyle=P.ink;c.globalAlpha=.35;c.fillRect(0,0,VIEW.w,VIEW.h);c.globalAlpha=1;}
  this.metrics.maxDrawImages=Math.max(this.metrics.maxDrawImages,this.metrics.drawImages);this.metrics.drawMs=performance.now()-start;
 }
 descent(c,g){
  const t=g.descentTime,pal=g.level.palette;
  c.fillStyle=P.night;c.globalAlpha=Math.min(.94,.3+t*.1);c.fillRect(0,0,VIEW.w,VIEW.h);c.globalAlpha=1;
  if(t>=2&&t<4.5){
   for(let i=0;i<3;i++){const x=VIEW.w/2+(i-1)*160;c.fillStyle=P.paper;c.fillRect(x-60,VIEW.h/2-75,120,150);c.strokeStyle=pal.mid;c.lineWidth=4;
    if(i===0){c.beginPath();c.moveTo(x-25,VIEW.h/2+35);c.lineTo(x-15,VIEW.h/2-20);c.lineTo(x,VIEW.h/2+5);c.lineTo(x+12,VIEW.h/2-25);c.lineTo(x+25,VIEW.h/2+35);c.stroke();}
    else if(i===1){c.strokeRect(x-35,VIEW.h/2-40,70,85);c.beginPath();c.moveTo(x,VIEW.h/2-40);c.lineTo(x,VIEW.h/2+45);c.moveTo(x-35,VIEW.h/2);c.lineTo(x+35,VIEW.h/2);c.stroke();}
    else{c.beginPath();c.moveTo(x-42,VIEW.h/2+10);c.bezierCurveTo(x-15,VIEW.h/2-15,x+15,VIEW.h/2+35,x+42,VIEW.h/2+10);c.stroke();ellipse(c,x+20,VIEW.h/2-28,15,15,pal.soul,null);}
   }
  }else if(t>=4.5&&t<6.5){c.strokeStyle=P.dream;c.lineWidth=2;for(let i=0;i<18;i++){const x=VIEW.w/2+Math.sin(i*19)*260;c.beginPath();c.moveTo(x,VIEW.h/2-40-i*8);c.lineTo(x,VIEW.h/2+70+i*18);c.stroke();}}
  c.fillStyle=P.bone;c.textAlign='center';c.font='22px "STKaiti","KaiTi",serif';c.fillText(t>6?text(g.level.client.lineKey):'再往梦里，游一点。',VIEW.w/2,VIEW.h*.78);
  c.font='11px "Microsoft YaHei UI"';c.fillText('Esc · 跳过片刻',VIEW.w/2,VIEW.h-25);
 }
}
