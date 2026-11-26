import { MAPS, PREY } from '../ocean-data.js';
import { TAU, clamp } from './core.js';
import { DREAM_REEF, floorAt, roofAt, regionAt } from './reefs.js';
import { EQUIPMENT } from './equipment.js';
import { HERO_POSES, animatedSprite, prepareRivals, prepareSwimmer } from './swim-animation.js';
import swimmer from '../../assets/side/swimmer.webp';
import reef from '../../assets/side/reef.webp';
import fauna from '../../assets/side/fauna.webp';
import rivals from '../../assets/side/rivals.webp';
import landmarks from '../../assets/side/landmarks.webp';
import loot from '../../assets/side/loot.webp';
import dashImage from '../../assets/side/swim-dash.webp';
import biteImage from '../../assets/side/swim-bite.webp';
import singImage from '../../assets/side/swim-sing.webp';
import hurtImage from '../../assets/side/swim-hurt.webp';
import bay from '../../assets/side/bay.webp';
import porcelain from '../../assets/side/porcelain.webp';
import violet from '../../assets/side/violet.webp';
import magma from '../../assets/side/magma.webp';
import sanctuary from '../../assets/side/sanctuary.webp';
import coralIsland from '../../assets/side/island-coral.webp';
import wreckIsland from '../../assets/side/island-wreck.webp';
import crystalIsland from '../../assets/side/island-crystal.webp';
import ventIsland from '../../assets/side/island-vent.webp';
import boneIsland from '../../assets/side/island-bone.webp';
import equipmentImage from '../../assets/side/equipment.webp';

const FISH = ['fry', 'lantern', 'manta', 'royal', 'nightmare', 'jelly'];
const FISH_SIZE = [26, 48, 85, 94, 89, 74];
const RIVAL = ['grok', 'qwen', 'gemini', 'zhipu', 'claude', 'salary'];
const LOOT = { crystal: [0, 47], clam: [1, 42], chest: [2, 52], urchin: [3, 47] };
const DECOR = { coral: 0, wreck: 1, crystal: 2, vent: 3, bone: 4 };
const mod = (x, n) => (x % n + n) % n;
const noise = n => {
  const v = Math.sin(n * 127.13 + 43.33) * 43758.5453;
  return v - Math.floor(v);
};

function circle(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
}

function oval(c, x, y, w, h) {
  c.beginPath();
  c.ellipse(x, y, w, h, 0, 0, TAU);
}

