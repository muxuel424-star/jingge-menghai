import { VIEW, CAMERA } from '../data/render.js';
export class Camera {
 constructor(){this.x=0;this.y=0;this.scale=1;this.shake=0;this.kick=0;this.sx=0;this.sy=0;this.clock=0;this.ready=false;this.lookX=0;}
 reset(p){this.x=p.x;this.y=p.y;this.ready=false;this.shake=0;}
 impulse(amount){this.shake=Math.max(this.shake,Math.min(CAMERA.maxShake,amount));}
 step(game,dt,settings){
  const p=game.player,scene=game.scene;if(!p||!scene)return;
  this.clock+=dt;
  let zoom=1/(1+p.tier*CAMERA.tierZoom);
  if(game.evolutionTimer>0)zoom*=1+Math.sin((1-game.evolutionTimer/1.2)*Math.PI)*.08;
  const moving=Math.min(1,Math.abs(p.vx)/195),lead=(.5-(p.dir>0?CAMERA.leadForward:CAMERA.leadBack))*VIEW.w*moving;
  this.lookX+=(lead-this.lookX)*(1-Math.exp(-dt*4));
  this.scale+=(zoom-this.scale)*(1-Math.exp(-dt*6));
  const tx=p.x+this.lookX;
  const ty=p.y;
  if(!this.ready){this.x=tx;this.y=ty;this.ready=true;}
  const ease=1-Math.exp(-dt*CAMERA.ease);
  if(Math.abs(tx-this.x)>CAMERA.deadX)this.x+=(tx-this.x-Math.sign(tx-this.x)*CAMERA.deadX)*ease;
  if(Math.abs(ty-this.y)>CAMERA.deadY)this.y+=(ty-this.y-Math.sign(ty-this.y)*CAMERA.deadY)*ease;
  const hw=VIEW.w/2/this.scale,hh=VIEW.h/2/this.scale;
  this.x=scene.width<2*hw?scene.width/2:Math.max(hw,Math.min(scene.width-hw,this.x));
  this.y=scene.height<2*hh?scene.height/2:Math.max(hh+CAMERA.top,Math.min(scene.height-hh,this.y));
  this.shake*=Math.exp(-dt*12);
  this.sx=Math.sin(this.clock*83)*this.shake*settings.shake;
  this.sy=Math.sin(this.clock*97+.7)*this.shake*.65*settings.shake;
 }
 begin(c){c.save();c.translate(VIEW.w/2+this.sx,VIEW.h/2+this.sy);c.scale(this.scale,this.scale);c.translate(-this.x,-this.y);}
 end(c){c.restore();}
 visible(x,y,r=0){return Math.abs(x-this.x)<VIEW.w/2/this.scale+VIEW.cull+r&&Math.abs(y-this.y)<VIEW.h/2/this.scale+VIEW.cull+r;}
 screenX(x){return (x-this.x)*this.scale+VIEW.w/2;}
 screenY(y){return (y-this.y)*this.scale+VIEW.h/2;}
}
