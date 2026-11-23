const setG = { name: 'set_g', act: () => { globalThis.__g = 5; } };
const clearG = { name: 'clear_g', act: () => { delete globalThis.__g; } };

function once(component, props, variants) {
  const scenarios = [];
  for (const [name, next] of Object.entries(variants)) {
    scenarios.push({ name: `${component}_${name}`, component, props, steps: [{ name, props: next }] });
  }
  scenarios.push({ name: `${component}_same`, component, props, steps: [{ name: 'same' }] });
  return scenarios;
}

export default [
  {
    name: 'HelperGlobal_g',
    component: 'HelperGlobal',
    props: { a: 1 },
    steps: [{ name: 'same' }, setG, { name: 'again' }, clearG, { name: 'again_clear' }],
  },
  ...once('HelperMutates', { a: 1 }, { other: { a: 2 } }),
  ...once('HelperArg', { a: 1 }, { other: { a: 2 } }),
  ...once('HelperRef', { a: 1 }, { other: { a: 2 } }),
  {
    name: 'HelperState_n',
    component: 'HelperState',
    props: { a: 1 },
    steps: [
      { name: 'same' },
      { name: 'set', act: () => globalThis.__setN(1) },
      { name: 'set_again', act: () => globalThis.__setN(2) },
      { name: 'new_a', props: { a: 2 } },
    ],
  },
  {
    name: 'StoredInRef_call',
    component: 'StoredInRef',
    props: { a: 1 },
    steps: [
      { name: 'same' },
      { name: 'new_a', props: { a: 2 } },
      { name: 'call', act: () => { globalThis.__seen = globalThis.__call(); } },
    ],
  },
  {
    name: 'EffectClosure_seen',
    component: 'EffectClosure',
    props: { a: 1 },
    steps: [
      { name: 'same' },
      { name: 'new_a', props: { a: 2 } },
      { name: 'read', act: () => { globalThis.__x = globalThis.__seen; } },
    ],
  },
  {
    name: 'OuterAssign_call',
    component: 'OuterAssign',
    props: { a: 1 },
    steps: [
      { name: 'new_a', props: { a: 2 } },
      { name: 'call', act: () => { globalThis.__x = globalThis.__outer(); } },
    ],
  },
  ...once('HelperTick', { a: 1 }, { other: { a: 2 } }),
  ...once('HookHelper', { a: 1, b: 2 }, { only_a: { a: 3, b: 2 }, only_b: { a: 1, b: 4 } }),
  {
    name: 'LaterCall_n',
    component: 'LaterCall',
    props: { a: 'x' },
    steps: [
      { name: 'same' },
      { name: 'set', act: () => globalThis.__setN2(1) },
      { name: 'click', act: () => globalThis.__click() },
      { name: 'new_a', props: { a: 'y' } },
      { name: 'click_again', act: () => globalThis.__click() },
    ],
  },
  // A captured fresh value is passed to a call that changes it, and the helper runs twice.
  ...once('PassSink', { a: 1 }, { other: { a: 2 } }),
  ...once('PassAdd', { a: 1 }, { other: { a: 2 } }),
  ...once('PassMethod', { a: 1 }, { other: { a: 2 } }),
  ...once('PassNested', { a: 1 }, { other: { a: 2 } }),
  ...once('PassSpread', { a: 1 }, { other: { a: 2 } }),
  ...once('PassAlias', { a: 1 }, { other: { a: 2 } }),
  ...once('PassRead', { a: 1, b: 2 }, { other: { a: 2, b: 2 } }),
];
