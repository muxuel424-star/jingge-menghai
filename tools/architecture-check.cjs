const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
let acorn;
try { acorn = require('internal/deps/acorn/acorn/dist/acorn'); }
catch {
  const child = spawnSync(process.execPath, ['--expose-internals', __filename, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(child.status ?? 1);
}

const project = path.resolve(__dirname, '..');
const out = path.resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6)
  ?? path.join(os.tmpdir(), 'jingge-architecture-check'));
const findings = [], counts = {}, files = [];
const sourceRoot = path.join(project, 'src');
function collect(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (folder === sourceRoot && !process.argv.includes('--include-legacy')
        && !['main.js', 'data', 'sim', 'render', 'audio', 'ui'].includes(entry.name)) continue;
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) collect(file); else if (entry.name.endsWith('.js')) files.push(file);
  }
}
collect(sourceRoot);

function walk(node, visit, ancestors = []) {
  if (!node || typeof node !== 'object' || !node.type) return;
  visit(node, ancestors);
  for (const [key, value] of Object.entries(node)) {
    if (['start', 'end', 'loc'].includes(key)) continue;
    if (Array.isArray(value)) for (const child of value) walk(child, visit, [...ancestors, node]);
    else if (value?.type) walk(value, visit, [...ancestors, node]);
  }
}
const member = node => node?.type === 'Identifier' ? node.name : node?.type === 'ThisExpression' ? 'this'
  : node?.type === 'MemberExpression' ? `${member(node.object)}.${node.computed ? '*' : member(node.property)}` : '';
const isFunction = node => /Function/.test(node.type) || node.type === 'MethodDefinition';
function add(rule, file, node, detail, category = 'violation') {
  const name = path.relative(project, file).split(path.sep).join('/');
  findings.push({ rule, file: name, line: node.loc?.start.line ?? 1, column: (node.loc?.start.column ?? 0) + 1, detail, category });
  counts[rule] = (counts[rule] ?? 0) + 1;
}

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8'), relative = path.relative(sourceRoot, file).split(path.sep).join('/');
  const data = relative.startsWith('data/'), sim = relative.startsWith('sim/'), render = relative.startsWith('render/');
  const tree = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const lines = code.split(/\r?\n/).length;
  if (!data && relative !== 'main.js' && lines > 400) add('file-lines', file, tree, `${lines} > 400`);
  walk(tree, (node, ancestors) => {
    const parent = ancestors.at(-1);
    if (node.type === 'ImportDeclaration' || (node.type === 'ExportNamedDeclaration' && node.source)) {
      const target = node.source.value;
      if (sim && /(?:^|\/)(?:render|ui|audio)\//.test(target)) add('sim-layer-import', file, node, target);
      if (data) {
        const resolved = path.resolve(path.dirname(file), target);
        if (!resolved.startsWith(path.join(sourceRoot, 'data') + path.sep)) add('data-layer-import', file, node, target);
      }
    }
    if (node.type === 'ExportDefaultDeclaration') add('export-default', file, node, 'Use named exports.');
    if (node.type === 'CallExpression') {
      const call = member(node.callee);
      if (call === 'Math.random' && relative !== 'sim/rng.js') add('non-deterministic-random', file, node, call);
      if (sim && ['Date.now', 'performance.now'].includes(call)) add('sim-wall-clock', file, node, call);
    }
    if (sim && node.type === 'Identifier' && ['window', 'document', 'canvas'].includes(node.name)
      && !(parent?.type === 'MemberExpression' && parent.property === node && !parent.computed)) add('sim-browser-global', file, node, node.name);
    if (render && ['AssignmentExpression', 'UpdateExpression'].includes(node.type)) {
      const target = member(node.left ?? node.argument);
      if (/^(?:game|player|boss|fish|entity|enemy)\./.test(target)) add('render-sim-write', file, node, target);
      else if (/^(?:p|b|f|e|n)\./.test(target)) add('render-possible-alias-write', file, node, target, 'review');
    }
    if (node.type === 'Literal' && typeof node.value === 'number' && !data && ![0, 1].includes(node.value)) {
      if (parent?.type === 'MemberExpression' && parent.computed && parent.property === node) return;
      const category = parent?.type === 'ArrayExpression' ? 'array-value'
        : parent?.type === 'BinaryExpression' ? 'formula-or-tuning'
        : parent?.type === 'Property' ? 'configuration' : 'tuning-or-math';
      add('bare-number', file, node, node.raw, category);
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && /#[\da-f]{3,8}\b/i.test(node.value)
      && !relative.endsWith('/palette.js')) add('inline-hex', file, node, node.value.slice(0, 100));
    if (['NewExpression', 'ObjectExpression', 'ArrayExpression'].includes(node.type)) {
      const method = [...ancestors].reverse().find(isFunction);
      const owner = method && ancestors[ancestors.indexOf(method) - 1];
      const name = method?.id?.name ?? owner?.key?.name ?? owner?.id?.name ?? '';
      if (/^(?:draw|update|tick|frame|step)/.test(name)) add('hot-path-allocation-site', file, node, `${name}: ${node.type}`, 'review');
    }
  });
}
const violations = findings.filter(item => item.category !== 'review');
const report = { kind: 'static-ast-design-audit', parser: `Node ${process.versions.node} bundled Acorn ${acorn.version}`,
  files: files.length, counts, strictPass: violations.length === 0, violations: violations.length, findings,
  limitations: ['Static analysis flags possible writes through common render aliases; frozen-snapshot runtime tests remain necessary.',
    'Allocation sites are reported for review; this cannot prove zero runtime allocations or absence of GC pauses.',
    'Bare numbers remain explicit violations even when classified as formulas or array values; categories do not waive 09 §2.1.',
    'This script does not verify physical GPU, total process/GPU memory, artistic quality, player learning or human story recall.'] };
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'architecture-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ files: report.files, strictPass: report.strictPass, violations: report.violations, counts,
  report: path.join(out, 'architecture-report.json') }, null, 2));
if (!report.strictPass && !process.argv.includes('--report-only')) process.exitCode = 1;
