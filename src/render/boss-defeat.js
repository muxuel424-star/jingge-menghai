import { P } from './palette.js';
import { ellipse,poly } from './sprites.js';
const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
function sprite(c,im,x,y,h,alpha=1){c.save();c.globalAlpha*=alpha;c.drawImage(im,x-h/2,y-h*.55,h,h);c.restore();}
export function defeat(c,g,standing,rest,x,y,heroX,heroY){
 const b=g.boss,t=4-b.defeatTimer,settle=ease((t-.8)/1.1),release=ease((t-3.2)/.8);
 c.save();
 if(b.key==='claude'){
  sprite(c,rest,x+release*20,y,330,1-release);
  const transfer=ease(Math.max(0,t-.1)/3),px=x+(heroX-x)*transfer,py=y-55+(heroY-y+30)*transfer;
  // The whole handover shares this single lamp; the resting costume has none.
  c.strokeStyle=P.bone;c.lineWidth=3;c.beginPath();c.arc(px,py-15,9,Math.PI,TAU);c.stroke();
  poly(c,[[px-13,py-15],[px+13,py-15],[px+16,py+16],[px-16,py+16]],P.lamp);
  for(let i=0;i<6;i++){if(t<1+i*.35)continue;const xx=100+i*170;c.strokeStyle=P.bone;c.lineWidth=4;c.beginPath();c.moveTo(xx,100);c.lineTo(xx,55);c.quadraticCurveTo(xx+45,0,xx+90,55);c.lineTo(xx+90,100);c.stroke();ellipse(c,xx+45,49,4,7,P.lamp,null);}
 }else{
  const h=b.key==='gemini'?285:b.key==='grok'||b.key==='zhipu'?320:330;
  sprite(c,standing,x,y,320,1-settle);
  c.save();if(b.key==='qwen')c.translate(-settle*30,settle*5);sprite(c,rest,x,y+settle*38,h,settle*(1-release));c.restore();
  if(b.key==='qwen'){
   const a=ease((t-2.7)/.7);c.save();c.globalAlpha=1-a;ellipse(c,x+67,y+142,28,7,P.paper,P.water,2);c.restore();
   if(a>0)for(let i=0;i<8;i++){const ang=i/8*TAU;ellipse(c,x+67+Math.cos(ang)*a*45,y+142-Math.sin(ang)*a*35,2,2,P.paper,null);}
  }
  if(b.key==='gemini'){
   c.save();c.globalAlpha=ease((t-1.8)/.6);ellipse(c,x+145,y+116,39,12,P.lamp,P.bone,2);
   for(let i=0;i<7;i++)ellipse(c,x+125+i*6,y+113+Math.sin(i)*3,3,2,P.bone,null);c.restore();
  }
  if(b.key==='zhipu'){
   const boxX=x+19,boxY=y+62;
   for(let i=0;i<8;i++){const p=ease((t-.8-i*.13)/.3);if(p>=1)continue;const sx=x-110+i*31,sy=y+155;ellipse(c,sx+(boxX-sx)*p,sy+(boxY-sy)*p-Math.sin(p*Math.PI)*36,6,4,i%2?P.bone:P.ink,P.line,1);}
   c.strokeStyle=P.bone;c.globalAlpha=1-settle;c.lineWidth=2;c.strokeRect(x-150,y+170,300,12);c.globalAlpha=1;
  }
  if(release>0&&b.key!=='gemini'){
   const tx=120,ty=95;
   for(let i=0;i<14;i++){const a=ease(clamp(release*1.5-i*.025)),sx=x+Math.sin(i*21)*70,sy=y+Math.cos(i*17)*80;
    c.save();c.globalAlpha=(1-a)*.9;const fx=sx+(tx-sx)*a,fy=sy+(ty-sy)*a-Math.sin(a*Math.PI)*80;ellipse(c,fx,fy,8,4,P.dream,P.ink,1);poly(c,[[fx+6,fy],[fx+14,fy-4],[fx+14,fy+4]],P.dream,P.ink,1);c.restore();
   }
  }
 }
 c.restore();
}
