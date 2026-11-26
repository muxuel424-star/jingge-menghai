const COUNTS = { fry: 8, lantern: 4, manta: 2, royal: 2 };
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
  return reef.floor ? heightAt(reef.floor, x) : 544 + Math.sin(x * 0.008) * 32 + Math.sin(x * 0.022) * 16;
}

export function roofAt(x, reef) {
  return reef.roof ? heightAt(reef.roof, x) : 51;
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
  if (x < solid.aabb.left - padding || x > solid.aabb.right + padding
    || y < solid.aabb.top - padding || y > solid.aabb.bottom + padding) return false;
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
  for (let pass = 0; pass < 5; pass++) {
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
  }
  entity.x = clamp(entity.x, padding + 2, reef.width - padding - 2);
  entity.y = clamp(entity.y, roofAt(entity.x, reef) + padding, floorAt(entity.x, reef) - padding);
  if ((reef.solids ?? []).some(solid => solidContains(solid,entity.x,entity.y,padding))) {
    const originX=entity.x;
    const originY=entity.y;
    let found=false;
    for(const distance of [8,18,36,64,100,150,220,330,480,700]) {
      for(let i=0;i<32;i++) {
        const angle=i/32*Math.PI*2;
        const x=clamp(originX+Math.cos(angle)*distance,padding+2,reef.width-padding-2);
        const y=originY+Math.sin(angle)*distance;
        if(y<roofAt(x,reef)+padding||y>floorAt(x,reef)-padding) continue;
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

export function regionAt(reef, x) {
  return reef.regions?.find(region => x >= region.from && x < region.to) ?? reef.regions?.at(-1);
}

function safePoint(reef, x, y, radius = 84) {
  const point = resolveTerrain({ x, y }, radius, reef);
  return [Math.round(point.x), Math.round(point.y)];
}

function population(reef, map) {
  const shoals = [];
  // Two feeding trails divide around the reef islands and meet in broad basins.
  const bands = [0.28, 0.72];
  let index = 0;
  for (let x = 260; x < reef.width - 130; x += 146) {
    for (const [band, depth] of bands.entries()) {
      const high = roofAt(x, reef);
      const low = floorAt(x, reef);
      const y = high + (low - high) * (depth + Math.sin(index * 0.91 + map) * 0.065);
      const roll = (index * 7 + map * 3 + band) % 20;
      let kind = roll < 12 ? 'fry' : roll < 17 ? 'lantern' : roll < 19 ? 'manta' : 'royal';
      if (x < 850) kind = 'fry';
      if (map === 2 && roll >= 13) kind = 'manta';
      if (map >= 3 && roll >= 17) kind = 'royal';
      const [sx, sy] = safePoint(reef, x + band * 45, y);
      shoals.push({ x: sx, y: sy, kind, count: COUNTS[kind] });
      index++;
    }
  }
  for (const [x, y] of [[285, reef.spawn[1]], [410, reef.spawn[1] + 8], [535, reef.spawn[1] - 12]]) {
    const [sx, sy] = safePoint(reef, x, y);
    shoals.push({ x: sx, y: sy, kind: 'fry', count: 8 });
  }
  return shoals;
}

function polygon(style, structure, points) {
  const vertices = points.map(([x, y]) => ({ x, y }));
  const xs = vertices.map(p => p.x);
  const ys = vertices.map(p => p.y);
  const aabb = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  return {
    points: vertices, style, structure, aabb,
    x: (aabb.left + aabb.right) / 2, y: (aabb.top + aabb.bottom) / 2,
    rx: (aabb.right - aabb.left) / 2, ry: (aabb.bottom - aabb.top) / 2,
  };
}

function shelf(style, x, y, width, thickness, slope = 0) {
  return polygon(style, 'shelf', [[x-width/2,y-8],[x-width*0.22,y-18+slope*0.25],
    [x+width*0.3,y-5+slope*0.7],[x+width/2,y+slope],[x+width*0.42,y+thickness+slope],
    [x-width*0.36,y+thickness+8],[x-width/2,y+thickness*0.4]]);
}

function pillar(style, x, y, width, height, lean = 0) {
  return polygon(style, 'pillar', [[x-width/2,y-height/2],[x+width*0.3,y-height/2-14],
    [x+width/2+lean,y+height/2-16],[x+lean,y+height/2+8],[x-width*0.42+lean,y+height/2]]);
}

function vault(x, y) {
  return polygon('bone', 'arch', [[x-178,y+156],[x-178,y-18],[x-124,y-139],[x,y-196],
    [x+124,y-139],[x+178,y-18],[x+178,y+156],[x+129,y+156],[x+126,y-9],
    [x+91,y-104],[x,y-145],[x-91,y-104],[x-126,y-9],[x-129,y+156]]);
}

function formations(index) {
  if (index === 0) return [
    shelf('coral',670,460,340,46,-15), shelf('coral',1760,820,300,58,10),
    pillar('coral',3100,305,55,140,-15), shelf('coral',3950,1010,370,50,-12),
    shelf('coral',4650,310,310,55,15), pillar('coral',5610,680,75,225,25),
    shelf('coral',1920,605,245,40,-25), shelf('coral',5430,925,240,45,-10),
  ];
  if (index === 1) return [
    shelf('wreck',650,380,370,44,24), pillar('wreck',1660,620,47,250,35),
    shelf('wreck',2770,1100,390,45,-70), pillar('wreck',3490,416,50,310,-75),
    shelf('wreck',4440,1158,380,45,-20), pillar('wreck',5340,853,57,360,76),
    shelf('wreck',6500,515,310,42,20), shelf('wreck',3710,1130,360,50,-25),
    shelf('wreck',1850,970,275,38,15),
  ];
  if (index === 2) return [
    pillar('crystal',810,518,71,270,30), shelf('crystal',1540,1230,370,60,15),
    pillar('crystal',2370,1440,80,390,-44), shelf('crystal',3110,1440,400,50,-55),
    pillar('crystal',3990,1200,75,390,46), shelf('crystal',4730,1660,360,50,-30),
    shelf('crystal',5160,770,300,55,30), pillar('crystal',1810,620,55,230,-25),
  ];
  if (index === 3) return [
    shelf('vent',690,720,360,64,15), shelf('vent',1640,1170,320,75,-20),
    shelf('vent',2590,470,360,65,25), pillar('vent',3420,1025,95,360,-28),
    shelf('vent',4320,1230,360,65,-20), shelf('vent',5120,1110,390,70,-45),
    pillar('vent',6000,775,95,360,30), shelf('vent',6710,1230,290,65,-15),
    shelf('vent',1750,600,275,70,20),
  ];
  return [
    vault(1630,660), shelf('bone',2540,1220,360,47,-20), vault(3290,780),
    shelf('bone',4100,1180,380,47,15), vault(4940,620),
    shelf('bone',5700,900,380,46,-25), pillar('bone',730,780,66,350,0),
    shelf('bone',2630,400,330,42,15),
  ];
}

function features(index) {
  const source = [
    [
      ['kelpFlow',610,320,230,125,1,0], ['surge',1810,750,240,100,1,-0.25],
      ['kelpFlow',2910,345,210,110,-1,0.1], ['surge',3910,900,260,100,1,-0.4],
      ['kelpFlow',4880,900,230,120,1,-0.2], ['surge',6270,830,220,100,-1,-0.1],
    ],
    [
      ['fallingDebris',1460,420,32,40,0,1], ['sluice',2860,1110,16,180,0,0],
      ['fallingDebris',3660,750,34,44,0,1], ['sluice',4610,1050,16,170,0,0],
      ['fallingDebris',5970,690,32,44,0,1], ['fallingDebris',7240,400,32,42,0,1],
    ],
    [
      ['whirlpool',1020,830,130,130,1,0], ['updraft',1850,1390,90,215,0,-1],
      ['whirlpool',3050,1130,140,140,-1,0], ['updraft',4070,1410,95,210,0,-1],
      ['whirlpool',5230,1110,125,125,1,0], ['whirlpool',6220,1430,115,115,-1,0],
    ],
    [
      ['eruption',1470,1440,44,240,0,-1], ['steamJet',2620,1110,120,32,1,-0.2],
      ['eruption',4020,1530,46,270,0,-1], ['steamJet',5200,770,120,32,-1,0.1],
      ['eruption',6360,1420,44,240,0,-1], ['eruption',7530,1410,44,230,0,-1],
    ],
    [
      ['lightGate',1450,690,16,255,0,0], ['pulseLane',2480,1000,200,200,0,0],
      ['lightGate',3860,760,16,255,0,0], ['pulseLane',4920,960,210,210,0,0],
      ['lightGate',5660,650,16,255,0,0], ['pulseLane',6760,850,180,180,0,0],
    ],
  ][index];
  return source.map(([kind,x,y,rx,ry,dx,dy], i) => ({
    kind,x,y,rx,ry,dx,dy,delay:i*0.23,
  }));
}

function pickupPoints(reef, index) {
  const kinds = [
    ['heal','bait','haste','magnet'], ['magnet','shield','sonar','heal'],
    ['sonar','haste','magnet','bait'], ['shield','heal','haste','sonar'],
    ['sonar','shield','bait','magnet'],
  ][index];
  return Array.from({length:16}, (_, i) => {
    const x = 500 + i * (reef.width - 1020) / 15;
    const high = roofAt(x, reef);
    const low = floorAt(x, reef);
    const y = i === 0 ? reef.spawn[1] : high + (low - high) * (i % 2 ? 0.77 : 0.22);
    const [sx,sy] = safePoint(reef,x,y,52);
    return {kind:kinds[i % kinds.length],x:sx,y:sy};
  });
}

function route(profile, index) {
  const reef = {
    ...profile,
    bounds: Math.max(...profile.floor.map(([, y]) => y)) + 70,
    regions: profile.regions.map(([from, to, name, detail]) => ({ from, to, name, detail })),
  };
  reef.solids = [...profile.solids, ...formations(index)];
  reef.features = features(index).map(feature => {
    const [x,y] = safePoint(reef,feature.x,feature.y,36);
    return {...feature,x,y};
  });
  reef.pickups = pickupPoints(reef,index);
  reef.shoals = population(reef, index);
  reef.currents = profile.currents.map(([x, y, dx, dy]) => {
    const [sx, sy] = safePoint(reef, x, y, 36);
    const length = Math.hypot(dx, dy);
    return [sx, sy, dx / length, dy / length];
  });
  reef.predators = profile.predators.map(([x, y, kind], order) => {
    const [sx, sy] = safePoint(reef, x, y, 58);
    return { x: sx, y: sy, kind: index >= 2 && order % 3 === 2 ? 'abyss' : kind };
  });
  return reef;
}

export const REEFS = [
  route({
    mist: '#368f70', ground: '#183c3a', light: '#87efd0', foam: '#c1ffec',
    width: 7200, spawn: [190, 297], back: [82, 297], gate: [7080, 490], boss: [6270, 570],
    roof: [[0,65],[650,55],[1100,100],[1600,180],[2050,98],[2450,65],[3000,190],[3550,170],[4050,70],[4520,90],[5000,190],[5500,175],[5950,100],[7200,105]],
    floor: [[0,620],[650,630],[1100,920],[1600,1070],[2050,950],[2450,730],[3000,820],[3550,1100],[4050,1170],[4520,1130],[5000,1220],[5500,1060],[5950,1040],[7200,1060]],
    regions: [
      [0,1600,'海葵花园','珊瑚浅台上聚集着小荧鱼。'],
      [1600,3350,'翡翠双流','从巨礁上方穿行，或下潜到海草回廊。'],
      [3350,5400,'沉珠裂谷','沿裂谷觅食，海床边藏着珍珠贝。'],
      [5400,7200,'珊瑚王庭','开阔猎场中，Grok 正在巡游。'],
    ],
    solids: [
      {x:1390,y:534,rx:310,ry:105,style:'coral'},
      {x:2290,y:405,rx:330,ry:100,style:'coral'},
      {x:2830,y:555,rx:220,ry:85,style:'coral'},
      {x:3670,y:526,rx:480,ry:115,style:'coral'},
      {x:4370,y:780,rx:260,ry:155,style:'coral'},
      {x:5140,y:508,rx:370,ry:125,style:'coral'},
    ],
    kelp: [425,910,1630,2130,2890,3380,3920,4690,5220], jets: [1190,3470,4770],
    ledges: [[780,690,310],[2000,860,370],[3560,920,450],[4900,1030,390],[6250,925,420]],
    decorations: [
      {x:940,y:760,width:350,kind:'coral'},{x:2270,y:350,width:475,kind:'coral'},
      {x:3660,y:492,width:620,kind:'coral'},{x:4320,y:895,width:410,kind:'coral'},
      {x:5180,y:460,width:530,kind:'coral'},{x:6370,y:940,width:620,kind:'coral'},
    ],
    clams: [330,700,1090,1450,1850,2330,2810,3210,3710,4080,4520,4950,5310,5770,6310,6760],
    crystals: [540,980,1680,2160,2670,3060,3520,3970,4430,4890,5470,5900,6590],
    chests: [1540,3130,4230,5200,6870], urchins: [1130,1830,2670,3960,4590,5240,6730],
    currents: [[610,310,1,0.2],[1190,750,1,0.4],[1860,770,1,-0.4],[2540,260,1,0.2],[3080,540,1,0.45],
      [3620,860,1,0.12],[4210,1010,1,-0.3],[4770,930,1,-0.65],[5410,770,1,-0.4],[5860,460,1,0],[6740,470,1,0]],
    predators: [[1040,340,'lantern'],[1880,540,'manta'],[3200,370,'lantern'],[4120,565,'royal'],[4970,750,'manta'],[5700,680,'royal']],
    salary: [3220,800], flavor: '吃掉成群的小荧鱼，在珊瑚双流之间自由觅食。',
  }, 0),
  route({
    mist: '#3e608c', ground: '#252f55', light: '#9dc9ff', foam: '#cbe4ff',
    width: 8100, spawn: [160,360], back: [82,360], gate: [7980,625], boss: [7180,740],
    roof: [[0,95],[500,100],[980,195],[1450,290],[2040,340],[2460,195],[3000,135],[3490,220],[3970,455],[4350,420],[4820,230],[5280,160],[5800,220],[6350,260],[6780,155],[8100,155]],
    floor: [[0,910],[500,930],[980,1000],[1450,1050],[2040,1240],[2460,1400],[3000,1450],[3490,1380],[3970,1290],[4350,1390],[4820,1240],[5280,1090],[5800,1210],[6350,1310],[6780,1300],[8100,1320]],
    regions: [
      [0,1850,'断桥渡口','从半塌的码头潜入古渡。'],
      [1850,3800,'千帆墓场','上下两条水道绕过巨大的沉船残骸。'],
      [3800,5900,'瓷窑暗沟','沿窄口潜入沉宝深沟。'],
      [5900,8100,'旗舰航道','千问的飞盘能封锁整条航线。'],
    ],
    solids: [
      {x:1250,y:600,rx:420,ry:115,style:'wreck'},
      {x:2290,y:780,rx:520,ry:150,style:'wreck'},
      {x:3130,y:640,rx:290,ry:155,style:'wreck'},
      {x:4020,y:850,rx:300,ry:120,style:'wreck'},
      {x:4800,y:790,rx:310,ry:170,style:'wreck'},
      {x:5660,y:540,rx:420,ry:120,style:'wreck'},
      {x:6190,y:960,rx:340,ry:130,style:'wreck'},
    ],
    kelp: [690,1820,2680,3640,4540,5140,6510], jets: [2900,4550],
    ledges: [[720,760,420],[2370,1100,650],[3430,1150,510],[4920,1050,440],[6080,1100,450],[7270,1170,670]],
    decorations: [
      {x:1250,y:560,width:630,kind:'wreck'},{x:2310,y:730,width:730,kind:'wreck'},
      {x:3130,y:600,width:510,kind:'wreck'},{x:3990,y:800,width:570,kind:'wreck'},
      {x:4810,y:730,width:560,kind:'wreck'},{x:5670,y:490,width:660,kind:'wreck'},
      {x:6220,y:920,width:540,kind:'wreck'},{x:7310,y:1170,width:780,kind:'wreck'},
    ],
    clams: [370,810,1280,1710,2140,2650,3160,3680,4080,4590,5020,5510,6000,6480,6910,7480,7790],
    crystals: [540,1090,1570,2020,2870,3390,3910,4470,4870,5340,5860,6570,7040,7630],
    chests: [690,1640,2470,2990,3740,4270,4940,5700,6470,7760],
    urchins: [1400,1920,2790,3570,4370,5250,6070,6680,7600],
    currents: [[620,380,1,0.2],[1530,430,1,0.32],[2110,1100,1,0.25],[2930,1210,1,-0.2],
      [3520,1010,1,-0.2],[4160,610,1,0.1],[4630,1080,1,-0.3],[5300,810,1,-0.6],
      [6030,780,1,0.3],[6590,1000,1,-0.4],[7670,640,1,0]],
    predators: [[1100,430,'lantern'],[2060,1060,'manta'],[3330,1090,'royal'],[4430,690,'manta'],[5430,810,'royal'],[6590,630,'royal']],
    salary: [3040,1190], flavor: '穿过船腹和断桅，深沟中的宝箱可以补充珍珠。',
  }, 1),
  route({
    mist: '#654095', ground: '#322753', light: '#d1a7ff', foam: '#f0c4ff',
    width: 6900, spawn: [155,290], back: [82,290], gate: [6780,1040], boss: [6080,1130],
    roof: [[0,60],[550,65],[950,180],[1450,350],[1950,480],[2400,540],[2800,310],[3220,275],[3650,450],[4090,750],[4450,820],[4850,650],[5310,630],[5650,565],[6900,570]],
    floor: [[0,760],[550,800],[950,1120],[1450,1460],[1950,1740],[2400,1840],[2800,1810],[3220,1720],[3650,1780],[4090,1840],[4450,1800],[4850,1750],[5310,1700],[5650,1700],[6900,1730]],
    regions: [
      [0,1450,'新月迎宾台','顺着发光水母群进入紫海。'],
      [1450,3200,'垂丝深井','上下两层猎场由深井相通。'],
      [3200,5200,'紫晶迷窟','晶柱之间有狭道，洋流能帮你绕行。'],
      [5200,6900,'双月猎场','Gemini 会在水母群后突然扑出。'],
    ],
    solids: [
      {x:1210,y:680,rx:280,ry:145,style:'crystal'},
      {x:2020,y:980,rx:420,ry:155,style:'crystal'},
      {x:2780,y:1000,rx:225,ry:330,style:'crystal'},
      {x:3550,y:1035,rx:420,ry:160,style:'crystal'},
      {x:4510,y:1280,rx:330,ry:145,style:'crystal'},
      {x:5010,y:1030,rx:260,ry:125,style:'crystal'},
    ],
    kelp: [470,1510,2380,3140,4060,4980], jets: [1820,3860],
    ledges: [[700,700,420],[1950,1580,610],[2810,1600,400],[3870,1560,570],[4980,1550,540],[6090,1570,700]],
    decorations: [
      {x:1200,y:630,width:460,kind:'crystal'},{x:2000,y:930,width:620,kind:'crystal'},
      {x:2780,y:970,width:620,kind:'crystal'},{x:3540,y:995,width:650,kind:'crystal'},
      {x:4510,y:1230,width:520,kind:'crystal'},{x:5020,y:990,width:500,kind:'crystal'},
      {x:6120,y:1510,width:650,kind:'crystal'},
    ],
    clams: [360,800,1290,1750,2260,2670,3140,3560,3980,4450,4920,5350,5720,6240,6590],
    crystals: [520,1090,1590,2020,2460,2920,3360,3790,4220,4690,5180,5560,6420],
    chests: [980,1880,2600,3410,4630,5370,6570], urchins: [1390,2270,3070,3750,4770,5400,6580],
    currents: [[640,390,1,0.4],[1260,1060,1,0.65],[1730,1400,1,0.55],[2420,1620,1,-0.2],
      [2940,1460,1,-0.65],[3590,730,1,0.35],[4010,1250,1,0.25],[4500,1570,1,-0.3],
      [5090,1410,1,-0.4],[5510,1100,1,0],[6490,1050,1,0]],
    jellies: [[520,270],[1030,410],[1480,780],[1830,1210],[2310,1450],[2640,1400],[3110,1200],[3540,760],[3990,1280],[4460,1510],[4980,1320],[5540,1150],[6300,900]],
    predators: [[1180,430,'manta'],[1740,1290,'royal'],[2680,1480,'manta'],[3640,770,'royal'],[4330,1160,'manta'],[5310,1370,'royal']],
    salary: [2480,1580], flavor: '继续下潜，在水母群和晶柱之间寻找更大的猎物。',
  }, 2),
  route({
    mist: '#963b38', ground: '#482933', light: '#ffaa74', foam: '#ffe3b0',
    width: 8400, spawn: [160,400], back: [82,400], gate: [8280,745], boss: [7440,835],
    roof: [[0,90],[700,100],[1120,250],[1580,385],[2150,300],[2640,210],[3110,340],[3600,460],[4090,430],[4540,290],[5020,290],[5480,470],[5970,500],[6430,360],[6930,300],[8400,300]],
    floor: [[0,990],[700,1040],[1120,1230],[1580,1490],[2150,1500],[2640,1390],[3110,1270],[3600,1500],[4090,1600],[4540,1440],[5020,1340],[5480,1560],[5970,1600],[6430,1510],[6930,1460],[8400,1490]],
    regions: [
      [0,1800,'玄武热泉阶','利用热泉抬升，绕开底部熔岩。'],
      [1800,3950,'断层熔沟','玄武岩岛把水流分成上下两层。'],
      [3950,6200,'黑曜火窟','明亮裂缝下藏着高阶猎物与危险。'],
      [6200,8400,'天元星盘','智谱会提前封住你的游动路线。'],
    ],
    solids: [
      {x:1130,y:730,rx:350,ry:120,style:'vent'},
      {x:2170,y:870,rx:430,ry:135,style:'vent'},
      {x:3060,y:870,rx:250,ry:220,style:'vent'},
      {x:3890,y:920,rx:410,ry:130,style:'vent'},
      {x:4830,y:760,rx:310,ry:110,style:'vent'},
      {x:5500,y:1030,rx:280,ry:210,style:'vent'},
      {x:6350,y:950,rx:330,ry:135,style:'vent'},
    ],
    kelp: [], jets: [550,1030,1480,1980,2440,2910,3380,3770,4280,4740,5260,5730,6150,6640,7990],
    lava: [[1010,1670],[2230,2650],[3470,4330],[5190,5890],[6370,6730]],
    ledges: [[710,820,430],[2050,1290,560],[3530,1290,530],[4810,1180,480],[6040,1390,520],[7500,1300,720]],
    decorations: [
      {x:1120,y:690,width:550,kind:'vent'},{x:2170,y:830,width:650,kind:'vent'},
      {x:3060,y:820,width:540,kind:'vent'},{x:3900,y:880,width:600,kind:'vent'},
      {x:4830,y:710,width:510,kind:'vent'},{x:5500,y:990,width:540,kind:'vent'},
      {x:6360,y:900,width:590,kind:'vent'},{x:7480,y:1280,width:720,kind:'vent'},
    ],
    clams: [340,840,1380,1770,2260,2740,3180,3630,4100,4560,5010,5440,5870,6330,6830,7380,7860],
    crystals: [480,990,1560,2010,2580,3040,3500,3970,4420,4870,5360,5790,6280,6710,7650,8060],
    chests: [910,1740,2790,3800,4650,5900,6720,8010], urchins: [1210,1880,2710,3370,4620,5070,5910,6800,7900],
    currents: [[650,460,1,0.18],[1360,970,1,0.42],[1990,1190,1,0],[2650,1130,1,-0.55],[3230,610,1,0.22],
      [3880,1280,1,0.2],[4510,1030,1,-0.5],[5120,620,1,0.6],[5700,1360,1,-0.2],[6330,1260,1,-0.7],
      [6850,760,1,0],[8000,750,1,0]],
    predators: [[1120,460,'royal'],[1810,1210,'manta'],[2850,700,'royal'],[3670,1240,'royal'],[4640,1000,'manta'],[5930,1250,'royal'],[6640,770,'royal']],
    salary: [4270,1250], flavor: '绕行玄武岩岛，借热泉跃升到安全水道。',
  }, 3),
  route({
    mist: '#8c763e', ground: '#323d41', light: '#fee0a0', foam: '#fff5cd',
    width: 7600, spawn: [160,600], back: [82,600], gate: [7480,510], boss: [6720,620],
    roof: [[0,230],[600,235],[1120,195],[1630,125],[2100,85],[2540,140],[3030,220],[3500,280],[4020,310],[4450,210],[4930,120],[5400,100],[5900,130],[7600,105]],
    floor: [[0,1220],[600,1240],[1120,1200],[1630,1130],[2100,1240],[2540,1430],[3030,1510],[3500,1480],[4020,1420],[4450,1330],[4930,1210],[5400,1190],[5900,1160],[7600,1190]],
    regions: [
      [0,1750,'断骨城门','沿鲸骨拱廊进入古城。'],
      [1750,3650,'沉没钟楼','上层廊桥和下层密室各有猎物。'],
      [3650,5600,'万鲸回廊','绕过肋骨岛，向圣堂上浮。'],
      [5600,7600,'黄金圣堂','女仆长在宽阔圣堂等待最终考核。'],
    ],
    solids: [
      {x:1180,y:680,rx:350,ry:105,style:'bone'},
      {x:2180,y:540,rx:410,ry:115,style:'bone'},
      {x:2870,y:970,rx:300,ry:190,style:'bone'},
      {x:3660,y:800,rx:450,ry:120,style:'bone'},
      {x:4520,y:800,rx:260,ry:220,style:'bone'},
      {x:5240,y:520,rx:300,ry:110,style:'bone'},
    ],
    kelp: [], jets: [1660,3330,4780],
    ledges: [[680,1040,430],[2160,1070,600],[3310,1290,500],[4560,1160,500],[5350,1030,490],[6750,1060,850]],
    decorations: [
      {x:1170,y:640,width:540,kind:'bone'},{x:2170,y:500,width:650,kind:'bone'},
      {x:2870,y:930,width:580,kind:'bone'},{x:3650,y:760,width:660,kind:'bone'},
      {x:4520,y:760,width:580,kind:'bone'},{x:5230,y:480,width:560,kind:'bone'},
      {x:6650,y:1040,width:850,kind:'bone'},
    ],
    clams: [330,780,1260,1760,2250,2690,3150,3570,4060,4490,4960,5380,5810,6270,6820,7190],
    crystals: [520,1050,1570,2070,2530,2980,3430,3910,4390,4840,5300,5730,6180,7080],
    chests: [880,1860,2790,3420,4200,5080,5770,7250], urchins: [1450,2350,3090,3980,4860,5460,7230],
    currents: [[630,630,1,-0.1],[1410,420,1,-0.35],[2100,1050,1,0.15],[2810,1230,1,0],
      [3470,1150,1,-0.45],[4090,1020,1,-0.3],[4730,480,1,-0.15],[5410,760,1,-0.4],[5890,560,1,0],[7190,520,1,0]],
    predators: [[1070,420,'royal'],[1880,870,'manta'],[3050,1240,'royal'],[3880,1150,'royal'],[4820,460,'manta'],[5530,700,'royal']],
    salary: [3340,1180], flavor: '穿过钟楼和鲸骨回廊，向开阔圣堂进发。',
  }, 4),
];

export const DREAM_REEF = {
  width: 1880,
  bounds: 652,
  mist: '#247c91',
  ground: '#153349',
  light: '#76bdeb',
  foam: '#acecff',
  kelp: [665, 968, 1283],
};
