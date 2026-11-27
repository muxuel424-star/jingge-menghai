import { SEA } from '../palette.js';
// Layouts are authored in the five level files, never randomized.
// 05's six surface beats total 450s; 02's 360s rift fallback wins at runtime.
// Timings describe content goals; swimming is never artificially held behind a timer.
// 08 places melody at D1 end / D2 gate / D3 front, overriding 05's conflicting numbering.
import { TUNING } from '../tuning.js';
const point = ([x, y]) => ({ x, y });
// Three authored coastlines: shelves, eroded notches and broken lower faces.
// Every vertex lies inside the unit disk, so converting an old ellipse only
// removes rock; it can never expand into an authored swimming route.
const COASTLINES = [
  [[-.25,-.87],[.1,-.94],[.39,-.78],[.57,-.66],[.49,-.48],[.78,-.38],[.94,-.06],[.78,.12],[.86,.38],[.57,.65],[.36,.69],[.1,.91],[-.25,.84],[-.55,.71],[-.67,.42],[-.88,.33],[-.96,-.04],[-.82,-.26],[-.72,-.28],[-.65,-.55],[-.38,-.74]],
  [[-.06,-.93],[.23,-.83],[.44,-.81],[.7,-.56],[.65,-.3],[.92,-.12],[.84,.13],[.9,.34],[.67,.5],[.47,.73],[.25,.69],[.04,.91],[-.2,.91],[-.39,.71],[-.63,.65],[-.77,.41],[-.73,.17],[-.94,-.08],[-.77,-.37],[-.51,-.66],[-.27,-.7]],
  [[-.15,-.92],[.18,-.94],[.39,-.75],[.6,-.62],[.82,-.43],[.76,-.21],[.94,.03],[.81,.27],[.75,.49],[.52,.61],[.28,.85],[-.02,.94],[-.27,.79],[-.53,.77],[-.62,.49],[-.85,.34],[-.91,.02],[-.78,-.16],[-.83,-.29],[-.65,-.44],[-.42,-.68]],
];
export const ellipse = (x, y, rx, ry, kind = 'solid') => {
  const profile = Math.abs(Math.round(x / 37) + Math.round(y / 29) * 3 + Math.round(rx / 19) * 7 + Math.round(ry / 17) * 11) % COASTLINES.length;
  return { x, y, rx, ry, kind, shape: 'polygon', coastline: profile, points: COASTLINES[profile].map(([u,v]) => ({ x: x + u * rx, y: y + v * ry })) };
};
export const polygon = (points, kind = 'solid') => ({ points: points.map(point), kind, shape: 'polygon' });
export const hazard = (kind, x, y, w, h, period = 5) => ({ kind, x, y, w, h, period });

function schools(from, to, count, y, kind = 'fry') {
  const groups = kind === 'fry' ? Math.ceil(count / 14) : Math.ceil(count / 4);
  const groupSize = kind === 'fry' ? 14 : 4;
  return Array.from({ length: groups }, (_, i) => ({
    kind, count: Math.min(groupSize, count - i * groupSize),
    x: from + (to - from) * (i + 0.5) / groups,
    y: y + [0, -180, 160, -90, 210, -140, 80][i % 7], radius: kind === 'fry' ? 90 : 120,
  }));
}

const surfaceDurations = [90, 75, 75, 75, 75, 60];
const surfaceIntents = ['teach', 'teach', 'flow', 'story', 'press', 'gate'];
const defaultTeach = ['collect', 'song', 'current', 'fragment', 'chain', 'rift'];
const surfaceSupplies = ['lamp', 'heal', 'haste', 'smoke', 'sonar', 'heal', 'bait'];
const deepSupplies = ['bait', 'magnet', 'heal', 'haste', 'lamp', 'heal', 'shield'];

function onPath(path, x) {
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    if (x < ax || x > bx || bx === ax) continue;
    return { x, y: ay + (by - ay) * (x - ax) / (bx - ax) };
  }
  return point(path.at(-1));
}

function supplies(width, keys, offset, path) {
  return keys.map((key, i) => ({ key, supply: true, bossSupply: offset === 'deep' && i === keys.length - 1, id: `${offset}-supply-${i}`, ...onPath(path, 400 + (width - 800) * i / (keys.length - 1)) }));
}

