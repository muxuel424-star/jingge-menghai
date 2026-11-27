import { P } from './palette.js';
import { VIEW } from '../data/render.js';
import { text } from '../data/index.js';
import { TUNING as T } from '../data/tuning.js';
const TAU=Math.PI*2;
export class HUD {
 constructor(){this.memo=new Map();}
 label(level,state,chain,frags,melodies,delivered){
  const key=[level.level,state,chain,frags,melodies,delivered].join(':');
  if(!this.memo.has(key)){if(this.memo.size>600)this.memo.clear();this.memo.set(key,{
   title:'第'+level.level+'夜 · '+text(level.client.nameKey),
   sub:state==='SURFACE'?'梦链 '+chain+'/12 · 心事 '+frags+'/3 · 已送 '+delivered:'忆质之海 · 旋律 '+melodies+'/3',
  });}return this.memo.get(key);
 }
 draw(c,g){
  const p=g.player,s=g.song,l=this.label(g.level,g.state,g.chain.length,g.storyCount,g.melodyCount,g.delivered);
  c.fillStyle=P.paper;c.fillRect(18,16,235,49);c.strokeStyle=P.line;c.lineWidth=1;c.strokeRect(18,16,235,49);
  c.textAlign='left';c.fillStyle=P.ink;c.font='16px "STKaiti","KaiTi",serif';c.fillText(l.title,30,37);
  c.font='11px "Microsoft YaHei UI"';c.fillText(l.sub,30,55);
  // A bowl: rice surface is dream stability, the separate rim arc is health.
  const x=51,y=VIEW.h-43,r=28;
  c.save();c.beginPath();c.moveTo(x-r,y-8);c.quadraticCurveTo(x-r*.7,y+24,x,y+24);c.quadraticCurveTo(x+r*.7,y+24,x+r,y-8);c.closePath();c.fillStyle=P.paper;c.fill();c.clip();
  const fill=p.stability/100;c.fillStyle=P.dream;c.fillRect(x-r,y+24-fill*39,r*2,39);
  c.restore();c.strokeStyle=P.ink;c.lineWidth=2;c.beginPath();c.moveTo(x-r,y-8);c.quadraticCurveTo(x-r*.7,y+24,x,y+24);c.quadraticCurveTo(x+r*.7,y+24,x+r,y-8);c.closePath();c.stroke();
  c.strokeStyle=P.fear;c.lineWidth=3;c.beginPath();c.arc(x,y-7,r+2,Math.PI,Math.PI+Math.PI*p.hp/p.maxHp);c.stroke();
  c.fillStyle=P.bone;c.font='10px "Microsoft YaHei UI"';c.textAlign='center';c.fillText('稳 '+Math.ceil(p.stability),x,y+6);
  c.fillStyle=P.bone;c.fillText(Math.ceil(p.hp)+'/'+Math.ceil(p.maxHp),x,y-21);
  for(let i=0;i<3;i++){c.strokeStyle=i<=p.tier?P.bone:P.water;c.lineWidth=2;c.beginPath();c.ellipse(100,VIEW.h-27-i*15,10,4,0,0,Math.PI);c.stroke();}
  c.fillStyle=P.bone;c.fillText(T.tiers[p.tier].name,100,VIEW.h-12);
  if(g.state!=='SURFACE'){const next=T.tiers[p.tier+1];c.font='9px "Microsoft YaHei UI"';c.textAlign='left';c.fillText(next?Math.floor(p.mem)+' / '+next.mem+' 忆质':'鲸宫盛得下',126,VIEW.h-24);}
  // Four beat points open into a ring while the phrase is held.
  const cx=VIEW.w/2,cy=VIEW.h-38,active=s.active,phase=active?s.phase:(s.clock/s.beatSeconds)%4;
  for(let i=0;i<4;i++){
   const a=i/4*TAU-Math.PI/2,px=active?cx+Math.cos(a)*25:cx+(i-1.5)*15,py=active?cy+Math.sin(a)*25:cy;
   const lit=active?phase>=i:Math.floor(phase)===i;
   c.beginPath();c.arc(px,py,i===3?4.5:3.5,0,TAU);c.fillStyle=lit?i===3?P.lamp:P.dream:P.water;c.fill();c.strokeStyle=P.bone;c.lineWidth=1;c.stroke();
  }
  if(active){c.strokeStyle=P.dream;c.lineWidth=2;c.beginPath();c.arc(cx,cy,33,-Math.PI/2,-Math.PI/2+Math.min(1,s.age/s.phraseSeconds)*TAU);c.stroke();}
  if(g.melodyCount>=3){c.strokeStyle=P.bone;c.lineWidth=.7;c.beginPath();c.arc(cx,cy,38,0,TAU);c.stroke();}
  c.fillStyle=P.bone;c.font='9px "Microsoft YaHei UI"';c.textAlign='center';c.fillText(s.cooldown>0?'鲸歌歇息 '+s.cooldown.toFixed(1):active?'第四拍结束时松手':'按住 F 鲸歌',cx,VIEW.h-5);
  const right=VIEW.w-102;
  c.textAlign='left';c.font='10px "Microsoft YaHei UI"';c.fillStyle=P.dream;c.fillText('气息',right-32,VIEW.h-49);c.fillStyle=P.bone;c.fillText('冲刺',right-32,VIEW.h-26);
  c.fillStyle=P.water;c.fillRect(right,VIEW.h-54,78,3);c.fillRect(right,VIEW.h-31,78,3);
  c.fillStyle=P.dream;c.fillRect(right,VIEW.h-54,78*p.breath/p.maxBreath,3);c.fillStyle=P.bone;c.fillRect(right,VIEW.h-31,78*p.dash/100,3);
  for(let i=0;i<p.buffs.length;i++){const b=p.buffs[i];c.fillStyle=P.bone;c.textAlign='right';c.fillText(text('item.'+b.key)+' '+Math.ceil(b.remaining??b.ttl??b.time??0),VIEW.w-25,VIEW.h-80-i*15);}
  if(g.boss){
   const b=g.boss,bx=VIEW.w/2-150,by=22;
   c.fillStyle=P.ink;c.fillRect(bx-3,by-3,306,12);c.fillStyle=P.line;c.fillRect(bx,by,300*b.hp/b.maxHp,6);
   c.strokeStyle=P.paper;c.lineWidth=2;for(let i=1;i<3;i++){c.beginPath();c.moveTo(bx+i*100,by-2);c.lineTo(bx+i*100,by+8);c.stroke();}
   c.fillStyle=P.bone;c.font='12px "STKaiti","KaiTi",serif';c.textAlign='center';c.fillText(text('boss.'+b.key+'.name'),VIEW.w/2,51);
   if(b.gate){c.fillStyle=P.paper;c.fillRect(VIEW.w/2-130,65,260,24);c.fillStyle=P.ink;c.fillText('她在等一个应答 · 按住F，四拍松手',VIEW.w/2,82);}
  }
 }
}
export function drawMap(canvas,g){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,s=g.scene;
 c.fillStyle=P.paper;c.fillRect(0,0,w,h);
 const sx=(w-40)/s.width,sy=(h-30)/s.height;
 c.save();c.translate(20,15);c.scale(sx,sy);c.fillStyle=P.water;
 for(const a of s.solids||[]){c.beginPath();if(a.points){c.moveTo(a.points[0].x,a.points[0].y);for(const p of a.points)c.lineTo(p.x,p.y);c.closePath();}else c.ellipse(a.x,a.y,a.rx,a.ry,0,0,TAU);c.fill();}
 c.restore();
 const dot=(x,y,color,r=4)=>{c.fillStyle=color;c.beginPath();c.arc(20+x*sx,15+y*sy,r,0,TAU);c.fill();};
 dot(g.player.x,g.player.y,P.seal,5);
 if(s.well)dot(s.well.x,s.well.y,P.dream,5);if(s.exit)dot(s.exit.x,s.exit.y,P.ink,5);
 for(const p of g.entities.fragments)if(!p.collected)dot(p.x,p.y,P.lamp);
 for(const p of g.entities.melodies)if(!p.collected)dot(p.x,p.y,P.seal);
 for(const p of s.gates||[]){c.strokeStyle=P.ink;c.strokeRect(16+p.x*sx,11+p.y*sy,8,8);}
 if(g.player.buffs.some(b=>b.key==='sonar'))for(const p of g.entities.pickups)if(!p.taken)dot(p.x,p.y,P.line,2);
}

