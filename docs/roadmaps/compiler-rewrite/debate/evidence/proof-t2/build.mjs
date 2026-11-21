import * as babel from '@babel/core'; import fs from 'node:fs'; import zlib from 'node:zlib';
fs.mkdirSync('out/hand/run',{recursive:true});
fs.copyFileSync('corpus/counter.js','out/hand/run/counter.js'); fs.copyFileSync('rt.js','out/hand/run/rt.js');
const T=JSON.parse(fs.readFileSync('../rc-bench/out/compile-table.json'));
for (const f of ['ternary','switch','map','derived']) {
  const s=fs.readFileSync(`hand/${f}.jsx`,'utf8');
  const slots=[...s.matchAll(/useCache\((\d+)\)|branch\(\$?\w*, [^,]+, (\d+)\)/g)].map(m=>m[1]||m[2]).join('+');
  const r=T.filter(x=>x.name===f).map(x=>`${x.kind} ${x.raw}/${x.gz} s${x.slots}`).join('  ');
  console.log(f,'hand',Buffer.byteLength(s),zlib.gzipSync(s).length,slots,'|',r, 'ratio', (Buffer.byteLength(s)/T.find(x=>x.name===f&&x.kind==='rc').raw).toFixed(2));
  fs.writeFileSync(`out/hand/run/${f}.js`,babel.transformSync(s,{presets:[['@babel/preset-react',{runtime:'automatic'}]],configFile:false,babelrc:false,filename:f+'.jsx'}).code);
}
