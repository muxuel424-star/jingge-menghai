import { P, mix } from './palette.js';

const TAU = Math.PI * 2;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const noise = n => { n=Math.imul(n ^ (n>>>16),0x45d9f3b); n=Math.imul(n ^ (n>>>16),0x45d9f3b); return ((n ^ (n>>>16))>>>0)/4294967296; };
function line(c,points,color,width=2) {
 c.beginPath();c.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
 c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function polygon(c,points,color,stroke=null,width=2) {
 c.beginPath();c.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
 c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function oval(c,x,y,rx,ry,color,stroke=null,width=1.5) {
 c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,TAU);c.fillStyle=color;c.fill();
 if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
export function traceSolid(c,s) {
 c.beginPath();
 if(s.points?.length){c.moveTo(s.points[0].x,s.points[0].y);for(let i=1;i<s.points.length;i++)c.lineTo(s.points[i].x,s.points[i].y);c.closePath();}
 else c.ellipse(s.x,s.y,s.rx||s.w/2||70,s.ry||s.h/2||40,0,0,TAU);
}
/** View-only metadata: the simulation's boundary is never rewritten or rounded. */
export function describeSolid(s,index=0) {
 const points=s.points?.length?s.points:Array.from({length:48},(_,i)=>({x:s.x+Math.cos(i/48*TAU)*(s.rx||s.w/2||70),y:s.y+Math.sin(i/48*TAU)*(s.ry||s.h/2||40)}));
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,area=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];left=Math.min(left,a.x);right=Math.max(right,a.x);top=Math.min(top,a.y);bottom=Math.max(bottom,a.y);area+=a.x*b.y-b.x*a.y;}
 const sign=area>=0?1:-1,edges=[];
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.01)continue;edges.push({a,b,length,nx:-dy/length*sign,ny:dx/length*sign});}
 return {solid:s,points,edges,left,top,right,bottom,w:right-left,h:bottom-top,cx:(left+right)/2,cy:(top+bottom)/2,seed:Math.round(left*19+top*31+right*7+bottom*13+index*911)};
}
export function terrainColors(p,deep) {
 const body=deep?mix(p.mid,P.ink,.22):p.mid;
 return {body,shade:mix(p.base,P.ink,deep?.16:0),edge:mix(body,p.hi,.36),cut:mix(body,p.hi,.17),seam:mix(p.base,P.ink,.28),light:p.hi,ivory:mix(p.hi,P.bone,.38),soul:p.soul};
}
function face(c,a,col,deep) {
 c.fillStyle=col.body;traceSolid(c,a.solid);c.fill();
 const lean=a.w*(.42+noise(a.seed)*.22);
 polygon(c,[[a.left+lean,a.top-20],[a.right+50,a.top+a.h*.19],[a.right+50,a.bottom+30],[a.left+a.w*.22,a.bottom+30]],col.shade);
 // Broad strata read as volumes; small edge details are laid on them below.
 if(deep)polygon(c,[[a.left-10,a.cy+a.h*.05],[a.cx,a.cy-a.h*.07],[a.right+10,a.cy+a.h*.14],[a.right+10,a.bottom+20],[a.left-10,a.bottom+20]],col.shade);
}
function coralCup(c,x,y,r,col,seed) {
 const lobes=5;
 for(let i=0;i<lobes;i++){const angle=i/lobes*TAU;oval(c,x+Math.cos(angle)*r*.58,y+Math.sin(angle)*r*.4,r*.55,r*.36,i%2?col.body:col.cut,col.seam,1.2);}
 oval(c,x,y,r*.38,r*.24,col.shade);
 for(let i=0;i<3;i++){const px=x+(i-1)*r*.38;line(c,[[px-r*.12,y-r*.2],[px,y+r*.12],[px+r*.12,y-r*.2]],col.edge,1);}
}
function reef(c,a,col) {
 const bands=Math.max(3,Math.ceil(a.h/115)),height=a.h/bands,seam=mix(col.shade,col.body,.3);
 for(let row=0;row<bands;row++){
  const y=a.top+row*height,n=noise(a.seed+row*137),rise=(n-.5)*height*.42;
  c.beginPath();c.moveTo(a.left-50,y+rise);
  c.bezierCurveTo(a.left+a.w*.27,y-height*.26,a.left+a.w*.67,y+height*.3,a.right+50,y-height*.12);
  c.lineTo(a.right+50,y+height+15);
  c.bezierCurveTo(a.left+a.w*.69,y+height*.81,a.left+a.w*.31,y+height*1.18,a.left-50,y+height*.88);
  c.closePath();c.fillStyle=row%3===1?col.shade:col.body;c.fill();
  c.beginPath();c.moveTo(a.left-30,y+rise+4);
  c.bezierCurveTo(a.left+a.w*.27,y-height*.26+4,a.left+a.w*.67,y+height*.3+4,a.right+30,y-height*.12+4);
  c.strokeStyle=row%3===1?col.cut:seam;c.lineWidth=row%3===1?2.2:1.3;c.stroke();
 }
 const fractures=Math.max(1,Math.floor(a.w/220));
 for(let i=0;i<fractures;i++){
  const x=a.left+a.w*(i+.65)/(fractures+.3),y=a.top+a.h*(.12+noise(a.seed+i*61)*.21),h=a.h*(.27+noise(a.seed+i*83)*.2);
  line(c,[[x,y],[x-16,y+h*.28],[x+9,y+h*.55],[x-8,y+h*.83]],seam,1.5);
  if(i%2===0)line(c,[[x+9,y+h*.55],[x+30,y+h*.48],[x+43,y+h*.57]],seam,1.2);
 }
 let walked=0;
 for(const edge of a.edges){
  if(edge.ny>.25){
   const spacing=76;
   for(let d=(spacing-walked%spacing)%spacing;d<edge.length;d+=spacing){
    const f=d/edge.length,x=edge.a.x+(edge.b.x-edge.a.x)*f+edge.nx*19,y=edge.a.y+(edge.b.y-edge.a.y)*f+edge.ny*19;
    coralCup(c,x,y,13+noise(a.seed+Math.round(walked+d))*6,col,a.seed+walked+d);
   }
  }
  walked+=edge.length;
 }
 // Long, nested shell arcs belong to the reef itself rather than a brick grid.
 if(a.w>220&&a.h>150){const x=a.cx-a.w*.18,y=a.cy+a.h*.03,r=Math.min(52,a.h*.2);
  for(let i=0;i<3;i++){c.beginPath();c.ellipse(x,y,r*(1-i*.22),r*.64*(1-i*.22),-.25,Math.PI*.13,Math.PI*1.76);c.strokeStyle=i?col.cut:seam;c.lineWidth=i?1.3:2;c.stroke();}
 }
}

