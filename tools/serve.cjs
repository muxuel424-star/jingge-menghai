// 极简静态服务器：node tools/serve.cjs [端口] [--allow-save]
// --allow-save 时允许 POST /__save?name=xxx.glb 写入 assets/rivals（仅供模型预处理工具用）
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv.find((a) => /^\d+$/.test(a))) || 8123;
const allowSave = process.argv.includes('--allow-save');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.fbx': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png' };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/__save') {
    const name = path.basename(u.searchParams.get('name') || '');
    if (!allowSave || !/^[a-z0-9_-]+\.glb$/i.test(name)) { res.writeHead(403).end(); return; }
    const dir = path.join(root, 'assets', 'rivals');
    fs.mkdirSync(dir, { recursive: true });
    const out = fs.createWriteStream(path.join(dir, name));
    req.pipe(out);
    out.on('finish', () => res.writeHead(200).end('ok'));
    return;
  }
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/dist/play.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404).end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(d);
  });
}).listen(port, '127.0.0.1', () => console.log('serving ' + root + ' on http://localhost:' + port + (allowSave ? ' (save enabled)' : '')));
