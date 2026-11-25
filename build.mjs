import * as esbuild from 'esbuild';
import fs from 'node:fs';

const result = await esbuild.build({
  entryPoints: ['src/side/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2022',
  legalComments: 'none',
  loader: { '.webp': 'dataurl' },
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/side/hud.css', 'utf8');
const source = fs.readFileSync('index.html', 'utf8');
const html = source
  .replace('<link rel="stylesheet" href="./src/side/hud.css">', () => '<style>\n' + css + '\n</style>')
  .replace('<script type="module" src="./src/side/main.js"></script>', () => '<script>' + js + '</script>');

fs.mkdirSync('dist', { recursive: true });
for (const name of ['鲸歌梦海.html', 'play.html']) fs.writeFileSync('dist/' + name, html);
console.log('dist/鲸歌梦海.html + dist/play.html', (Buffer.byteLength(html) / 1048576).toFixed(2), 'MB');

if (process.argv.includes('--pages')) {
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/index.html', html);
  fs.writeFileSync('docs/.nojekyll', '');
  console.log('docs/index.html');
}

if (process.argv.includes('--serve')) await import('./tools/serve.cjs');