function blocksAnchor(solid, anchor, radius) {
  if (!solid.points) return Math.hypot((anchor.x - solid.x) / (solid.rx + radius), (anchor.y - solid.y) / (solid.ry + radius)) < 1;
  let inside = false, nearest = Infinity;
  for (let i = 0, j = solid.points.length - 1; i < solid.points.length; j = i++) {
    const a = solid.points[j], b = solid.points[i];
    if ((a.y > anchor.y) !== (b.y > anchor.y) && anchor.x < (b.x - a.x) * (anchor.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x, dy = b.y - a.y;
    const fraction = Math.max(0, Math.min(1, ((anchor.x - a.x) * dx + (anchor.y - a.y) * dy) / (dx * dx + dy * dy)));
    nearest = Math.min(nearest, Math.hypot(anchor.x - a.x - fraction * dx, anchor.y - a.y - fraction * dy));
  }
  return inside || nearest < radius;
}

function branchAnchor(authored, path, solids) {
  const route = onPath(path, authored.x), side = authored.y >= route.y ? 1 : -1;
  const radius = TUNING.player.radius * TUNING.tiers.at(-1).size;
  // These are fixed side-route offsets, not generated terrain. Keep the two authored x anchors.
  for (const offset of [180, 140, 100, 70, 60]) {
    for (const direction of [side, -side]) {
      const candidate = { x: route.x, y: route.y + offset * direction };
      if (candidate.y < 50 + radius || candidate.y > 1750 - radius) continue;
      if (!solids.some(solid => blocksAnchor(solid, candidate, radius))) return candidate;
    }
  }
  return route;
}

function layerShortcuts(shortcuts, path, solids) {
  return shortcuts.map(shortcut => ({ ...shortcut, from: branchAnchor(shortcut.from, path, solids), to: branchAnchor(shortcut.to, path, solids) }));
}

function shortcutLatch(shortcuts, path) {
  const clearance = shortcut => Math.min(...path.slice(1).map((b, index) => {
    const a = path[index], dx = b[0] - a[0], dy = b[1] - a[1], p = shortcut.from;
    const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / Math.max(1, dx * dx + dy * dy)));
    return Math.hypot(p.x - a[0] - dx * t, p.y - a[1] - dy * t);
  }));
  const entrance = [...shortcuts].sort((a, b) => clearance(b) - clearance(a))[0];
  return [{ id: 'shortcut-latch', key: 'fragile', shape: 'ellipse', ...entrance.from,
    w: TUNING.terrain.fragileWidth, h: TUNING.terrain.fragileHeight,
    rx: TUNING.terrain.fragileWidth / 2, ry: TUNING.terrain.fragileHeight / 2, hp: TUNING.terrain.fragileHits, maxHp: TUNING.terrain.fragileHits }];
}

