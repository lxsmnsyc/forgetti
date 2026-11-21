import * as babel from '@babel/core';
import RC from 'babel-plugin-react-compiler';
import forgetti from 'forgetti';
import fs from 'node:fs'; import zlib from 'node:zlib'; import { performance } from 'node:perf_hooks';
const files = fs.readdirSync('corpus').filter(f => f.endsWith('.jsx')).sort();
const events = {};
let cur;
const logger = { logEvent(_f, e) { (events[cur] ||= []).push(e); } };
function opts(kind) {
  return kind === 'rc'
    ? [[RC, { logger, panicThreshold: 'none', compilationMode: 'infer' }]]
    : [[forgetti, { preset: 'react' }]];
}
function run(code, kind, name) {
  cur = name;
  return babel.transformSync(code, { filename: name, plugins: opts(kind), parserOpts: { plugins: ['jsx'] }, configFile: false, babelrc: false }).code;
}
const rows = [];
for (const [kind, dir] of [['rc', 'react-compiler'], ['fg', 'forgetti']]) {
  fs.mkdirSync(`out/${dir}/run`, { recursive: true });
  fs.copyFileSync('corpus/counter.js', `out/${dir}/run/counter.js`);
  for (const f of files) {
    const name = f.replace('.jsx', '');
    const code = fs.readFileSync(`corpus/${f}`, 'utf8');
    events[name] = [];
    const out = run(code, kind, name);
    fs.writeFileSync(`out/${dir}/${name}.jsx`, out);
    const times = [];
    for (let i = 0; i < 20; i++) { const t = performance.now(); run(code, kind, name); times.push(performance.now() - t); }
    times.sort((a, b) => a - b);
    let slots = '';
    if (kind === 'rc') { const m = [...out.matchAll(/_c\((\d+)\)/g)].map(m => +m[1]); slots = m.length ? m.join('+') : '0'; }
    else { const m = [...out.matchAll(/\$\$cache\(\w+, (\d+)\)|\$\$branch\(\w+, \d+, (\d+)\)/g)].map(m => +(m[1]||m[2])); slots = m.length ? m.join('+') : '0'; }
    const ev = events[name].filter(e => /Compile(Error|Skip)|CompileDiagnostic|PipelineError/.test(e.kind)).map(e => (e.kind+': '+(e.detail?.reason||e.detail?.options?.reason||e.reason||'')+' '+(e.detail?.description||e.detail?.options?.description||'')).trim());
    const bailed = kind === 'rc' ? !/_c\(/.test(out) : false;
    // runnable
    const run1 = babel.transformSync(out, { presets: [['@babel/preset-react', { runtime: 'automatic' }]], configFile: false, babelrc: false, filename: name + '.jsx' }).code;
    fs.writeFileSync(`out/${dir}/run/${name}.js`, run1);
    rows.push({ kind, name, raw: Buffer.byteLength(out), gz: zlib.gzipSync(out).length, slots, ms: +times[10].toFixed(2), bailed, reason: [...new Set(ev)].join(' | ') });
  }
}
// uncompiled runnable
fs.mkdirSync('out/plain/run', { recursive: true }); fs.copyFileSync('corpus/counter.js', 'out/plain/run/counter.js');
for (const f of files) { const code = fs.readFileSync(`corpus/${f}`, 'utf8'); fs.writeFileSync(`out/plain/run/${f.replace('.jsx','.js')}`, babel.transformSync(code, { presets: [['@babel/preset-react', { runtime: 'automatic' }]], configFile:false, babelrc:false, filename:f }).code); }
fs.writeFileSync('out/compile-table.json', JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.kind, r.name.padEnd(12), r.raw, r.gz, r.slots, r.ms, r.bailed, r.reason);