function line(c, color, width, coords) {
  c.beginPath();
  c.moveTo(coords[0], coords[1]);
  for (let i = 2; i < coords.length; i += 2) c.lineTo(coords[i], coords[i + 1]);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

function label(c, text, x, y, color = '#e6f5ff', size = 13) {
  c.font = '600 ' + size + 'px "Microsoft YaHei UI", sans-serif';
  c.textAlign = 'center';
  c.lineWidth = Math.max(2, size * 0.23);
  c.strokeStyle = '#071422df';
  c.strokeText(text, x, y);
  c.fillStyle = color;
  c.fillText(text, x, y);
}

function load(src) {
  const image = new Image();
  image.src = src;
  return image.decode().then(() => image);
}

export class OceanView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.x = 0;
    this.y = 0;
    this.resize();
  }

  async load() {
    const [body, dash, bite, sing, hurt, rivalsAtlas, dream, fish, landmarksAtlas, lootAtlas, equipmentAtlas, ...backgrounds] = await Promise.all(
      [swimmer, dashImage, biteImage, singImage, hurtImage, rivals, reef, fauna, landmarks, loot, equipmentImage, bay, porcelain, violet, magma, sanctuary, coralIsland, wreckIsland, crystalIsland, ventIsland, boneIsland].map(load));
    this.swimmer = prepareSwimmer(body, { dash, bite, sing, hurt });
    this.rivalSprites = prepareRivals(rivalsAtlas);
    this.dreamBackground = dream;
    this.fauna = fish;
    this.landmarks = landmarksAtlas;
    this.loot = lootAtlas;
    this.equipmentAtlas = equipmentAtlas;
    this.backgrounds = backgrounds.slice(0,5);
    this.islands = backgrounds.slice(5);
  }

  resize() {
    this.w = this.canvas.clientWidth || innerWidth;
    this.h = this.canvas.clientHeight || innerHeight;
    this.ratio = Math.min(2, devicePixelRatio);
    this.canvas.width = Math.round(this.w * this.ratio);
    this.canvas.height = Math.round(this.h * this.ratio);
    this.ctx.imageSmoothingQuality = "high";
    this.baseScale = Math.min(this.h / 600, this.w / 540);
    this.scale = this.baseScale;
    this.viewW = this.w / this.scale;
    this.viewH = this.h / this.scale;
    this.snap = true;
  }

  camera(dive, dt) {
    const p = dive.player;
    const desired = this.baseScale / (1 + (dive.zone ? dive.stage * 0.045 : 0));
    this.scale += (desired - this.scale) * (this.snap ? 1 : 1 - Math.exp(-dt * 2));
    this.viewW = this.w / this.scale;
    this.viewH = this.h / this.scale;
    const x = clamp(p.x - this.viewW * (p.dir > 0 ? 0.41 : 0.53), -64, Math.max(-64, dive.reef.width - this.viewW + 64));
    const y = clamp(p.y + p.vy * 0.14 - this.viewH * 0.49, 4, Math.max(4, dive.reef.bounds - this.viewH));
    const easing = this.snap ? 1 : 1 - Math.exp(-dt * 4.8);
    this.x += (x - this.x) * easing;
    this.y += (y - this.y) * easing;
    this.snap = false;
  }

  visible(p, margin = 120) {
    return p.x >= this.x - margin && p.x <= this.x + this.viewW + margin
      && (p.y === undefined || (p.y >= this.y - margin && p.y <= this.y + this.viewH + margin));
  }

  draw(dive, dt, t, title) {
    const c = this.ctx;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    if (!this.backgrounds) {
      c.fillStyle = '#091527';
      c.fillRect(0, 0, this.w, this.h);
      return;
    }
    if (title || !dive) {
      this.background(c, this.dreamBackground, DREAM_REEF, t * 18, 0);
      const width = Math.min(this.w * 0.51, this.h * 0.94);
      animatedSprite(c, this.swimmer.idle, t * 0.65, {
        x: this.w * 0.72, y: this.h * 0.49 + Math.sin(t * 1.6) * 10, width, dir: -1, tilt: Math.sin(t * 1.3) * 0.018,
      });
      return;
    }
    this.camera(dive, dt);
    const { reef: terrain, shake } = dive;
    const image = dive.zone ? this.backgrounds[dive.map] : this.dreamBackground;
    this.background(c, image, terrain, this.x, this.y);
    c.save();
    c.scale(this.scale, this.scale);
    c.translate(-this.x + Math.sin(t * 118) * shake, -this.y + Math.cos(t * 92) * shake * 0.6);
    this.props(c, terrain, t, dive);
    this.terrain(c, image, terrain, t);
    this.solidReefs(c, image, terrain, t);
    if (dive.zone) {
      this.environment(c, dive, t);
      this.hunt(c, dive, t);
    }
    else this.dream(c, dive, t);
    this.effects(c, dive);
    this.hero(c, dive, t);
    c.restore();
    if (dive.damage > 0) {
      const rim = c.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.22, this.w / 2, this.h / 2, this.w * 0.6);
      rim.addColorStop(0, '#f0466500');
      rim.addColorStop(1, '#f04665' + Math.round(dive.damage * 110).toString(16).padStart(2, '0'));
      c.fillStyle = rim;
      c.fillRect(0, 0, this.w, this.h);
    }
  }

  background(c, image, reef, x, y) {
    const h = this.h * 1.31;
    const w = Math.max(this.w * 1.02, h * image.width / image.height);
    const offset = mod(x * this.scale * 0.43 + w * 0.13, w * 2);
    const top = -this.h * (0.055 + clamp(y / Math.max(140, reef.bounds - this.viewH), 0, 1) * 0.18);
    for (let tile = Math.floor(offset / w); tile * w < offset + this.w; tile++) {
      const dx = w * tile - offset;
      c.save();
      c.translate(dx + (tile % 2 ? w : 0), top);
      c.scale(tile % 2 ? -1 : 1, 1);
      c.drawImage(image, 0, 0, Math.ceil(w) + 1, Math.ceil(h));
      c.restore();
    }
    const depth = c.createLinearGradient(0, 0, 0, this.h);
    depth.addColorStop(0, '#050c2060');
    depth.addColorStop(0.46, '#080e230c');
    depth.addColorStop(1, reef.mist + '2b');
    c.fillStyle = depth;
    c.fillRect(0, 0, this.w, this.h);
  }

  props(c, reef, t, dive) {
    const start = Math.floor((this.x - 32) / 85);
    const end = Math.ceil((this.x + this.viewW + 32) / 85);
    const sparks = dive.zone && dive.map === 3;
    for (let i = start; i <= end; i++) {
      for (let j = 0; j < (sparks ? 7 : 4); j++) {
        const salt = i * 7 + j;
        const x = i * 85 + mod(noise(salt) * 85 + t * (j + 2) * 1.8, 85);
        const high = roofAt(x, reef);
        const depth = Math.max(1, floorAt(x, reef) - high);
        const y = high + mod(noise(salt + 231) * depth - t * (sparks ? 21 + j * 2 : 3 + j), depth);
        circle(c, x, y, 0.7 + noise(salt + 73) * 1.3);
        c.fillStyle = j % 2 ? reef.foam + (sparks ? '92' : '5a') : reef.light + '42';
        c.fill();
      }
    }
    if (dive.zone) {
      for (const [x, y, width] of reef.ledges) {
        if (!this.visible({ x, y }, 250)) continue;
        this.atlas(c, this.landmarks, dive.map, x, y - width * 0.16, width, x % 2 ? 1 : -1, 0, 0.59);
      }
      for (const decoration of reef.decorations ?? []) {
        const { x, y, width, kind, alpha = 0.75 } = decoration;
        if (this.visible({ x, y }, width * 0.6)) this.atlas(c, this.landmarks, DECOR[kind] ?? dive.map,
          x, y - width * 0.19, width, Math.sin(x) < 0 ? -1 : 1, 0, alpha);
      }
      if (dive.map === 2) return;
    }
    const jellies = dive.zone ? Array.from({length: Math.ceil(reef.width / 700)}, (_,i) => i * 700 + 360)
      : [260, 580, 922, 1290, 1632];
    for (const [i, x] of jellies.entries()) {
      const y = roofAt(x, reef) + 69 + Math.sin(x + t * 1.6) * 12;
      if (this.visible({ x, y })) this.fish(c, 'jelly',
        { x: x + Math.sin(t + x) * 16, y, dir: 1 }, 57 + i * 2, 0.32, t);
    }
  }

  terrain(c, image, reef, t) {
    const start = Math.floor(this.x / 14) * 14 - 28;
    const end = Math.ceil((this.x + this.viewW) / 14) * 14 + 28;
    const top = this.y - 30;
    const bottom = this.y + this.viewH + 30;
    for (const isRoof of [false, true]) {
      const heightAt = isRoof ? roofAt : floorAt;
      const border = isRoof ? top : bottom;
      const nearSurface = isRoof ? '#0d1728' : reef.ground;
      c.save();
      c.beginPath();
      c.moveTo(start, heightAt(start, reef));
      for (let x = start + 14; x <= end; x += 14) c.lineTo(x, heightAt(x, reef));
      c.lineTo(end, border);
      c.lineTo(start, border);
      c.closePath();
      c.clip();
      c.fillStyle = nearSurface;
      c.fillRect(start, top, end - start, bottom - top);
      const tileW = 480;
      const cropTop = isRoof ? 0 : image.height * 0.58;
      const cropW = image.width * 0.30;
      const cropH = image.height * (isRoof ? 0.46 : 0.42);
      const tileH = Math.round(tileW * cropH / cropW);
      const textureY = isRoof ? -70 : 260;
      c.globalAlpha = isRoof ? 0.50 : 0.63;
      const firstRow = Math.floor((top - textureY) / tileH);
      const lastY = Math.min(bottom, reef.bounds);
      for (let row = firstRow; row * tileH + textureY < lastY; row++) {
        const flipY = Math.abs(row % 2) === 1;
        for (let tile = Math.floor(start / tileW); tile * tileW < end; tile++) {
          const flipX = Math.abs(tile % 2) === 1;
          c.save();
          c.translate(tile * tileW + (flipX ? tileW : 0), textureY + row * tileH + (flipY ? tileH : 0));
          c.scale(flipX ? -1 : 1, flipY ? -1 : 1);
          c.drawImage(image, image.width * 0.39, cropTop, cropW, cropH, 0, 0, tileW + 0.6, tileH + 0.6);
          c.restore();
        }
      }
      c.restore();
      c.beginPath();
      c.moveTo(start, heightAt(start, reef));
      for (let x = start + 14; x <= end; x += 14) c.lineTo(x, heightAt(x, reef));
      c.lineWidth = isRoof ? 2.6 : 3.3;
      c.strokeStyle = reef.light + (isRoof ? '2b' : '3f');
      c.stroke();
    }
    for (const [startX, endX] of reef.lava ?? []) {
      if (endX < start || startX > end) continue;
      const x0 = Math.max(start, startX);
      const x1 = Math.min(end, endX);
      for (let width = 10; width >= 2; width -= 4) {
        c.beginPath();
        c.moveTo(x0, floorAt(x0, reef) + 1.8);
        for (let x = x0 + 8; x <= x1; x += 8) c.lineTo(x, floorAt(x, reef) + Math.sin(x * 0.11 + t * 3.5) * 3);
        c.lineWidth = width;
        c.strokeStyle = width === 2 ? '#fff4b2' : width === 6 ? '#fc904e9b' : '#e7423c42';
        c.stroke();
      }
    }
    this.kelp(c, reef, t);
  }

  solidReefs(c, image, reef, t) {
    const topFractions = [0.53,0.61,0.59,0.54,0.61];
    for (const solid of reef.solids ?? []) {
      if (solid.points) {
        this.formation(c, solid, reef);
        continue;
      }
      const index = DECOR[solid.style] ?? 0;
      const sprite = this.islands[index];
      const top = topFractions[index];
      const fullHeight = solid.ry * 2 / (1 - top);
      const width = solid.rx * 2.07;
      if (!this.visible(solid, Math.max(solid.rx, fullHeight) + 40)) continue;
      const left = solid.x - width * 0.5;
      const y = solid.y + solid.ry - fullHeight;
      c.drawImage(sprite, left, y, width, fullHeight);
      if (solid.style === 'vent') {
        for (let i = 0; i < 3; i++) {
          const phase = mod(t * 0.35 + i * 0.34, 1);
          circle(c, solid.x + Math.sin(t + i) * 20, solid.y - solid.ry - phase * 75, 1.5 + phase * 3);
          c.fillStyle = '#ffce81' + Math.round((1 - phase) * 115).toString(16).padStart(2,'0');
          c.fill();
        }
      }
    }
  }

  formation(c, solid, reef) {
    if (!this.visible(solid, Math.max(solid.rx,solid.ry)+80)) return;
    const { left, right, top, bottom } = solid.aabb;
    const image = this.islands[DECOR[solid.style] ?? 0];
    const path = () => {
      c.beginPath();
      solid.points.forEach((p,i) => i ? c.lineTo(p.x,p.y) : c.moveTo(p.x,p.y));
      c.closePath();
    };
    c.save();
    path();
    c.fillStyle = solid.style === 'bone' ? '#a29c7b' : solid.style === 'wreck' ? '#403c49' : reef.ground;
    c.fill();
    c.clip();
    for (let x = left; x < right; x += 150) {
      for (let y = top; y < bottom; y += 96) {
        c.drawImage(image,image.width*0.17,image.height*0.67,image.width*0.68,image.height*0.30,x,y,151,97);
      }
    }
    const shadow=c.createLinearGradient(left,top,left,bottom);
    shadow.addColorStop(0,reef.light+'25');
    shadow.addColorStop(1,'#071126a0');
    c.fillStyle=shadow;
    c.fillRect(left,top,right-left,bottom-top);
    c.restore();
    path();
    c.strokeStyle=solid.style==='bone' ? '#eadcaf9a' : reef.light+'7c';
    c.lineWidth=2.6;
    c.stroke();
  }

  environment(c, game, t) {
    for (const f of game.zone.features) {
      const margin = Math.max(f.rx, f.ry*2) + 70;
      if (!this.visible(f,margin)) continue;
      const warning=f.state==='warning';
      const active=f.state==='active';
      const color=warning ? '#ffd89b' : game.reef.light;
      c.save();
      c.globalAlpha=active ? 0.86 : warning ? 0.58+Math.sin(t*17)*0.16 : 0.22;
      c.strokeStyle=color;
      c.lineWidth=2;
      if (warning) c.setLineDash([8,6]);
      if (f.kind==='fallingDebris' || f.kind==='sluice') {
        if (warning && f.kind==='fallingDebris') {
          line(c,'#ffc7a0',2,[f.originX,f.originY,f.originX,f.originY+330]);
          oval(c,f.originX,f.originY+330,45,13);
          c.stroke();
        }
        c.translate(f.x,f.y);
        c.rotate(f.kind==='sluice' ? f.sway ?? 0 : f.progress*0.45);
        c.fillStyle='#5a4d4c';
        c.fillRect(-f.rx,-f.ry,f.rx*2,f.ry*2);
        c.strokeRect(-f.rx,-f.ry,f.rx*2,f.ry*2);
        c.setLineDash([]);
        line(c,'#b1986f',2,[-f.rx*0.6,-f.ry*0.9,-f.rx*0.5,f.ry*0.9]);
        line(c,'#a3b9c4',2,[-f.rx,0,f.rx,0]);
      } else if (f.kind==='lightGate') {
        const gap=f.gapY ?? f.y;
        const half=f.gapHalf ?? 85;
        c.fillStyle=active ? '#fff0ae8f' : '#fae3a92b';
        const high=f.y-f.ry;
        const low=f.y+f.ry;
        for (const [y0,y1] of [[high,gap-half],[gap+half,low]]) {
          c.fillRect(f.x-f.rx,y0,f.rx*2,Math.max(0,y1-y0));
          line(c,'#fff1c2',3,[f.x,y0,f.x,y1]);
        }
        c.strokeStyle='#a0ffdf';
        c.setLineDash([]);
        oval(c,f.x,gap,25,half);
        c.stroke();
      } else if (f.kind==='eruption') {
        const high=f.originY-f.ry*2;
        c.fillStyle=active ? '#ff824739' : '#ff824712';
        c.fillRect(f.x-f.rx,high,f.rx*2,f.ry*2);
        if (active) {
          for (let i=0;i<12;i++) {
            const a=mod(t*1.4+i/12,1);
            circle(c,f.x+Math.sin(i*2.7+t)*f.rx*0.58,f.originY-a*f.ry*2,3+(1-a)*6);
            c.fillStyle=i%2 ? '#ffcf86' : '#f68964';
            c.fill();
          }
        }
        c.strokeStyle='#ffbc89';
        c.strokeRect(f.x-f.rx,high,f.rx*2,f.ry*2);
      } else if (f.kind==='steamJet') {
        c.strokeRect(f.x-f.rx,f.y-f.ry,f.rx*2,f.ry*2);
        for (let i=0;i<8;i++) {
          const a=mod(t*1.2+i/8,1);
          oval(c,f.x-f.rx+a*f.rx*2,f.y+Math.sin(a*9)*f.ry*0.5,4+a*11,4+a*6);
          c.stroke();
        }
      } else if (f.kind==='whirlpool' || f.kind==='pulseLane') {
        c.setLineDash([]);
        const radius=f.kind==='pulseLane' && active ? f.radius : f.rx;
        if (f.kind==='pulseLane') {
          circle(c,f.x,f.y,Math.max(3,radius));
          c.lineWidth=active ? 4 : 1.5;
          c.stroke();
          circle(c,f.x,f.y,Math.max(3,radius-9));
          c.globalAlpha*=0.4;
          c.stroke();
        } else {
          for (let i=0;i<4;i++) {
            c.beginPath();
            for (let j=0;j<=28;j++) {
              const a=t*(active ? 2.4 : 0.6)+i*TAU/4+j*0.11;
              const r=f.rx*(0.12+j/33);
              const x=f.x+Math.cos(a)*r;
              const y=f.y+Math.sin(a)*r*0.85;
              if(j) c.lineTo(x,y); else c.moveTo(x,y);
            }
            c.stroke();
          }
        }
      } else {
        oval(c,f.x,f.y,f.rx,f.ry);
        c.stroke();
        c.setLineDash([]);
        const dx=(f.dx ?? 0)*(f.kind==='surge' && Math.floor(f.age/f.period)%2 ? -1 : 1);
        const dy=f.dy ?? -1;
        for (let i=0;i<10;i++) {
          const a=mod(t*0.9+i/10,1)-0.5;
          const x=f.x+a*f.rx*dx*1.6+Math.sin(i*4)*f.rx*0.25;
          const y=f.y+a*f.ry*dy*1.6+Math.cos(i*4)*f.ry*0.25;
          line(c,color,1.8,[x-dx*12,y-dy*12,x+dx*12,y+dy*12]);
        }
      }
      c.restore();
      if ((active || warning) && Math.hypot(game.player.x-f.x,game.player.y-f.y)<500) {
        label(c,f.label+(warning ? ' · 预警' : ''),f.x,f.kind==='eruption' ? f.originY-f.ry*2-18 : f.y-f.ry-15,color,12);
      }
    }
  }

  kelp(c, reef, t) {
    for (const x of reef.kelp) {
      const y = floorAt(x, reef);
      if (!this.visible({ x, y }, 150)) continue;
      c.strokeStyle = reef.light + '53';
      c.lineCap = 'round';
      for (let i = -3; i <= 3; i++) {
        const top = 48 + (3 - Math.abs(i)) * 14;
        const wave = Math.sin(t * 1.3 + i + x) * 15;
        c.lineWidth = 3 + Math.abs(i) * 0.65;
        c.beginPath();
        c.moveTo(x + i * 10, y + 3);
        c.bezierCurveTo(x + i * 9 - wave, y - 36, x + i * 11 + wave, y - top * 0.78, x + i * 14 + wave, y - top);
        c.stroke();
      }
      c.lineCap = 'butt';
    }
  }

  atlas(c, image, index, x, y, width, dir = 1, tilt = 0, alpha = 1, heightFactor = 1) {
    const cellW = image.width / 3;
    const cellH = image.height / 2;
    const h = width * cellH / cellW * heightFactor;
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    c.scale(dir, 1);
    c.globalAlpha = alpha;
    c.drawImage(image, index % 3 * cellW, Math.floor(index / 3) * cellH, cellW, cellH, -width / 2, -h / 2, width, h);
    c.restore();
  }

  fish(c, kind, p, width, opacity = 1, t = 0) {
    const index = FISH.indexOf(kind === 'abyss' ? 'nightmare' : kind);
    const phase=p.phase ?? p.x;
    const speed=Math.hypot(p.vx ?? 0,p.vy ?? 0);
    const wing=kind==='manta' ? 0.16 : kind==='fry' && p.panic>0 ? 0.08 : 0.038;
    const frequency=kind==='manta' ? 4.8 : kind==='fry' ? 12 : 5.8;
    const tilt=kind==='manta' ? Math.sin(t*2+phase)*0.12 : Math.sin(t*2+phase)*0.045;
    this.atlas(c, this.fauna, index, p.x, p.y, width, p.dir,tilt,
      opacity,1+Math.sin(t*frequency+phase)*wing*Math.min(1.2,0.6+speed/140));
  }

  fishSignals(c,fish,width,game,t) {
    if (fish.glow>0.4 && fish.kind==='lantern') {
      const glow=c.createRadialGradient(fish.x+fish.dir*width*0.22,fish.y-width*0.16,1,fish.x,fish.y,width*0.69);
      glow.addColorStop(0,'#ffdc9a'+Math.round(fish.glow*105).toString(16).padStart(2,'0'));
      glow.addColorStop(1,'#ffd78a00');
      c.fillStyle=glow;
      c.fillRect(fish.x-width,fish.y-width,width*2,width*2);
    }
    const action=fish.action;
    c.save();
    c.lineWidth=1.7;
    c.strokeStyle=fish.kind==='lantern' ? '#ffe2a3' : fish.kind==='royal' ? '#ffc299' : '#c7c3ff';
    if (fish.tellT>0) {
      c.setLineDash([6,4]);
      if (action==='charge' || action==='lungeTell') {
        line(c,'#ff9c9c',4,[fish.x,fish.y,fish.x+fish.aimX*250,fish.y+fish.aimY*250]);
      } else {
        circle(c,fish.x,fish.y,fish.pulseRadius || width*0.68);
        c.stroke();
      }
    }
    c.setLineDash([]);
    if (action==='suction' && fish.stateT>0.95) {
      for (let i=0;i<7;i++) {
        const phase=1-mod(t*2+i/7,1);
        const side=Math.sin(i*4)*phase*74;
        const x=fish.x+fish.aimX*phase*195-fish.aimY*side;
        const y=fish.y+fish.aimY*phase*195+fish.aimX*side;
        line(c,'#b6bdff99',2,[x+fish.aimX*20,y+fish.aimY*20,x,y]);
      }
    }
    if (action==='vortex' && fish.stateT>0.72) {
      for (let i=0;i<3;i++) {
        c.beginPath();
        c.arc(fish.x,fish.y,46+i*25,t*3+i,t*3+i+Math.PI*1.3);
        c.stroke();
      }
    }
    if (fish.kind==='royal') {
      c.beginPath();
      c.ellipse(fish.x+fish.dir*width*0.22,fish.y,width*0.22,width*0.29,0,
        fish.dir>0 ? -1.2 : Math.PI-1.2,fish.dir>0 ? 1.2 : Math.PI+1.2);
      c.strokeStyle=fish.armored ? '#deedffb0' : '#9dffd266';
      c.lineWidth=fish.armored ? 3 : 1.3;
      c.stroke();
    }
    c.restore();
    if (Math.hypot(fish.x-game.player.x,fish.y-game.player.y)<210 && fish.kind!=='fry') {
      const tips={flash:'闪光蓄势 · 拉开距离',vortex:'涡流',charge:'冲撞蓄势',rush:'冲撞',suction:'吸食 · 侧向逃离',
        lungeTell:'巨口突袭',lunge:'巨口突袭',guard:'正面护甲 · 绕后',recover:'破绽',lurk:'埋伏',evade:'高速闪避'};
      const tip=tips[action];
      if(tip) label(c,tip,fish.x,fish.y-width*0.39,'#ffe1ba',11);
    }
  }

  hero(c, dive, t) {
    const p = dive.player;
    const width = 149 * Math.pow(p.size, 0.62);
    if (dive.equipment?.shield) {
      oval(c,p.x-10*p.dir,p.y,65+14*p.size,48+8*p.size);
      c.strokeStyle='#acecff8c';
      c.lineWidth=2.4;
      c.stroke();
    }
    if (dive.equipment?.magnet) {
      c.setLineDash([5,13]);
      circle(c,p.x,p.y,142+Math.sin(t*2)*8);
      c.strokeStyle='#86ffd952';
      c.lineWidth=1.4;
      c.stroke();
      c.setLineDash([]);
    }
    const bite = (dive.biteFlash ?? 0) / 0.23;
    const speed = Math.hypot(p.vx, p.vy);
    const singing = dive.singing || dive.charging;
    const motion = dive.damage > 0.56 ? 'hurt' : bite > 0.14 ? 'bite' : singing ? 'sing'
      : p.dashing ? 'dash' : speed > 21 ? 'swim' : 'idle';
    const pose = HERO_POSES[motion];
    const bob = Math.sin(t * 3.8) * (p.dashing ? 1.5 : 3.2);
    const tilt = (p.tilt + Math.sin(p.scull * TAU) * (speed > 30 ? 0.058 : 0.023)) * p.dir;
    const x = p.x + p.dir * (motion === 'bite' ? 10 * bite : motion === 'hurt' ? -10 : 0);
    const alpha = p.invuln > 0 && Math.sin(t * 19) > 0 ? 0.57 : p.hidden ? 0.72 : 1;
    if (p.dashing) {
      for (let i = 2; i > 0; i--) {
        animatedSprite(c, this.swimmer.dash, p.scull - 0.105 * i, {
          x: p.x - p.vx * i * 0.043, y: p.y - p.vy * i * 0.032 + bob, width: width * 1.06,
          dir: p.dir, tilt, alpha: 0.11 + 0.08 * (2 - i), pivotX: HERO_POSES.dash.pivotX, pivotY: HERO_POSES.dash.pivotY,
        });
      }
    }
    if (singing || dive.frenzyT > 0) {
      const gold = dive.frenzyT > 0;
      const radius = dive.singing ? dive.songRadius : gold ? 83 : 57 + dive.songCharge * 62;
      circle(c, p.x, p.y, radius);
      c.strokeStyle = gold ? '#ffe39e85' : '#94f5ff62';
      c.lineWidth = gold ? 3 : 1.2;
      c.stroke();
      circle(c, p.x, p.y, radius * (0.65 + mod(t * 0.7, 0.35)));
      c.strokeStyle = gold ? '#ffe39e46' : '#94f5ff46';
      c.stroke();
      if (singing) {
        for (let i = 0; i < 5; i++) {
          const f = mod(t * 1.3 + i * 0.21, 1);
          circle(c, p.x + p.dir * (25 + f * 64) + Math.sin(f * 11) * 8, p.y - f * 71, 2 + f * 2);
          c.strokeStyle = '#bdeeff' + Math.round((1 - f) * 215).toString(16).padStart(2, '0');
          c.stroke();
        }
      }
    }
    animatedSprite(c, this.swimmer[motion], p.scull, {
      x, y: p.y + bob, width: width * pose.width, dir: p.dir, tilt, alpha,
      pivotX: pose.pivotX, pivotY: pose.pivotY, squash: 1 - p.turn / 0.16 * 0.41,
    });
    if (bite > 0.16) {
      c.save();
      c.translate(x + p.dir * (36 + (p.size - 1) * 10), p.y + bob);
      c.scale(p.dir, 1);
      c.strokeStyle = '#fff1a5';
      c.globalAlpha = bite;
      c.lineWidth = 2.7;
      c.beginPath();
      c.arc(-7, 0, 23 + (1 - bite) * 17, -0.88, 0.88);
      c.stroke();
      c.restore();
    }
  }

  hunt(c, game, t) {
    const { zone, map, player } = game;
    for (const item of zone.things) {
      if (!this.visible(item)) continue;
      if (item.kind === 'geyser') {
        this.vent(c, item, t, (game.time + item.x * 0.02) % 6 < 1.4);
        continue;
      }
      if (item.kind === 'jelly') {
        this.fish(c, 'jelly', { ...item, dir: 1, y: item.y + Math.sin(t * 3 + item.phase) * 7 }, 73, item.timer ? 0.51 : 0.91, t);
        continue;
      }
      if (item.timer > 0) continue;
      if (PREY[item.kind]) {
        const tier = PREY[item.kind].tier;
        this.fishSignals(c,item,FISH_SIZE[tier],game,t);
        this.fish(c, item.kind, item, FISH_SIZE[tier], 1, t);
        if (tier > 0) {
          const edible = tier <= game.stage;
          circle(c, item.x, item.y + FISH_SIZE[tier] * 0.32, 2.3);
          c.fillStyle = edible ? '#93ffe5' : '#ff837d';
          c.fill();
          if (Math.abs(player.x - item.x) < 128 && Math.abs(player.y - item.y) < 98) {
            label(c, PREY[item.kind].name, item.x, item.y - FISH_SIZE[tier] * 0.28, c.fillStyle, 11);
          }
        }
      } else if (item.kind === 'salary') {
        animatedSprite(c, this.rivalSprites[5], t * 0.8, { x: item.x, y: item.y + Math.sin(t * 2) * 4, width: 62 });
        if (Math.abs(player.x - item.x) < 120) label(c, '迷路的上班族', item.x, item.y - 30, '#d9e7f0', 11);
      } else {
        this.collectible(c, item, t);
      }
    }
    for (const predator of zone.predators) {
      if (predator.timer || !this.visible(predator, 200)) continue;
      const def = PREY[predator.kind];
      const width = 112 + def.tier * 22;
      this.fishSignals(c,predator,width,game,t);
      this.fish(c, predator.kind, predator, width, predator.stun ? 0.65 : 1, t);
      const color = def.tier <= game.stage ? '#b5ffe4' : '#ff9a96';
      const text = predator.stun ? '鲸歌失衡' : predator.hunting ? '正在猎杀' : def.tier <= game.stage ? '可捕食' : '第' + (def.tier + 1) + '阶可捕食';
      label(c, text, predator.x, predator.y - width * 0.34, color, 12);
    }
    for (const item of zone.pickups) {
      if(item.timer || !this.visible(item,65)) continue;
      const spec=EQUIPMENT[item.kind];
      const y=item.y+Math.sin(t*2.3+item.x)*5;
      circle(c,item.x,y,29);
      c.fillStyle=spec.color+'12';
      c.fill();
      this.atlas(c,this.equipmentAtlas,spec.index,item.x,y,53);
      if (Math.hypot(item.x-player.x,item.y-player.y)<165 || game.equipment.sonar) {
        label(c,spec.name,item.x,y-34,spec.color,12);
      }
    }
    if(game.equipment.sonar){
      const targets=[...zone.pickups.filter(item=>!item.timer),...zone.things.filter(item=>item.kind==='chest'&&!item.timer)];
      targets.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
      if(targets[0]) this.guide(c,targets[0],targets[0].kind==='chest' ? '宝箱' : '补给');
    }
    if (map > 0) this.portal(c, zone.back, true, MAPS[map - 1].short + ' ‹', t);
    if (map < 4) this.portal(c, zone.gate, true, MAPS[map + 1].short + ' ›', t);
    const boss = zone.boss;
    if (boss.hp > 0 && this.visible(boss, 190)) {
      this.warning(c, boss);
      const opacity = boss.attack?.skill === 'ambush' ? 0.4 : boss.invuln && Math.sin(t * 31) > 0 ? 0.62 : 1;
      const striking = boss.attack && boss.attack.age > boss.attack.windup;
      animatedSprite(c, this.rivalSprites[RIVAL.indexOf(boss.def.key)], t * (striking ? 2.1 : 0.9), {
        x: boss.x, y: boss.y + Math.sin(t * 3) * 4, width: 151 + map * 16, dir: boss.dir,
        tilt: boss.stun > 0 ? 0.24 : striking ? boss.dir * 0.35 : Math.sin(t * 3) * 0.056,
        alpha: opacity,
      });
      const opportunity = boss.recovery > 0 || boss.stun > 0;
      label(c, opportunity ? '破绽 · 猛扑' : boss.def.name, boss.x, boss.y - 80 - map * 6, opportunity ? '#a2ffdf' : '#ffd8d5');
      if (opportunity) {
        c.beginPath();
        c.arc(boss.x, boss.y, 64 + map * 8, -0.8, 0.8);
        c.lineWidth = 3;
        c.strokeStyle = '#8affc7b0';
        c.stroke();
      }
    }
    for (const h of game.hazards) this.hazard(c, h);
    if (boss.hp > 0 && Math.abs(boss.x - player.x) < 1250) {
      this.guide(c, boss, '首领领地');
    }
  }

  dream(c, game, t) {
    for (const v of game.vents) if (this.visible(v)) this.vent(c, v, t, false);
    const well = game.well;
    if (this.visible(well, 160)) {
      this.atlas(c, this.landmarks, 5, well.x, well.y + 25, 177);
      oval(c, well.x, well.y + 7, 47 + Math.sin(t * 3) * 5, 25);
      c.strokeStyle = '#a6f7ff85';
      c.lineWidth = 2;
      c.stroke();
      label(c, '月光井', well.x, well.y - 57, '#fff0c6', 17);
    }
    for (const j of game.jellies) {
      if (this.visible(j)) this.fish(c, 'jelly', { ...j, y: j.y + Math.sin(t * 2 + j.x) * 5, dir: 1 }, 69, j.cooldown ? 0.5 : 0.95, t);
    }
    let previous = game.player;
    for (const d of game.chain) {
      line(c, d.color + '60', 1.4, [previous.x, previous.y, d.x, d.y]);
      previous = d;
    }
    for (const list of [game.dreams, game.chain]) {
      for (const d of list) {
        if (!this.visible(d)) continue;
        const r = d.gold ? 17 : 13;
        circle(c, d.x, d.y, r);
        c.fillStyle = d.color + '27';
        c.fill();
        this.fish(c, d.gold ? 'lantern' : 'fry', d, r * 2.1, 1, t);
      }
    }
    for (const n of game.nightmares) {
      if (!this.visible(n)) continue;
      this.fish(c, 'nightmare', n, n.size * 71, 1 - n.calm * 0.57, t);
      if (n.calm > 0.05) {
        c.beginPath();
        c.arc(n.x, n.y, n.size * 27, -Math.PI / 2, -Math.PI / 2 + TAU * n.calm);
        c.lineWidth = 2;
        c.strokeStyle = '#adf3ff';
        c.stroke();
      }
    }
    this.guide(c, well, '月光井');
  }

  guide(c, target, text) {
    const left = this.x + 65;
    const right = this.x + this.viewW - 65;
    const top = this.y + 115;
    const bottom = this.y + this.viewH - 62;
    const x = clamp(target.x, left, right);
    const y = clamp(target.y, top, bottom);
    if (Math.abs(x - target.x) < 22 && Math.abs(y - target.y) < 22) return;
    const arrow = target.x < left ? '‹ ' : target.x > right ? ' ›' : target.y < top ? '↑ ' : '↓ ';
    label(c, target.x > right ? text + arrow : arrow + text, x, y, '#ffe5b6', 14);
  }

  vent(c, p, t, hot) {
    const count = hot ? 18 : 9;
    for (let i = 0; i < count; i++) {
      const f = mod(i / count - t * (hot ? 0.91 : 0.5), 1);
      const x = p.x + Math.sin(i * 3.3 + f * 4) * (7 + 15 * f);
      circle(c, x, p.y - f * (hot ? 137 : 165), 2 + f * 4);
      c.strokeStyle = hot ? '#ffb37292' : '#94eaff70';
      c.lineWidth = 1.3;
      c.stroke();
    }
  }

  portal(c, p, open, text, t) {
    if (!this.visible(p)) return;
    const color = open ? '#96fff0' : '#a5a6c9';
    c.save();
    c.translate(p.x, p.y);
    for (let i = 0; i < 3; i++) {
      oval(c, 0, 0, 23 + i * 6, 46 + i * 6);
      c.fillStyle = color + (open ? '15' : '09');
      c.fill();
      c.lineWidth = i ? 1.3 : 2.3;
      c.strokeStyle = color + (open ? '86' : '45');
      c.stroke();
    }
    c.beginPath();
    c.ellipse(0, 0, 30, 52, 0, t, t + Math.PI * 1.2);
    c.strokeStyle = color;
    c.stroke();
    label(c, open ? text : '封印海门', 0, 79, color);
    c.restore();
  }

  collectible(c, item, t) {
    const { x, y, kind } = item;
    if (kind === 'current') {
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(item.dy, item.dx));
      oval(c, 0, 0, 14, 25 + Math.sin(t * 3) * 4);
      c.strokeStyle = '#b4f4ff9c';
      c.lineWidth = 2.3;
      c.stroke();
      label(c, '››', 0, 4, '#b8f9ff', 14);
      c.restore();
      return;
    }
    const [index, size] = LOOT[kind];
    this.atlas(c, this.loot, index, x, y, size);
  }

  warning(c, boss) {
    const a = boss.attack;
    if (!a) return;
    const followup = a.skill === 'dash' && a.age >= a.windup && (a.age - a.windup) % 0.62 < 0.25;
    if (a.age >= a.windup && !followup) return;
    c.save();
    c.setLineDash([11, 6]);
    c.globalAlpha = 0.6 + Math.sin(a.age * 21) * 0.25;
    if (a.skill === 'dash' || a.skill === 'plates') {
      const dx = a.dx * 690;
      const dy = a.dy * 690;
      line(c, '#ff7f8b', a.skill === 'dash' ? 15 : 3, [boss.x, boss.y, boss.x + dx, boss.y + dy]);
      c.setLineDash([]);
      for (const angle of a.skill === 'plates' ? [-0.4,0.4] : []) {
        line(c, '#ff7f8b66', 2, [boss.x, boss.y, boss.x + dx * Math.cos(angle) - dy * Math.sin(angle),
          boss.y + dx * Math.sin(angle) + dy * Math.cos(angle)]);
      }
    } else if (a.skill === 'wave') {
      circle(c, boss.x, boss.y, 52 + a.age * 58);
      c.strokeStyle = '#ffad91';
      c.lineWidth = 3;
      c.stroke();
    } else {
      c.strokeStyle = '#ff8d9e';
      c.lineWidth = 3;
      const marks = a.marks ?? [-2,-1,0,1,2].map(i => ({x:a.x + i * 111, y:a.y}));
      for (const mark of marks) {
        circle(c, mark.x, mark.y, a.skill === 'stones' ? 25 : 53);
        c.stroke();
        line(c, '#ff8d9e', 2, [mark.x - 10, mark.y, mark.x + 10, mark.y]);
      }
    }
    c.restore();
    label(c, a.title, boss.x, boss.y + 88, '#ffaeae');
  }

  hazard(c, h) {
    if (!this.visible(h, h.radius + 30)) return;
    const charging = h.age < h.delay;
    c.save();
    c.globalAlpha = charging ? 0.45 + Math.sin(h.age * 19) * 0.2 : 0.92;
    c.strokeStyle = h.color;
    c.lineWidth = 2.6;
    if (h.kind === 'stone' && charging) {
      line(c, h.color, 2, [h.x, h.y, h.x, h.targetY + 50]);
      circle(c, h.x, h.targetY, 28);
      c.stroke();
    }
    c.translate(h.x, h.y);
    if (h.kind === 'plate') {
      c.rotate(h.age * 9);
      oval(c, 0, 0, h.radius * 1.4, h.radius * 0.55);
      c.fillStyle = '#224676d9';
      c.fill();
      c.stroke();
      oval(c, 0, 0, h.radius * 0.75, h.radius * 0.28);
      c.stroke();
    } else if (h.kind === 'ambush') {
      for (const x of [-16, 0, 16]) line(c, h.color, 5, [x - 20,-38,x + 20,38]);
      circle(c, 0, 0, h.radius);
      c.lineWidth = 1;
      c.stroke();
    } else {
      circle(c, 0, 0, h.radius);
      c.stroke();
      if (h.kind === 'stone') {
        c.fillStyle = Math.sin(h.x) > 0 ? '#f3eeee' : '#282637';
        c.fill();
      } else {
        circle(c, 0, 0, Math.max(1, h.radius - 7));
        c.globalAlpha *= 0.35;
        c.stroke();
      }
    }
    c.restore();
  }

  effects(c, dive) {
    for (const e of dive.effects) {
      if (!this.visible(e)) continue;
      const f = e.age / e.duration;
      c.globalAlpha = 1 - f;
      if (e.type === 'food') {
        label(c, e.text, e.x + Math.sin(e.x) * f * 12, e.y - 20 - 35 * f, e.color, e.text.length > 6 ? 14 : 19);
      } else if (e.type === 'float') {
        const x = e.x + (e.target.x - e.x) * Math.min(1, f * 1.6);
        const y = e.y + (e.target.y - e.y) * f - 135 * f;
        circle(c, x, y, 6);
        c.fillStyle = e.color;
        c.fill();
      } else {
        const radius = 6 + (e.radius ?? 34) * f;
        c.strokeStyle = e.color;
        c.lineWidth = e.type === 'ring' ? 2 : 1.5;
        if (e.type === 'ring') {
          circle(c, e.x, e.y, radius);
          c.stroke();
        } else {
          for (let i = 0; i < 7; i++) {
            const a = i * TAU / 7 + e.x;
            circle(c, e.x + Math.cos(a) * radius, e.y + Math.sin(a) * radius, 1.8 + (1 - f) * 2.7);
            c.stroke();
          }
        }
      }
    }
    c.globalAlpha = 1;
  }
}