/** @returns {import('../schema.js').Level} */
export function defineLevel(spec) {
  const { level, width, surfaceRanges: ranges } = spec;
  const surfaceBeats = ranges.slice(0, -1).map((from, i) => {
    const to = ranges[i + 1];
    const nightmares = spec.nightmares[i];
    const spawns = [...schools(from + 140, to - 140, 22, spec.routeY[i], 'dreamfish')];
    if (nightmares) spawns.push({ kind: 'nightmare', count: nightmares, x: (from + to) / 2, y: spec.routeY[i] - 140, radius: 220 });
    if (level >= 3 && (i === 2 || i === 4)) spawns.push({ kind: 'tapir', count: 1, x: to - 240, y: spec.routeY[i] + 80, radius: 90 });
    if (level <= 2 && i === 2) spawns.push({ kind: 'guard', count: 2, x: from + 330, y: spec.routeY[i] + 230, radius: 120 });
    if (level >= 2 && i === 0) spawns.push({ kind: 'jelly', count: 4, x: to - 450, y: spec.routeY[i] + 190, radius: 150 });
    return { key: `B${i + 1}`, from, to, nameKey: `level.${level}.B${i + 1}`, intent: surfaceIntents[i], duration: surfaceDurations[i], targetSeconds: surfaceDurations[i], teachKey: `teach.${spec.teach?.[i] ?? defaultTeach[i]}`, camera: spec.verticalSurface?.includes(i) ? 'vertical' : 'horizontal', spawns, hazards: spec.surfaceHazards.filter(h => h.x >= from && h.x < to).map(h => h.kind), landmark: spec.motifs[i] };
  });
  const cuts = spec.deepRanges ?? [0, Math.round(width * 0.38), Math.round(width * 0.74), width];
  const deepBeats = cuts.slice(0, -1).map((from, i) => {
    const to = cuts[i + 1];
    // Tier-2 doors in L3/L5 require enough reachable food on this side of the door.
    const foodEnd = i === 1 ? Math.min(to - 140, spec.gates[0].x - 160) : to - 140;
    const spawns = schools(from + 140, foodEnd, [98, 84, 42][i], spec.deepY[i]);
    spawns.push({ kind: 'crystal', count: [8, 8, 6][i], x: (from + to) / 2, y: spec.deepY[i] - 180, radius: 240 });
    if (i > 0) spawns.push(...schools(from + 180, foodEnd, i === 1 ? 12 : 5, spec.deepY[i] + 100, 'lantern'));
    if (i > 0) spawns.push({ kind: 'chest', count: 4, x: i === 1 ? foodEnd - 90 : to - 350, y: spec.deepY[i] + 190, radius: 180 });
    if (i === 2) spawns.push({ kind: 'royal', count: 2, x: to - 500, y: spec.deepY[i] - 70, radius: 160 });
    if (level >= 2 && i === 2) spawns.push({ kind: 'manta', count: 3, x: from + 500, y: spec.deepY[i], radius: 190 });
    if (level >= 3 && i === 2) spawns.push({ kind: 'abyss', count: 1, x: from + 350, y: spec.deepY[i] + 280, radius: 0 });
    return { key: `D${i + 1}`, from, to, nameKey: `level.${level}.D${i + 1}`, intent: ['teach', 'gate', 'gate'][i], duration: [90, 120, 90][i], targetSeconds: [90, 120, 90][i], teachKey: `teach.${i === 0 ? (level === 4 ? 'stop' : 'grow') : i === 1 ? 'gate' : 'melody'}`, camera: spec.verticalDeep?.includes(i) ? 'vertical' : 'horizontal', spawns, hazards: spec.deepHazards.filter(h => h.x >= from && h.x < to).map(h => h.kind), landmark: spec.deepMotifs[i] };
  });
  // Spawn emitters follow the authored path through shafts rather than cutting through walls.
  for (const beat of surfaceBeats) beat.spawns = beat.spawns.map(spawn => ({ ...spawn, y: onPath(spec.surfacePath, spawn.x).y }));
  for (const beat of deepBeats) beat.spawns = beat.spawns.map(spawn => ({ ...spawn, y: onPath(spec.deepPath, spawn.x).y }));
  const fragments = spec.fragmentPoints.map(([x, y, condition], id) => ({ id, x, y, r: 35, textKey: `level.${level}.fragment.${id}`, condition: condition ?? null, hidden: id === 2 }));
  const melodies = [
    { id: 0, ...onPath(spec.deepPath, cuts[1] - 170), requiresTier: 0 },
    { id: 1, ...onPath(spec.deepPath, spec.gates[0].x + 180), requiresTier: spec.gates[0].tier },
    { id: 2, ...onPath(spec.deepPath, width - 360), requiresTier: 2 },
  ];
  const common = { width, height: spec.height ?? 1800, theme: spec.key, floor: [[0, 1750], [width, 1750]], roof: [[0, 50], [width, 50]] };
  const surface = {
    ...common, layer: 'surface', targetSeconds: 345, fallbackSeconds: 360,
    spawn: { x: 140, y: spec.routeY[0] }, well: { x: spec.wellX, y: spec.routeY[0], r: 55 },
    exit: { x: width - 150, y: spec.routeY[5], r: 70 }, beats: surfaceBeats,
    solids: spec.surfaceSolids, hazards: spec.surfaceHazards, mainPath: spec.surfacePath.map(point),
    fragments, spawns: surfaceBeats.flatMap(beat => beat.spawns),
    pickups: supplies(width, surfaceSupplies, 'surface', spec.surfacePath), shortcuts: layerShortcuts(spec.shortcuts, spec.surfacePath, spec.surfaceSolids),
    souvenir: { id: level, key: spec.souvenir, x: spec.souvenirPoint[0], y: spec.souvenirPoint[1], hidden: true },
    landmarks: spec.motifs.map((kind, i) => ({ kind, x: (ranges[i] + ranges[i + 1]) / 2, y: spec.routeY[i], warm: i === 3 })),
  };
  const deep = {
    ...common, layer: 'deep', targetSeconds: 300, fallbackSeconds: 420,
    spawn: { x: 140, y: spec.deepY[0] }, exit: { x: width - 150, y: spec.deepY[2], r: 90 },
    beats: deepBeats, solids: spec.deepSolids, hazards: spec.deepHazards,
    mainPath: spec.deepPath.map(point),
    // Gate rectangles use top-left coordinates; authored anchors remain cx/cy for instruments/art.
    gates: spec.gates.map(gate => ({ ...gate, cx: gate.x, cy: gate.y, x: gate.x - gate.w / 2, y: gate.y - gate.h / 2 })),
    melodies, fragments: [],
    pickups: supplies(width, deepSupplies, 'deep', spec.deepPath), spawns: deepBeats.flatMap(beat => beat.spawns),
    shortcuts: layerShortcuts(spec.shortcuts, spec.deepPath, spec.deepSolids), landmarks: spec.deepMotifs.map((kind, i) => ({ kind, x: (cuts[i] + cuts[i + 1]) / 2, y: spec.deepY[i] })),
    loop: spec.loop ?? null, instruments: [],
  };
  surface.breakables = shortcutLatch(surface.shortcuts, spec.surfacePath);
  deep.breakables = shortcutLatch(deep.shortcuts, spec.deepPath);
  return { key: spec.key, level, pressure: level, nameKey: `level.${level}.name`, client: { nameKey: `level.${level}.client`, lineKey: `level.${level}.line`, summaryKey: `level.${level}.summary` }, palette: SEA[level - 1], boss: spec.boss, surface, deep, surfaceBeats, deepBeats, fragments, targetSeconds: 900 };
}
