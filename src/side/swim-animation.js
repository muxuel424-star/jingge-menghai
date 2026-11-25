const TAU = Math.PI * 2;
const FRAMES = 16;
const DIVER_WIDTH = 375;
const COLS = 10;
const ROWS = 7;
const smooth = n => {
  const f = Math.max(0, Math.min(1, n));
  return f * f * (3 - 2 * f);
};

function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function cell(image, index, columns, rows) {
  const width = image.width / columns;
  const height = image.height / rows;
  const canvas = surface(width, height);
  canvas.getContext('2d').drawImage(image, index % columns * width, Math.floor(index / columns) * height,
    width, height, 0, 0, width, height);
  return canvas;
}

function rescale(image, width) {
  const canvas = surface(width, Math.round(image.height / image.width * width));
  const c = canvas.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function joints(source, phase, power, kind, left, top) {
  return Array.from({ length: ROWS + 1 }, (_, row) => Array.from({ length: COLS + 1 }, (_, col) => {
    const u = col / COLS;
    const v = row / ROWS;
    const trailing = smooth((0.72 - u) / 0.68);
    const back = smooth((0.53 - u) / 0.5);
    const tail = back * Math.exp(-Math.pow((v - 0.70) / 0.31, 2));
    const hair = trailing * Math.exp(-Math.pow((v - 0.31) / 0.25, 2));
    const hem = smooth((v - 0.5) / 0.4) * Math.sin(u * Math.PI) ** 2 * trailing;
    const stroke = Math.sin(phase - u * 3.5);
    const wake = Math.sin(phase * 2 - u * 5.3 + v * 3.8);
    const skirt = Math.sin(phase + u * 3.6 + v * 2.7);
    const rival = kind === 'rival';
    const body = rival ? Math.sin(phase - v * 3.2) * smooth((v - 0.31) / 0.69) : 0;

    return {
      sx: u * source.width,
      sy: v * source.height,
      x: left + source.width * (u + power * (tail * stroke * 0.049 + hair * wake * 0.012 + body * 0.054)),
      y: top + source.height * (v + power * (tail * stroke * 0.27 + hair * wake * 0.093 + hem * skirt * 0.096)),
    };
  }));
}

function triangle(c, image, p, q, r) {
  const centerX = (p.x + q.x + r.x) / 3;
  const centerY = (p.y + q.y + r.y) / 3;
  c.save();
  c.beginPath();
  // Overlap the clipped edges by a subpixel to avoid seams during filtering.
  const expand = 1.022;
  c.moveTo(centerX + (p.x - centerX) * expand, centerY + (p.y - centerY) * expand);
  c.lineTo(centerX + (q.x - centerX) * expand, centerY + (q.y - centerY) * expand);
  c.lineTo(centerX + (r.x - centerX) * expand, centerY + (r.y - centerY) * expand);
  c.closePath();
  c.clip();
  const a = (q.x - p.x) / (q.sx - p.sx);
  const b = (q.y - p.y) / (q.sx - p.sx);
  const c1 = (r.x - p.x) / (r.sy - p.sy);
  const d = (r.y - p.y) / (r.sy - p.sy);
  c.transform(a, b, c1, d, p.x - a * p.sx - c1 * p.sy, p.y - b * p.sx - d * p.sy);
  c.drawImage(image, 0, 0);
  c.restore();
}

function cycle(image, width, power, kind, frameCount = FRAMES) {
  const source = rescale(image, width);
  const left = Math.ceil(width * 0.075);
  const top = Math.ceil(source.height * 0.25);
  const frames = [];
  for (let frame = 0; frame < frameCount; frame++) {
    const canvas = surface(width + 2 * left, source.height + 2 * top);
    const c = canvas.getContext('2d');
    const grid = joints(source, frame / frameCount * TAU, power, kind, left, top);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const nw = grid[y][x];
        const ne = grid[y][x + 1];
        const sw = grid[y + 1][x];
        const se = grid[y + 1][x + 1];
        triangle(c, source, nw, ne, sw);
        triangle(c, source, se, sw, ne);
      }
    }
    frames.push(canvas);
  }
  return { frames, sourceWidth: source.width, sourceHeight: source.height, left, top };
}

export function prepareSwimmer(base, { dash, bite, sing, hurt }) {
  return {
    idle: cycle(base, DIVER_WIDTH, 0.37),
    swim: cycle(base, DIVER_WIDTH, 1.14),
    dash: cycle(dash, DIVER_WIDTH, 0.66, 'dash', 12),
    bite: cycle(bite, DIVER_WIDTH, 0.69, 'bite', 12),
    sing: cycle(sing, DIVER_WIDTH, 0.48, 'sing', 12),
    hurt: cycle(hurt, DIVER_WIDTH, 0.59, 'hurt', 10),
  };
}

export function prepareRivals(atlas) {
  return Array.from({ length: 6 }, (_, index) => cycle(cell(atlas, index, 3, 2), 168, 0.64, 'rival', 10));
}

export const HERO_POSES = {
  idle: { width: 1.0, pivotX: 0.66, pivotY: 0.51 },
  swim: { width: 1.0, pivotX: 0.66, pivotY: 0.51 },
  dash: { width: 1.12, pivotX: 0.67, pivotY: 0.54 },
  bite: { width: 1.00, pivotX: 0.69, pivotY: 0.64 },
  sing: { width: 0.69, pivotX: 0.74, pivotY: 0.48 },
  hurt: { width: 0.82, pivotX: 0.73, pivotY: 0.47 },
};

export function animatedSprite(c, cycle, phase, options) {
  const { x, y, dir = 1, tilt = 0, alpha = 1, width, pivotX = 0.5, pivotY = 0.5, squash = 1 } = options;
  const { frames, sourceWidth, sourceHeight, left, top } = cycle;
  const phaseIndex = Math.floor((phase % 1 + 1) % 1 * frames.length);
  const frame = frames[phaseIndex];
  const scale = width / sourceWidth;
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.scale(dir * squash * scale, scale);
  c.globalAlpha = alpha;
  c.drawImage(frame, -sourceWidth * pivotX - left, -sourceHeight * pivotY - top);
  c.restore();
}
