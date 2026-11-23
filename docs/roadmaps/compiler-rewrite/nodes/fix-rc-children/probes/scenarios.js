const setGlobal = { name: 'set_global', act: () => { globalThis.__g = 5; } };
const clearGlobal = { name: 'clear_global', act: () => { delete globalThis.__g; } };

function once(component, props, variants) {
  const scenarios = [];
  for (const [name, next] of Object.entries(variants)) {
    scenarios.push({ name: `${component}_${name}`, component, props, steps: [{ name, props: next }] });
  }
  scenarios.push({ name: `${component}_same`, component, props, steps: [{ name: 'same' }] });
  return scenarios;
}

const base = [
  {
    name: 'Wrappers_global',
    component: 'Wrappers',
    props: { id: 1 },
    steps: [setGlobal, { name: 'again' }, clearGlobal, { name: 'again_clear' }],
  },
  ...once('LetClosure', () => ({ items: [1, 2] }), {
    longer: () => ({ items: [1, 2, 3] }),
    empty: () => ({ items: [] }),
  }),
  ...once('LetAfter', { a: 'x', b: 'y' }, {
    only_a: { a: 'z', b: 'y' },
    only_b: { a: 'x', b: 'w' },
  }),
  ...once('LetCaptured', { a: 'x', b: 'y' }, {
    only_a: { a: 'z', b: 'y' },
    only_b: { a: 'x', b: 'w' },
  }),
  ...once('LetLoop', { n: 2, kind: 'a' }, {
    more: { n: 4, kind: 'a' },
    kind: { n: 2, kind: 'b' },
    both: { n: 3, kind: 'b' },
  }),
  ...once('LetObject', { a: 'x', b: 'y' }, {
    only_a: { a: 'z', b: 'y' },
    only_b: { a: 'x', b: 'w' },
  }),
  ...once('LetTry', { x: 'ok' }, {
    bad: { x: 'bad' },
    other: { x: 'fine' },
    back: { x: 'ok' },
  }),
  ...once('KeyMutated', { a: 1, b: 2 }, {
    only_a: { a: 3, b: 2 },
    only_b: { a: 1, b: 0 },
    both: { a: 4, b: 5 },
  }),
  {
    name: 'KeyHidden_level',
    component: 'KeyHidden',
    props: () => ({ a: { x: 1 } }),
    steps: [
      { name: 'same' },
      { name: 'same_object', props: () => ({ a: { x: 1 } }) },
      setGlobal,
      { name: 'again_global', props: () => ({ a: { x: 1 } }) },
      clearGlobal,
      { name: 'new_x', props: () => ({ a: { x: 2 } }) },
    ],
  },
];

const more = [
  ...once('LetGroup', { a: 'x', b: 'y' }, {
    only_a: { a: 'z', b: 'y' },
    only_b: { a: 'x', b: 'w' },
  }),
  ...once('LetGuard', { x: true, y: 1 }, {
    only_y: { x: true, y: 2 },
    off: { x: false, y: 2 },
  }),
  ...once('LetBranch', { a: 'x', b: 0, show: true }, {
    only_a: { a: 'z', b: 0, show: true },
    only_b: { a: 'x', b: 'q', show: true },
    hide: { a: 'x', b: 0, show: false },
  }),
  ...once('LetAccumulate', () => ({ items: [1, 2, 3] }), {
    longer: () => ({ items: [1, 2, 3, 4] }),
    other: () => ({ items: [3, 2, 1] }),
  }),
  ...once('LetEarly', { a: 1, b: 0 }, {
    early: { a: 1, b: 2 },
    only_a: { a: 5, b: 0 },
  }),
  ...once('KeyGrow', { a: 1, b: 2 }, {
    only_a: { a: 3, b: 2 },
    only_b: { a: 1, b: 4 },
  }),
  {
    name: 'KeyTouched',
    component: 'KeyTouched',
    props: () => ({ a: { x: 0 } }),
    steps: [{ name: 'same' }, { name: 'same_again' }],
  },
  {
    name: 'KeyTouchedPlain',
    component: 'KeyTouchedPlain',
    props: () => ({ a: { x: 0 } }),
    steps: [{ name: 'same' }, { name: 'same_again' }],
  },
  {
    name: 'KeyTouchedMember',
    component: 'KeyTouchedMember',
    props: () => ({ a: { x: 0 } }),
    steps: [{ name: 'same' }, { name: 'same_again' }],
  },
];

export default [...base, ...more];
