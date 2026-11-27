import { TUNING } from '../src/data/tuning.js';
import { canEat } from '../src/sim/systems/feeding.js';

const step = TUNING.sim.step;

function fightInput(game) {
  if (game.blockHeld) return {};
  const player = game.player, boss = game.boss;
  let sing = false;
  if (boss.gate) {
    sing = game.song.active ? game.song.age + step < game.song.phraseSeconds
      : game.song.cooldown <= 0 && !game.song.blockedUntilUp;
  }
  const dx = boss.x - player.x, dy = boss.y - player.y, length = Math.max(1, Math.hypot(dx, dy));
  return { x: boss.gate ? 0 : dx / length, y: boss.gate ? 0 : dy / length, bite: !boss.gate, sing };
}

function clearLine(game, target) {
  const player = game.player, samples = Math.ceil(Math.hypot(target.x - player.x, target.y - player.y) / 25);
  for (let i = 1; i < samples; i++) {
    if (game.terrain.contains(player.x + (target.x - player.x) * i / samples, player.y + (target.y - player.y) * i / samples, player.r, player.tier)) return false;
  }
  return true;
}

function deepRouteInput(game, bot, frame) {
  const player = game.player, scene = game.scene, path = scene.mainPath;
  while (bot.pathIndex < path.length - 1 && Math.hypot(path[bot.pathIndex].x - player.x, path[bot.pathIndex].y - player.y) < 70) bot.pathIndex++;
  if (game.blockHeld || game.evolutionTimer > 0 || (scene.loop && !game.conditions.still3s && game.loopCount)) return {};
  if (frame % 15 === 0) {
    bot.target = null;
    // A player steers toward visible notes rather than hoping the route or a
    // chase happens to brush their pickup radius. Keep ordinary input physics.
    if (player.stability >= 35) {
      bot.target = game.entities.melodies.filter(note => !note.collected && player.tier >= note.requiresTier
        && Math.abs(note.x - player.x) < 600 && Math.abs(note.y - player.y) < 320)
        .sort((a,b) => Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))
        .find(note => clearLine(game,note));
    }
    if (!bot.target && (player.tier < 2 || player.stability < 45)) {
      const gate = scene.gates.find(candidate => candidate.tier > player.tier);
      const candidates = [
        ...game.fish.filter(fish => canEat(player, fish)),
        ...game.entities.pickups.filter(item => !item.collected && (['crystal', 'clam'].includes(item.key) || (item.key === 'chest' && player.tier >= 1))),
      ].filter(target => (!gate || target.x < gate.x - 70) && Math.hypot(target.x - player.x, target.y - player.y) < 650)
        .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      bot.target = candidates.find(target => clearLine(game, target));
    }
  }
  if (bot.target?.eaten || bot.target?.collected) bot.target = null;
  const target = bot.target ?? path[bot.pathIndex], dx = target.x - player.x, dy = target.y - player.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return { x: dx / length, y: dy / length, bite: true };
}


function segmentDistance(point, a, b) {
  const dx = b.x-a.x, dy = b.y-a.y;
  const t = Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));
  return [Math.hypot(point.x-a.x-t*dx, point.y-a.y-t*dy), t];
}
function surfaceRoute(game) {
  const path = game.scene.mainPath.map((p, i) => ({ ...p, order:i }));
  const route = [...path];
  for (const target of [game.scene.well, ...game.entities.fragments]) {
    let best = [Infinity, 0];
    for (let i=1;i<path.length;i++) {
      const [distance,t] = segmentDistance(target,path[i-1],path[i]);
      if(distance<best[0]) best = [distance,i-1+t];
    }
    route.push({ ...target, order:best[1], fragment:target.id!==undefined });
  }
  const adjustments={
    bay:[{x:2520,y:1040,order:5.65,condition:'reverseCurrent'}],
  };
  route.push(...(adjustments[game.level.key]??[]));
  route.sort((a,b)=>a.order-b.order);
  route.push({...game.scene.exit,exit:true});
  return route;
}
function swim(player,target){
  const dx=target.x-player.x,dy=target.y-player.y, length=Math.max(1,Math.hypot(dx,dy));
  return {x:dx/length,y:dy/length};
}
function surfaceInput(game,bot){
  const p=game.player;
  bot.surface ??= surfaceRoute(game);
  let point = bot.surface[bot.surfaceIndex];
  const near=()=>Math.hypot(point.x-p.x,point.y-p.y);
  while(point){
    if(point.exit)return swim(p,point);
    if(point.fragment){
      if(game.storyFragments.has(point.id)) { point=bot.surface[++bot.surfaceIndex]; continue; }
      if(near()<25&&point.condition==='perfectSong'&&!game.conditions.perfectSong){
        return {sing:game.song.active ? game.song.age+step<game.song.phraseSeconds : !game.song.blockedUntilUp&&game.song.cooldown<=0};
      }
      if(near()<18&&(point.condition==='still3s'||point.condition==='steamExposure'))return {};
      return swim(p,point);
    }
    if(near()<50){
      if(point.condition==='reverseCurrent'&&!game.conditions.reverseCurrent)return {x:-1};
      point=bot.surface[++bot.surfaceIndex];
    }else return swim(p,point);
  }
  return {};
}
export function controller(game) {
  const bot={surfaceIndex:0,pathIndex:0,target:null};
  return frame=>{
    if(game.state==='SURFACE')return surfaceInput(game,bot);
    if(game.state==='DEEP')return deepRouteInput(game,bot,frame);
    if(game.state==='BOSS')return fightInput(game);
    return {};
  };
}
export const STEP = step;
