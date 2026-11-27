import * as esbuild from 'esbuild';
import fs from 'node:fs';

const result = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true,
  write: false, target: 'es2022', legalComments: 'none', loader: { '.webp': 'dataurl' },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/ui/style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8')
  .replace('<link rel="stylesheet" href="./src/ui/style.css">', () => '<style>\n' + css + '\n</style>')
  .replace('<script type="module" src="./src/main.js"></script>', () => '<script>' + js + '</script>');
if (Buffer.byteLength(html) > 6 * 1048576) throw new Error('The single-file game exceeds the 6 MB budget.');
fs.mkdirSync('dist', { recursive: true });
const names = process.argv.includes('--preview') ? ['v2-preview.html'] : ['鲸歌梦海.html', 'play.html'];
for (const name of names) fs.writeFileSync('dist/' + name, html);
console.log(names.map(name => 'dist/' + name).join(' + '), (Buffer.byteLength(html) / 1048576).toFixed(2), 'MB');
if (process.argv.includes('--pages')) {
  fs.mkdirSync('docs', { recursive: true }); fs.writeFileSync('docs/index.html', html); fs.writeFileSync('docs/.nojekyll', '');
  console.log('docs/index.html');
}
if (process.argv.includes('--serve')) await import('./tools/serve.cjs');
