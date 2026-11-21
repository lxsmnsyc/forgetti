import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act, createElement: h } = React;
import fs from 'node:fs'; import path from 'node:path';
const root0 = path.resolve('out');
const variants = ['plain','react-compiler','forgetti','hand'];
const items = (...ids) => ids.map(id => ({ id, name: 'n' + id }));
const I1 = items(1, 2, 3);
const L1 = [1, 2, 3];
const O1 = { a: { b: 1 } };
const mk = () => ({
  derived: { comp: 'Derived', base: { a: 1, b: 2 }, v: { one_b: { a: 1, b: 3 }, one_a: { a: 5, b: 2 } } },
  jsxprops: { comp: 'JsxProps', base: { cls: 'c', x: 1, y: 2 }, v: { one_cls: { cls: 'd', x: 1, y: 2 }, one_x: { cls: 'c', x: 9, y: 2 } } },
  earlyreturn: { comp: 'EarlyReturn', base: { loading: false, a: 1, b: 2 }, v: { one_b: { loading: false, a: 1, b: 3 }, one_loading: { loading: true, a: 1, b: 2 } } },
  ternary: { comp: 'Ternary', base: { ok: true, a: 1, b: 2 }, v: { inactive_b: { ok: true, a: 1, b: 3 }, active_a: { ok: true, a: 7, b: 2 } } },
  map: { comp: 'MapList', base: { items: I1, title: 't' }, v: { one_title: { items: I1, title: 'u' }, deep_item: { items: [I1[0], { id: 2, name: 'changed' }, I1[2]], title: 't' }, append: { items: [...I1, ...items(4)], title: 't' } } },
  forloop: { comp: 'ForLoop', base: { items: L1, title: 't' }, v: { one_title: { items: L1, title: 'u' }, new_array_same: { items: [1, 2, 3], title: 't' }, deep_item: { items: [1, 9, 3], title: 't' } } },
  hook: { comp: 'HookUser', base: { a: 1, b: 2 }, v: { one_b: { a: 1, b: 3 }, one_a: { a: 4, b: 2 } } },
  callback: { comp: 'Callback', base: { id: 1, label: 'L', other: 'o' }, v: { one_other: { id: 1, label: 'L', other: 'p' }, one_id: { id: 2, label: 'L', other: 'o' } } },
  statememo: { comp: 'StateMemo', base: { list: L1, tag: 'a' }, v: { one_tag: { list: L1, tag: 'b' }, new_list_same_content: { list: [1, 2, 3], tag: 'a' } }, state: true },
  mutate: { comp: 'Mutate', base: { a: 1, b: 2, c: 'x' }, v: { one_c: { a: 1, b: 2, c: 'y' }, one_a: { a: 5, b: 2, c: 'x' } } },
  deepprop: { comp: 'DeepProp', base: { obj: O1, other: 'o' }, v: { one_other: { obj: O1, other: 'p' }, deep_leaf: { obj: { a: { b: 2 } }, other: 'o' }, deep_newrefs_same_leaf: { obj: { a: { b: 1 } }, other: 'o' } } },
  usectx: { comp: 'UseCtx', base: { flag: true, name: 'n' }, v: { one_name: { flag: true, name: 'm' }, flag_off: { flag: false, name: 'n' } }, ctx: true },
  trycatch: { comp: 'TryCatch', base: { a: 1, label: 'x' }, v: { one_label: { a: 1, label: 'y' }, one_a: { a: 3, label: 'x' }, throw: { a: -1, label: 'x' } } },
  switch: { comp: 'Switch', base: { kind: 'a', a: 1, b: 2 }, v: { inactive_b: { kind: 'a', a: 1, b: 3 }, active_a: { kind: 'a', a: 7, b: 2 }, kind_b: { kind: 'b', a: 1, b: 2 } } },
  bailout: { comp: 'Bailout', base: { a: 1, box: { n: 0 } }, v: { one_a: { a: 2, box: { n: 0 } } } },
});
const results = []; const htmls = {};
for (const variant of variants) {
  const counter = await import(path.join(root0, variant, 'run/counter.js'));
  for (const [file, spec] of Object.entries(mk()).filter(([k])=>['ternary','switch','map','derived'].includes(k))) {
    const mod = await import(path.join(root0, variant, `run/${file}.js`));
    const Comp = mod[spec.comp];
    const phases = { same: spec.base, ...spec.v };
    if (spec.state) phases.setState = 'STATE';
    for (const [ph, props] of Object.entries(phases)) {
      // fresh base props per phase (bailout mutates)
      const fresh = (p) => file === 'bailout' ? { ...p, box: { n: 0 } } : p;
      const el = (p) => { const e = h(Comp, { ...p }); return spec.ctx ? h(mod.Ctx.Provider, { value: 'CTX' }, e) : e; };
      const container = document.createElement('div');
      const root = createRoot(container);
      const baseP = fresh(spec.base);
      counter.reset();
      let err = null;
      try {
        await act(() => root.render(el(baseP)));
        const initial = { ...counter.C };
        counter.reset();
        if (props === 'STATE') await act(() => globalThis.__setN(1));
        else await act(() => root.render(el(ph === 'same' ? baseP : fresh(props))));
        const key = `${file}/${ph}`;
        (htmls[key] ||= {})[variant] = container.innerHTML;
        results.push({ variant, file, ph, initial, counts: { ...counter.C } });
      } catch (e) { err = String(e).slice(0, 100); results.push({ variant, file, ph, err }); }
      await act(() => root.unmount());
    }
  }
}
fs.writeFileSync('out/runtime-results.json', JSON.stringify({ results, htmls }, null, 1));
// table
const fmt = (c) => Object.entries(c || {}).map(([k, v]) => `${k}${v}`).join(',') || '-';
const keys = [...new Set(results.map(r => `${r.file}/${r.ph}`))];
console.log('case | plain | RC | forgetti | hand | html-diff');
for (const k of keys) {
  const [f, p] = k.split('/');
  const cells = variants.map(v => { const r = results.find(r => r.variant === v && r.file === f && r.ph === p); return r?.err ? 'ERR ' + r.err : fmt(r?.counts); });
  const hh = htmls[k] || {};
  const diff = ['react-compiler','forgetti','hand'].filter(v => hh[v] !== hh.plain).map(v => v==='hand'?'HAND':v==='forgetti'?'FG':'RC').join('+');
  console.log(k.padEnd(34), '|', cells.join(' | '), '|', diff || '');
}
