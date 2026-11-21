import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement: h } = await import('react');
const { createRoot } = await import('react-dom/client');
import path from 'node:path';
for (const v of ['plain', 'react-compiler', 'forgetti']) {
  const m = await import(path.resolve('out', v, 'run/usectx.js'));
  const c = document.createElement('div'); const r = createRoot(c);
  const go = (val) => act(() => r.render(h(m.Ctx.Provider, { value: val }, h(m.UseCtx, { flag: true, name: 'n' }))));
  await go('A'); const a = c.innerHTML; await go('B');
  console.log('ctx', v, a, '->', c.innerHTML);
  const f = await import(path.resolve('out', v, 'run/forloop.js'));
  const c2 = document.createElement('div'); const r2 = createRoot(c2);
  const go2 = (items) => act(() => r2.render(h(f.ForLoop, { items, title: 't' })));
  await go2([1, 2, 3]); await go2([1, 2, 3, 4]); const x = c2.innerHTML; await go2([5]);
  console.log('loop', v, x, '->', c2.innerHTML);
}
