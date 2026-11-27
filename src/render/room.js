import { P } from './palette.js';
import { SOUVENIRS } from '../data/narrative.js';
import { ellipse,poly } from './sprites.js';
export function room(c,owned,time){
 c.save();c.strokeStyle=P.ink;c.lineWidth=4;
 c.fillStyle=P.water;c.fillRect(80,400,365,20);c.strokeRect(80,400,365,20);c.fillRect(105,420,16,60);c.fillRect(405,420,16,60);
 c.fillStyle=P.night;c.fillRect(95,215,270,105);c.strokeRect(95,215,270,105);
 c.strokeStyle=P.bone;c.lineWidth=2;c.beginPath();c.moveTo(95,275);c.lineTo(365,275);c.stroke();
 c.strokeStyle=P.line;c.beginPath();c.moveTo(458,160);c.lineTo(458,284);c.arc(458,290,8,0,Math.PI);c.stroke();
 for(const item of SOUVENIRS){
  if(!owned.includes(item.level))continue;
  if(item.shape==='box'){
   poly(c,[[145,382],[238,382],[248,397],[155,397]],P.paper);c.strokeStyle=P.water;c.lineWidth=3;c.beginPath();c.moveTo(159,385);c.lineTo(229,385);c.stroke();
   poly(c,[[173,379],[205,372],[212,379]],P.bone,P.ink,1);
  }else if(item.shape==='bowl'){
   poly(c,[[225,256],[238,247],[247,255],[266,250],[279,259],[271,273],[240,274]],P.paper,P.water,2);
   c.strokeStyle=P.water;c.lineWidth=2;c.beginPath();c.moveTo(241,254);c.lineTo(251,264);c.lineTo(260,259);c.lineTo(270,265);c.stroke();
  }else if(item.shape==='collar'){
   c.save();c.translate(591,303);c.rotate(Math.sin(time*.5)*.05);c.strokeStyle=P.hair;c.lineWidth=8;c.beginPath();c.ellipse(0,0,23,10,.2,0,Math.PI*2);c.stroke();
   ellipse(c,3,17,7,8,P.lamp);c.strokeStyle=P.ink;c.lineWidth=1;c.beginPath();c.moveTo(3,14);c.lineTo(3,21);c.stroke();c.restore();
  }else if(item.shape==='badge'){
   c.fillStyle=P.paper;c.fillRect(440,286,37,52);c.strokeStyle=P.ink;c.lineWidth=2;c.strokeRect(440,286,37,52);c.fillStyle=P.hairShade;c.fillRect(446,295,25,12);
   c.strokeStyle=P.line;c.beginPath();c.moveTo(446,314);c.lineTo(471,314);c.moveTo(446,320);c.lineTo(463,320);c.stroke();
  }else if(item.shape==='cloth'){
   poly(c,[[756,151],[809,151],[826,185],[797,194],[772,180]],P.paper,P.ink,2);
   c.strokeStyle=P.water;c.lineWidth=2;c.beginPath();c.moveTo(763,159);c.lineTo(798,162);c.lineTo(811,183);c.stroke();
  }
 }
 c.restore();
}