function porcelainShard(c,x,y,size,col,seed) {
 const points=[[x-size*.85,y-size*.3],[x-size*.26,y-size*.73],[x+size*.8,y-size*.48],[x+size*.65,y+size*.37],[x-size*.3,y+size*.62]];
 polygon(c,points,col.ivory,col.seam,2);
 polygon(c,[points[1],points[2],[x+size*.42,y+size*.08],[x-size*.26,y+size*.19]],mix(col.body,col.ivory,.25));
 c.save();c.beginPath();for(let i=0;i<points.length;i++)i?c.lineTo(...points[i]):c.moveTo(...points[i]);c.closePath();c.clip();
 c.strokeStyle=col.body;c.lineWidth=2;
 for(let i=0;i<3;i++){c.beginPath();c.arc(x-size*.35+i*size*.4,y+size*.23,size*.3,Math.PI,TAU);c.stroke();}
 line(c,[[x+size*.12,y-size*.65],[x-size*.05,y-size*.05],[x+size*.27,y+size*.14],[x+size*.15,y+size*.6]],col.seam,1.5);c.restore();
}
function wreck(c,a,col) {
 const count=Math.max(3,Math.ceil(a.h/48)),plankH=a.h/count;
 for(let row=0;row<count;row++){
  const y=a.top+row*plankH,dy=(noise(a.seed+row*71)-.5)*13;
  polygon(c,[[a.left-30,y+dy],[a.right+30,y+dy+14],[a.right+30,y+plankH-6],[a.left-30,y+plankH-15]],row%3===0?col.shade:col.body,col.seam,2);
  line(c,[[a.left+20,y+10+dy],[a.right-20,y+21+dy]],col.cut,2);
  if(row%2===0)line(c,[[a.left+a.w*.21,y+16],[a.left+a.w*.49,y+18],[a.left+a.w*.7,y+22]],col.seam,1);
 }
 const ribs=Math.max(2,Math.floor(a.w/165));
 for(let i=0;i<ribs;i++){const x=a.left+(i+.5)*a.w/ribs;
  polygon(c,[[x-11,a.top-10],[x+7,a.top-10],[x+23,a.bottom+10],[x+2,a.bottom+10]],col.shade,col.seam,2);
  line(c,[[x-7,a.top+10],[x+8,a.bottom-15]],col.cut,3);
  for(const y of [a.top+26,a.bottom-25]){oval(c,x+3,y,3,3,col.seam);oval(c,x+2,y-1,1,1,col.ivory);}
 }
 if(a.w>260&&a.h>110){porcelainShard(c,a.left+a.w*.3,a.cy,Math.min(64,a.h*.37),col,a.seed);if(a.w>520)porcelainShard(c,a.left+a.w*.77,a.cy-a.h*.15,Math.min(47,a.h*.25),col,a.seed+71);}
}
function crystal(c,x,y,r,h,col,tilt=0) {
 c.save();c.translate(x,y);c.rotate(tilt);
 const points=[[0,-h],[-r*.72,-h*.63],[-r,0],[r*.85,0],[r*.55,-h*.67]];
 polygon(c,points,col.body,col.seam,2);
 polygon(c,[[0,-h],[-r*.72,-h*.63],[-r,0],[-r*.17,0]],col.cut);
 polygon(c,[[0,-h],[-r*.17,0],[r*.37,0],[r*.55,-h*.67]],col.edge);
 line(c,[[0,-h+3],[-r*.17,-2]],col.light,1.3);c.restore();
}
function crystalRock(c,a,col) {
 const cols=Math.max(2,Math.ceil(a.w/150)),rows=Math.max(2,Math.ceil(a.h/160));
 for(let row=0;row<rows;row++)for(let i=0;i<cols;i++){
  const x=a.left+i*a.w/cols,y=a.top+row*a.h/rows,n=noise(a.seed+row*61+i*137),w=a.w/cols,h=a.h/rows;
  polygon(c,[[x-10,y+10],[x+w*.6,y-15],[x+w+20,y+h*.5],[x+w*.55,y+h+15],[x-15,y+h*.65]],n>.45?col.shade:col.body,col.seam,1.8);
  polygon(c,[[x-10,y+10],[x+w*.6,y-15],[x+w*.38,y+h*.52],[x-15,y+h*.65]],n>.65?col.cut:col.body);
  line(c,[[x+w*.6,y-15],[x+w*.38,y+h*.52],[x+w*.55,y+h+15]],col.cut,1.2);
 }
 const count=clamp(Math.floor(a.w/165),1,7);
 for(let i=0;i<count;i++){
  const x=a.left+(i+.6)*a.w/(count+.4),y=a.top+a.h*(.3+noise(a.seed+i*29)*.5),height=Math.min(85,a.h*.46);
  crystal(c,x,y,14+noise(a.seed+i*11)*13,height,col,(noise(a.seed+i*19)-.5)*.55);
 }
}
function basalt(c,a,col) {
 const count=Math.max(3,Math.ceil(a.w/83)),w=a.w/count;
 for(let i=0;i<count;i++){
  const x=a.left+i*w,step=(noise(a.seed+i*71)-.5)*48,top=a.top+step;
  polygon(c,[[x,top+12],[x+w*.27,top-5],[x+w*.81,top+2],[x+w,top+23],[x+w,a.bottom+30],[x,a.bottom+30]],i%3===0?col.shade:col.body,col.seam,2.2);
  polygon(c,[[x+w*.62,top+2],[x+w,top+23],[x+w,a.bottom+30],[x+w*.62,a.bottom+30]],col.shade);
  line(c,[[x+4,top+14],[x+w*.27,top],[x+w*.81,top+7]],col.cut,2.5);
  for(let k=1;k<a.h/116;k++){const y=a.top+k*116+(noise(a.seed+i*211+k*53)-.5)*36;line(c,[[x+4,y],[x+w*.3,y-7],[x+w*.63,y+2],[x+w-3,y-6]],col.seam,2);}
 }
 if(a.w>240&&a.h>160){const x=a.left+a.w*(.25+noise(a.seed)*.45),y=a.top+a.h*.13;
  const fault=[[x,y],[x-24,y+a.h*.2],[x+4,y+a.h*.39],[x-28,y+a.h*.61],[x-12,y+a.h*.83]];
  line(c,fault,col.seam,9);line(c,fault,col.cut,3);
  line(c,[[x+4,y+a.h*.39],[x+45,y+a.h*.48],[x+68,y+a.h*.43]],col.seam,5);
 }
}
function fossil(c,x,y,r,col) {
 c.save();c.translate(x,y);c.rotate(-.25);
 oval(c,0,0,r,r*.7,col.shade,col.seam,2);
 oval(c,0,0,r*.61,r*.42,col.body,col.cut,2);
 for(let i=-2;i<=2;i++){const px=i*r*.27,h=r*(.8-Math.abs(i)*.15);
  c.beginPath();c.moveTo(px,-h);c.quadraticCurveTo(px+r*.2,-h*.5,px+r*.12,0);c.quadraticCurveTo(px+r*.2,h*.5,px,h);c.strokeStyle=col.cut;c.lineWidth=5;c.stroke();
 }c.restore();
}
function sanctuary(c,a,col) {
 const rowH=Math.max(68,Math.min(112,a.h/3));
 for(let row=0,y=a.top-30;y<a.bottom;row++,y+=rowH){
  const offset=row%2?105:0;
  for(let x=a.left-220+offset;x<a.right;x+=212){
   const n=noise(a.seed+row*61+Math.round(x)),bottom=y+rowH-6;
   polygon(c,[[x+3,y+3],[x+204,y],[x+210,bottom-6],[x+10,bottom]],n>.6?col.shade:col.body,col.seam,3);
   line(c,[[x+15,y+10],[x+195,y+7],[x+200,y+19]],col.cut,3);
   line(c,[[x+18,bottom-6],[x+19,bottom-17],[x+53,bottom-13]],col.seam,1.5);
  }
 }
 if(a.w>230&&a.h>150){fossil(c,a.cx,a.cy,Math.min(74,a.h*.28,a.w*.2),col);}
 // An inset moulding follows the same silhouette, so architecture stays readable.
 traceSolid(c,a.solid);c.strokeStyle=col.cut;c.lineWidth=24;c.stroke();
 traceSolid(c,a.solid);c.strokeStyle=col.shade;c.lineWidth=14;c.stroke();
}
function rim(c,a,col,theme,textured=false) {
 const thickness=textured?clamp(Math.min(a.w,a.h)*.025,4,9):clamp(Math.min(a.w,a.h)*.065,9,22);
 for(const e of a.edges){
  const light=e.nx*.6+e.ny*.8;
  polygon(c,[[e.a.x,e.a.y],[e.b.x,e.b.y],[e.b.x+e.nx*thickness,e.b.y+e.ny*thickness],[e.a.x+e.nx*thickness,e.a.y+e.ny*thickness]],light>.25?col.cut:col.shade);
  if(light>.25&&e.length>30){const inset=theme==='sanctuary'?4:3;
   line(c,[[e.a.x+e.nx*inset,e.a.y+e.ny*inset],[e.b.x+e.nx*inset,e.b.y+e.ny*inset]],theme==='sanctuary'?col.ivory:col.edge,theme==='porcelain'?2.5:2);
  }
 }
}
export function paintSolid(c,a,col,theme='bay',deep=false,contrast=false,material=null) {
 c.save();traceSolid(c,a.solid);c.clip();
 face(c,a,col,deep);
 if(material){
  // Each reef uses one coherent atlas patch, never a repeated wallpaper grid.
  if(a.w<1600)c.drawImage(material,a.left,a.top,a.w,a.h);
  else{
   const patchWidth=720;
   for(let x=Math.floor(a.left/patchWidth)*patchWidth;x<a.right;x+=patchWidth)c.drawImage(material,x,a.top,patchWidth,a.h);
  }
  c.save();c.globalAlpha=deep?.28:.12;
  polygon(c,[[a.left-10,a.top+a.h*.63],[a.cx,a.top+a.h*.56],[a.right+10,a.top+a.h*.7],[a.right+10,a.bottom+20],[a.left-10,a.bottom+20]],col.shade);
  c.restore();
 }else if(theme==='porcelain')wreck(c,a,col);
 else if(theme==='violet')crystalRock(c,a,col);
 else if(theme==='magma')basalt(c,a,col);
 else if(theme==='sanctuary')sanctuary(c,a,col);
 else reef(c,a,col);
 rim(c,a,col,theme,!!material);
 c.restore();
 traceSolid(c,a.solid);c.strokeStyle=P.ink;c.lineWidth=contrast?4:2.6;c.stroke();
}
