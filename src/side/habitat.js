import { resolveTerrain } from './reefs.js';

const TIMING = {
  kelpFlow: { period: 6.8, warning: 0.6, active: 4.4, label: '海草顺流' },
  surge: { period: 8.4, warning: 1.1, active: 3.2, label: '涨落潮汐' },
  fallingDebris: { period: 7.2, warning: 1.2, active: 1.9, label: '沉船落木' },
  sluice: { period: 8.2, warning: 1.2, active: 3.0, label: '摆动舱门' },
  whirlpool: { period: 8.8, warning: 1.0, active: 4.2, label: '紫晶旋涡' },
  updraft: { period: 6.7, warning: 0.7, active: 4.5, label: '深井上升流' },
  eruption: { period: 7.8, warning: 1.4, active: 2.1, label: '岩脉喷发' },
  steamJet: { period: 7.1, warning: 1.1, active: 2.4, label: '高压蒸汽' },
  lightGate: { period: 8.7, warning: 1.3, active: 3.4, label: '圣堂光栅' },
  pulseLane: { period: 9.4, warning: 1.2, active: 2.2, label: '鲸骨回响' },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createHabitat(reef) {
  return (reef.features ?? []).map((source, index) => ({
    ...source,
    ...TIMING[source.kind],
    originX: source.x,
    originY: source.y,
    age: 0,
    clock: -(source.delay ?? index * 0.2),
    state: 'rest',
    stateT: 0,
    progress: 0,
    radius: 0,
    gapY: source.y,
    touchT: 0,
    near: false,
  }));
}

function damage(game, feature, amount) {
  if (feature.touchT < 0.12) return;
  const hit = game.hurt(amount, feature, feature.label);
  if (hit) {
    feature.touchT = 0;
    game.effect(game.player, {type:'pop',radius:37,color:'#ffc293'});
    game.audio.environment?.(feature.kind, 'hit');
  }
}

function ellipseDistance(feature, player) {
  return Math.hypot((player.x-feature.x)/feature.rx, (player.y-feature.y)/feature.ry);
}

function push(game, x, y, dt) {
  const player=game.player;
  player.vx=clamp(player.vx+x*dt,-510,510);
  player.vy=clamp(player.vy+y*dt,-510,510);
}

function applyFlow(game, feature, dt) {
  const player=game.player;
  if (ellipseDistance(feature,player)>1) return false;
  const power=feature.kind==='kelpFlow' ? 155 : 260;
  const alternate=feature.kind==='surge' && Math.floor(feature.age/feature.period)%2 ? -1 : 1;
  push(game,feature.dx*power*alternate,feature.dy*power,dt);
  player.dash=Math.min(100,player.dash+dt*12);
  return true;
}

function applyDebris(game, feature, dt) {
  const player=game.player;
  feature.y=feature.originY+feature.progress*330;
  feature.x=feature.originX+Math.sin(feature.progress*Math.PI)*42;
  const contact=Math.abs(player.x-feature.x)<feature.rx+24
    && Math.abs(player.y-feature.y)<feature.ry+22;
  if (contact) {
    damage(game,feature,13);
    push(game,Math.sign(player.x-feature.x||1)*180,85,dt);
  }
  return contact;
}

function applySluice(game, feature, dt) {
  const player=game.player;
  feature.sway=Math.sin(feature.progress*Math.PI)*0.74;
  const dx=player.x-feature.x;
  const dy=player.y-feature.y;
  const localX=dx*Math.cos(feature.sway)+dy*Math.sin(feature.sway);
  const localY=-dx*Math.sin(feature.sway)+dy*Math.cos(feature.sway);
  const contact=Math.abs(localX)<feature.rx+24 && Math.abs(localY)<feature.ry+22;
  if (contact) {
    damage(game,feature,11);
    const direction=Math.sign(localX||-player.dir);
    push(game,Math.cos(feature.sway)*direction*310,Math.sin(feature.sway)*direction*310,dt);
  }
  return contact;
}

function applyWhirlpool(game, feature, dt) {
  const player=game.player;
  const dx=player.x-feature.x;
  const dy=player.y-feature.y;
  const distance=Math.hypot(dx,dy);
  if (distance>feature.rx+45) return false;
  const falloff=1-clamp(distance/(feature.rx+45),0,1);
  const nx=dx/Math.max(18,distance);
  const ny=dy/Math.max(18,distance);
  const rotation=feature.dx||1;
  push(game,(-nx*185-ny*rotation*245)*falloff,(-ny*185+nx*rotation*245)*falloff,dt);
  if (distance<32) damage(game,feature,8);
  return true;
}

function applyVent(game, feature, dt) {
  const player=game.player;
  if (feature.kind==='steamJet') {
    const contact=Math.abs(player.x-feature.x)<feature.rx+20 && Math.abs(player.y-feature.y)<feature.ry+20;
    if (contact) {
      damage(game,feature,12);
      push(game,feature.dx*340,feature.dy*340-65,dt);
    }
    return contact;
  }
  const high=feature.originY-feature.ry*2;
  const contact=Math.abs(player.x-feature.x)<feature.rx+20 && player.y>high && player.y<feature.originY+28;
  if (contact) {
    damage(game,feature,17);
    push(game,Math.sin(feature.age)*35,-650,dt);
  }
  return contact;
}

function applyLight(game, feature, dt) {
  const player=game.player;
  feature.gapY=feature.y+Math.sin(feature.progress*Math.PI*1.5)*feature.ry*0.46;
  feature.gapHalf=85;
  const contact=Math.abs(player.x-feature.x)<feature.rx+23
    && Math.abs(player.y-feature.y)<feature.ry
    && Math.abs(player.y-feature.gapY)>feature.gapHalf;
  if (contact) {
    damage(game,feature,14);
    push(game,Math.sign(player.x-feature.x||-player.dir)*280,0,dt);
  }
  return contact;
}

function applyPulse(game, feature, dt) {
  const player=game.player;
  feature.radius=30+feature.progress*(feature.rx-30);
  const distance=Math.hypot(player.x-feature.x,player.y-feature.y);
  const contact=Math.abs(distance-feature.radius)<23;
  if (contact) {
    damage(game,feature,13);
    const nx=(player.x-feature.x)/Math.max(1,distance);
    const ny=(player.y-feature.y)/Math.max(1,distance);
    push(game,nx*220,ny*220,dt);
  }
  return contact;
}

function applyFeature(game,feature,dt) {
  switch(feature.kind) {
    case 'kelpFlow':
    case 'surge':
      return applyFlow(game,feature,dt);
    case 'fallingDebris':
      return applyDebris(game,feature,dt);
    case 'sluice':
      return applySluice(game,feature,dt);
    case 'whirlpool':
      return applyWhirlpool(game,feature,dt);
    case 'updraft': {
      if(ellipseDistance(feature,game.player)>1) return false;
      push(game,35*Math.sin(feature.age),-395,dt);
      game.player.dash=Math.min(100,game.player.dash+dt*20);
      return true;
    }
    case 'eruption':
    case 'steamJet':
      return applyVent(game,feature,dt);
    case 'lightGate':
      return applyLight(game,feature,dt);
    case 'pulseLane':
      return applyPulse(game,feature,dt);
  }
  return false;
}

export function updateHabitat(game,dt) {
  const features=game.zone.features ?? [];
  for(const feature of features) {
    feature.age+=dt;
    const near=Math.abs(game.player.x-feature.originX)<900
      && Math.abs(game.player.y-feature.originY)<700+feature.ry;
    if(!near) {
      feature.near=false;
      feature.touchT=0;
      continue;
    }
    if(!feature.near) {
      feature.clock=0;
      feature.near=true;
      feature.state='rest';
    }
    feature.clock+=dt;
    const cycle=(feature.clock%feature.period+feature.period)%feature.period;
    const state=cycle<feature.warning ? 'warning' : cycle<feature.warning+feature.active ? 'active' : 'rest';
    const previous=feature.state;
    feature.state=state;
    feature.stateT=state==='warning' ? cycle : state==='active' ? cycle-feature.warning : cycle-feature.warning-feature.active;
    feature.progress=clamp(feature.stateT/feature.active,0,1);
    if(state!==previous && state!=='rest') {
      game.audio.environment?.(feature.kind,state);
    }
    if(state==='warning') {
      feature.x=feature.originX;
      feature.y=feature.originY;
      feature.touchT=0;
    }
    if(state!=='active') continue;
    const contact=applyFeature(game,feature,dt);
    feature.touchT=contact ? feature.touchT+dt : 0;
    if(game.ended) return;
  }
  resolveTerrain(game.player,23+Math.min(12,(game.player.size-1)*6),game.reef);
}
