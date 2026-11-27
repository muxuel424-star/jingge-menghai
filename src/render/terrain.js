import { VIEW } from '../data/render.js';
import { describeSolid, terrainColors, paintSolid } from './terrain-art.js';
import { floorAt, roofAt } from '../sim/terrain.js';

const PAD=3;
export class TerrainRenderer {
 constructor(){this.chunks=new Map();this.scene=null;this.hits=0;this.art=[];this.colors=null;this.contrast=false;this.materials=[];}
 setMaterials(atlas){
  const w=atlas.width/3,h=atlas.height/2;
  this.materials=Array.from({length:5},(_,i)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(atlas,i%3*w,Math.floor(i/3)*h,w,h,0,0,w,h);return c;});
  this.chunks.clear();
 }
 clear(){this.chunks.clear();this.scene=null;this.art=[];this.colors=null;}
 prepare(scene,palette,deep,contrast){
  if(this.scene===scene&&this.contrast===contrast&&this.deep===deep)return;
  this.clear();this.scene=scene;this.contrast=contrast;this.deep=deep;
  const solids=[...(scene.solids||[])];
  if(scene.floor){
   const points=[];for(let x=0;x<scene.width;x+=80)points.push({x,y:floorAt(x,scene)});
   points.push({x:scene.width,y:floorAt(scene.width,scene)},{x:scene.width,y:scene.height+80},{x:0,y:scene.height+80});solids.push({points});
  }
  if(scene.roof){
   const points=[{x:0,y:-80},{x:scene.width,y:-80},{x:scene.width,y:roofAt(scene.width,scene)}];
   for(let x=scene.width-80;x>0;x-=80)points.push({x,y:roofAt(x,scene)});points.push({x:0,y:roofAt(0,scene)});solids.push({points});
  }
  this.art=solids.map((solid,index)=>describeSolid(solid,index));
  this.colors=terrainColors(palette,deep);
 }
 tile(scene,tx,ty,palette,deep){
  if(this.scene!==scene)this.prepare(scene,palette,deep,this.contrast);
  const key=tx+':'+ty,cached=this.chunks.get(key);
  if(cached){cached.used=++this.hits;return cached.canvas;}
  const canvas=document.createElement('canvas');canvas.width=VIEW.chunk+PAD*2;canvas.height=VIEW.chunk+PAD*2;
  const c=canvas.getContext('2d'),left=tx*VIEW.chunk-PAD,top=ty*VIEW.chunk-PAD;
  const right=left+canvas.width,bottom=top+canvas.height;
  c.lineJoin='round';c.lineCap='round';c.translate(-left,-top);
  const theme=scene.theme||'bay',index=['bay','porcelain','violet','magma','sanctuary'].indexOf(theme),image=this.materials[Math.max(0,index)];
  for(const art of this.art){
   if(art.right<left||art.left>right||art.bottom<top||art.top>bottom)continue;
   paintSolid(c,art,this.colors,theme,deep,this.contrast,image);
  }
  this.chunks.set(key,{canvas,used:++this.hits});
  if(this.chunks.size>VIEW.maxChunks){
   let oldest=null;
   for(const entry of this.chunks)if(!oldest||entry[1].used<oldest[1].used)oldest=entry;
   this.chunks.delete(oldest[0]);
  }
  return canvas;
 }
 draw(c,scene,cam,palette,deep,contrast=false){
  this.prepare(scene,palette,deep,contrast);
  const left=cam.x-VIEW.w/2/cam.scale,top=cam.y-VIEW.h/2/cam.scale;
  const right=cam.x+VIEW.w/2/cam.scale,bottom=cam.y+VIEW.h/2/cam.scale;
  const maxX=Math.ceil(scene.width/VIEW.chunk)-1,maxY=Math.ceil(scene.height/VIEW.chunk)-1;
  for(let y=Math.max(0,Math.floor(top/VIEW.chunk));y<=Math.min(maxY,Math.floor(bottom/VIEW.chunk));y++)
   for(let x=Math.max(0,Math.floor(left/VIEW.chunk));x<=Math.min(maxX,Math.floor(right/VIEW.chunk));x++)
    c.drawImage(this.tile(scene,x,y,palette,deep),x*VIEW.chunk-PAD,y*VIEW.chunk-PAD);
 }
}
