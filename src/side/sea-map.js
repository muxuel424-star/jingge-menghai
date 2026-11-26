import { floorAt, roofAt } from './reefs.js';

export function drawSeaMap(canvas, game) {
  const c = canvas.getContext('2d');
  const { width, height } = canvas;
  const reef = game.reef;
  const sx = (width - 26) / reef.width;
  const sy = (height - 30) / reef.bounds;
  const x = value => 13 + value * sx;
  const y = value => 16 + value * sy;
  c.clearRect(0, 0, width, height);
  c.fillStyle = '#061323';
  c.fillRect(0, 0, width, height);
  c.beginPath();
  c.moveTo(x(0), y(roofAt(0, reef)));
  for (let i = 0; i <= 180; i++) c.lineTo(x(i / 180 * reef.width), y(roofAt(i / 180 * reef.width, reef)));
  for (let i = 180; i >= 0; i--) c.lineTo(x(i / 180 * reef.width), y(floorAt(i / 180 * reef.width, reef)));
  c.closePath();
  c.fillStyle = reef.mist + '7a';
  c.fill();
  c.lineWidth = 1.3;
  c.strokeStyle = reef.light + '91';
  c.stroke();
  for (const solid of reef.solids ?? []) {
    c.beginPath();
    if (solid.points) {
      solid.points.forEach((point, i) => i ? c.lineTo(x(point.x), y(point.y)) : c.moveTo(x(point.x), y(point.y)));
      c.closePath();
    } else {
      c.ellipse(x(solid.x), y(solid.y), solid.rx * sx, solid.ry * sy, 0, 0, Math.PI * 2);
    }
    c.fillStyle = '#0b1628';
    c.fill();
  }
  c.font = '19px "Microsoft YaHei UI", sans-serif';
  c.textAlign = 'center';
  for (const region of reef.regions ?? []) {
    const explored = game.zone.visited.has(region.name);
    c.fillStyle = explored ? '#d1e4f4cc' : '#a6bac46a';
    c.fillText(region.name, x((region.from + region.to) / 2), height - 7);
    c.strokeStyle = '#b2daff25';
    c.beginPath();
    c.moveTo(x(region.from), 14);
    c.lineTo(x(region.from), height - 26);
    c.stroke();
  }
  c.fillStyle = '#76e9cf90';
  for (const shoal of reef.shoals) {
    c.beginPath();
    c.arc(x(shoal.x), y(shoal.y), 2.0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#ffd78a';
  for (const pickup of game.zone.pickups ?? []) {
    if (pickup.timer || (!game.equipment.sonar && Math.hypot(pickup.x-game.player.x,pickup.y-game.player.y)>700)) continue;
    c.fillRect(x(pickup.x)-2.5,y(pickup.y)-2.5,5,5);
  }
  if (game.equipment.sonar) {
    c.fillStyle = '#e4c2ff';
    for (const item of game.zone.things) {
      if (item.kind === 'chest' && !item.timer) c.fillRect(x(item.x)-3,y(item.y)-3,6,6);
    }
  }
  const boss = game.zone.boss;
  if (boss.hp > 0) {
    c.fillStyle = '#ff8d89';
    c.beginPath();
    c.moveTo(x(boss.x), y(boss.y) - 5);
    c.lineTo(x(boss.x) + 5, y(boss.y));
    c.lineTo(x(boss.x), y(boss.y) + 5);
    c.lineTo(x(boss.x) - 5, y(boss.y));
    c.fill();
  }
  c.strokeStyle = '#93eaf4';
  c.lineWidth = 2;
  const gates = [];
  if (game.map > 0) gates.push(game.zone.back);
  if (game.map < 4) gates.push(game.zone.gate);
  for (const gate of gates) {
    c.beginPath();
    c.ellipse(x(gate.x), y(gate.y), 3, 8, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = '#f8f3d8';
  c.beginPath();
  c.arc(x(game.player.x), y(game.player.y), 4.5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#f8f3d86b';
  c.lineWidth = 1;
  c.strokeRect(x(game.player.x) - 23, y(game.player.y) - 20, 46, 40);
}
