import { TUNING } from '../data/tuning.js';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function heightAt(anchors, x) {
  for (let i = 1; i < anchors.length; i++) {
    const [endX, endY] = anchors[i];
    if (x > endX) continue;
    const [startX, startY] = anchors[i - 1];
    const f = clamp((x - startX) / (endX - startX), 0, 1);
    const ease = f * f * (3 - 2 * f);
    return startY + ease * (endY - startY);
  }
  return anchors.at(-1)[1];
}

export function floorAt(x, reef) {
  return reef.floor ? heightAt(reef.floor, x) : (reef.height ?? 540) - TUNING.world.safeMargin;
}

export function roofAt(x, reef) {
  return reef.roof ? heightAt(reef.roof, x) : TUNING.world.safeMargin;
}

function ellipseBoundary(entity, padding, reef) {
  if ((reef.scene?.shape ?? reef.shape) !== 'ellipse') return;
  const cx = reef.width / 2, cy = reef.height / 2, rx = cx - padding, ry = cy - padding;
  const dx = entity.x - cx, dy = entity.y - cy, normalized = Math.hypot(dx / rx, dy / ry);
  if (normalized > 1) { entity.x = cx + dx / normalized; entity.y = cy + dy / normalized; }
}

function closestEdge(points, x, y) {
  let nearest = null;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j];
    const b = points[i];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const fraction = clamp(((x - a.x) * dx + (y - a.y) * dy) / Math.max(1e-9, dx * dx + dy * dy), 0, 1);
    const px = a.x + dx * fraction;
    const py = a.y + dy * fraction;
    const distance = Math.hypot(x - px, y - py);
    if (!nearest || distance < nearest.distance) nearest = { x: px, y: py, distance, dx, dy };
  }
  return { ...nearest, inside };
}

export function solidContains(solid, x, y, padding = 0) {
  if (!solid.points) return Math.hypot((x - solid.x) / (solid.rx + padding), (y - solid.y) / (solid.ry + padding)) < 1 - 1e-7;
  if (solid.aabb && (x < solid.aabb.left - padding || x > solid.aabb.right + padding
    || y < solid.aabb.top - padding || y > solid.aabb.bottom + padding)) return false;
  const edge = closestEdge(solid.points, x, y);
  return edge.inside || edge.distance < padding - 1e-6;
}

function slide(entity, nx, ny) {
  const inward = (entity.vx ?? 0) * nx + (entity.vy ?? 0) * ny;
  if (inward < 0) {
    entity.vx = (entity.vx ?? 0) - inward * nx;
    entity.vy = (entity.vy ?? 0) - inward * ny;
  }
}

function collidePolygon(entity, padding, solid) {
  if (!solidContains(solid, entity.x, entity.y, padding)) return;
  const edge = closestEdge(solid.points, entity.x, entity.y);
  let nx = entity.x - edge.x;
  let ny = entity.y - edge.y;
  if (edge.inside) { nx *= -1; ny *= -1; }
  const length = Math.hypot(nx, ny);
  if (length < 1e-7) {
    nx = edge.dy;
    ny = -edge.dx;
    const normalLength = Math.hypot(nx, ny);
    nx /= normalLength;
    ny /= normalLength;
    const probe = closestEdge(solid.points, edge.x + nx * 0.1, edge.y + ny * 0.1);
    if (probe.inside) { nx *= -1; ny *= -1; }
  } else {
    nx /= length;
    ny /= length;
  }
  entity.x = edge.x + nx * (padding + 0.05);
  entity.y = edge.y + ny * (padding + 0.05);
  slide(entity, nx, ny);
}

function collideEllipse(entity, padding, solid) {
  const rx = solid.rx + padding;
  const ry = solid.ry + padding;
  const dx = entity.x - solid.x;
  const dy = entity.y - solid.y;
  const normalized = Math.hypot(dx / rx, dy / ry);
  if (normalized >= 1) return;
  let nx;
  let ny;
  if (normalized > 0.00001) {
    entity.x = solid.x + dx / normalized;
    entity.y = solid.y + dy / normalized;
    nx = dx / (rx * rx);
    ny = dy / (ry * ry);
  } else {
    nx = rx < ry ? 1 : 0;
    ny = rx < ry ? 0 : -1;
    entity.x = solid.x + nx * rx;
    entity.y = solid.y + ny * ry;
  }
  const length = Math.hypot(nx, ny);
  slide(entity, nx / length, ny / length);
}

