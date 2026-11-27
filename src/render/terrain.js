import { VIEW } from '../data/render.js';
import { P, mix } from './palette.js';
function path(c,s){
 c.beginPath();
 if(s.points?.length){c.moveTo(s.points[0].x,s.points[0].y);for(let i=1;i<s.points.length;i++)c.lineTo(s.points[i].x,s.points[i].y);c.closePath();}
 else c.ellipse(s.x,s.y,s.rx||s.w/2||70,s.ry||s.h/2||40,0,0,Math.PI*2);
}
export class TerrainRenderer {
 constructor(){this.chunks=new Map();this.scene=null;this.hits=0;}
 clear(){this.chunks.clear();this.scene=null;}
 tile(scene,tx,ty,palette,deep){
  const key=tx+':'+ty;
  if(this.chunks.has(key)){const tile=this.chunks.get(key);tile.used=++this.hits;return tile.canvas;}
  const canvas=document.createElement('canvas');canvas.width=VIEW.chunk;canvas.height=VIEW.chunk;
  const c=canvas.getContext('2d');c.translate(-tx*VIEW.chunk,-ty*VIEW.chunk);
  for(const s of scene.solids||[]){
   path(c,s);c.fillStyle=deep?mix(palette.mid,P.ink,.28):palette.mid;c.fill();c.strokeStyle=P.ink;c.lineWidth=3;c.stroke();
   c.save();path(c,s);c.clip();
   const x=s.points?.[0]?.x??s.x-s.rx,y=s.points?.[0]?.y??s.y-s.ry;
   c.fillStyle=deep?palette.base:mix(palette.mid,palette.base,.55);
   c.beginPath();c.moveTo(x-200,y+50);c.lineTo(x+800,y+130);c.lineTo(x+1000,y+800);c.lineTo(x-300,y+800);c.fill();
   c.strokeStyle=palette.hi;c.globalAlpha=.25;c.lineWidth=2;
   c.beginPath();c.moveTo(x-30,y+20);c.lineTo(x+70,y+12);c.lineTo(x+120,y+32);c.stroke();
   c.restore();
  }
  this.chunks.set(key,{canvas,used:++this.hits});
  if(this.chunks.size>VIEW.maxChunks){let oldest=null;for(const [k,v]of this.chunks)if(!oldest||v.used<oldest[1].used)oldest=[k,v];this.chunks.delete(oldest[0]);}
  return canvas;
 }
 draw(c,scene,cam,palette,deep){
  if(this.scene!==scene){this.clear();this.scene=scene;}
  const left=cam.x-VIEW.w/2/cam.scale,top=cam.y-VIEW.h/2/cam.scale;
  const right=cam.x+VIEW.w/2/cam.scale,bottom=cam.y+VIEW.h/2/cam.scale;
  for(let y=Math.max(0,Math.floor(top/VIEW.chunk));y<=Math.floor(bottom/VIEW.chunk);y++)
   for(let x=Math.max(0,Math.floor(left/VIEW.chunk));x<=Math.floor(right/VIEW.chunk);x++)
    c.drawImage(this.tile(scene,x,y,palette,deep),x*VIEW.chunk,y*VIEW.chunk);
 }
}