export function resolveTerrain(entity, radius, reef) {
  const padding = Math.max(0, radius);
  entity.x = clamp(entity.x, padding + 2, reef.width - padding - 2);
  ellipseBoundary(entity, padding, reef);
  for (let pass = 0; pass < TUNING.world.projectionPasses; pass++) {
    const previousX = entity.x, previousY = entity.y;
    const high = roofAt(entity.x, reef) + padding;
    const low = floorAt(entity.x, reef) - padding;
    const y = clamp(entity.y, high, low);
    if (entity.y !== y) {
      const edge = entity.y < high ? roofAt : floorAt;
      const slope = (edge(entity.x + 2, reef) - edge(entity.x - 2, reef)) / 4;
      const vx = entity.vx ?? 0;
      const vy = entity.vy ?? 0;
      entity.vx = (vx + vy * slope) / (1 + slope * slope);
      entity.vy = entity.vx * slope;
      entity.y = y;
    }
    for (const solid of reef.solids ?? []) {
      if (solid.points) collidePolygon(entity, padding, solid);
      else collideEllipse(entity, padding, solid);
    }
    ellipseBoundary(entity, padding, reef);
    // In open water a second identical projection cannot change the result.
    if (entity.x === previousX && entity.y === previousY) break;
  }
  entity.x = clamp(entity.x, padding + 2, reef.width - padding - 2);
  entity.y = clamp(entity.y, roofAt(entity.x, reef) + padding, floorAt(entity.x, reef) - padding);
  ellipseBoundary(entity, padding, reef);
  if ((reef.solids ?? []).some(solid => solidContains(solid,entity.x,entity.y,padding))) {
    const originX=entity.x;
    const originY=entity.y;
    let found=false;
    for(const distance of TUNING.world.escapeRadii) {
      for(let i=0;i<32;i++) {
        const angle=i/32*Math.PI*2;
        const x=clamp(originX+Math.cos(angle)*distance,padding+2,reef.width-padding-2);
        const y=originY+Math.sin(angle)*distance;
        if(y<roofAt(x,reef)+padding||y>floorAt(x,reef)-padding) continue;
        if ((reef.scene?.shape ?? reef.shape) === 'ellipse' && Math.hypot((x - reef.width / 2) / (reef.width / 2 - padding), (y - reef.height / 2) / (reef.height / 2 - padding)) > 1) continue;
        if((reef.solids ?? []).some(solid => solidContains(solid,x,y,padding))) continue;
        entity.x=x;
        entity.y=y;
        entity.vx=0;
        entity.vy=0;
        found=true;
        break;
      }
      if(found) break;
    }
  }
  return entity;
}

export class Terrain {
  constructor(scene = {}) {
    this.scene = scene;
    this.width = scene.width ?? scene.bounds?.width ?? 960;
    this.height = scene.height ?? scene.bounds?.height ?? 540;
    this.floor = scene.floor; this.roof = scene.roof;
    this.solids = (scene.solids ?? []).map(s => s.r && !s.rx ? { ...s, rx: s.r, ry: s.r } : !s.points && !s.rx && s.w ? ({ ...s, points: [{ x: s.x - s.w / 2, y: s.y - s.h / 2 }, { x: s.x + s.w / 2, y: s.y - s.h / 2 }, { x: s.x + s.w / 2, y: s.y + s.h / 2 }, { x: s.x - s.w / 2, y: s.y + s.h / 2 }] }) : s);
    this.solids = this.solids.map(s => s.points && !s.aabb ? ({ ...s, aabb: { left: Math.min(...s.points.map(p => p.x)), right: Math.max(...s.points.map(p => p.x)), top: Math.min(...s.points.map(p => p.y)), bottom: Math.max(...s.points.map(p => p.y)) } }) : s);
    this.gates = scene.gates ?? [];
    this.breakables = scene.breakables ?? [];
    this.gateSolids = this.gates.map(g => ({
      ...g, aabb: { left:g.x,right:g.x+g.w,top:g.y,bottom:g.y+g.h },
      points: [{ x:g.x,y:g.y }, { x:g.x+g.w,y:g.y }, { x:g.x+g.w,y:g.y+g.h }, { x:g.x,y:g.y+g.h }],
    }));
    this.breakableState = this.breakables.map(block => !!block.broken);
    this.collisionViews = new Map();
  }
  collisionView(tier = 0) {
    for (let i = 0; i < this.breakables.length; i++) {
      const broken = !!this.breakables[i].broken;
      if (broken !== this.breakableState[i]) {
        this.breakableState[i] = broken;
        this.collisionViews.clear();
      }
    }
    const existing = this.collisionViews.get(tier);
    if (existing) return existing;
    const solids = this.solids.concat(this.breakables.filter(s => !s.broken), this.gateSolids.filter(g => tier < g.tier));
    const view = { width:this.width, height:this.height, floor:this.floor, roof:this.roof, scene:this.scene, solids };
    this.collisionViews.set(tier, view);
    return view;
  }
  blockers(tier = 0) { return this.collisionView(tier).solids; }
  resolve(entity, radius = entity.r ?? TUNING.player.radius, tier = entity.tier ?? 0) {
    return resolveTerrain(entity, radius, this.collisionView(tier));
  }
  contains(x, y, radius = 0, tier = 0) {
    if (this.scene.shape === 'ellipse' && Math.hypot((x - this.width / 2) / (this.width / 2 - radius), (y - this.height / 2) / (this.height / 2 - radius)) > 1) return true;
    return x < radius || x > this.width - radius || y < roofAt(x, this) + radius || y > floorAt(x, this) - radius || this.blockers(tier).some(s => solidContains(s, x, y, radius));
  }
}
export const createTerrain = scene => new Terrain(scene);
