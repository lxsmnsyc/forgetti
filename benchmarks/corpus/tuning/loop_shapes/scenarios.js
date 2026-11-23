const X = [
  { id: 1, name: 'a', on: false, hide: false },
  { id: 2, name: 'b', on: true, hide: false },
  { id: 3, name: 'c', on: false, hide: true },
];
const swap = [X[0], { ...X[1], name: 'B', on: false }, X[2]];
const more = [...X, { id: 4, name: 'd', on: true, hide: false }];
const R = [
  {
    id: 1,
    cells: [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ],
  },
  { id: 2, cells: [{ id: 3, name: 'c' }] },
];
const R2 = [
  R[0],
  {
    id: 2,
    cells: [
      { id: 3, name: 'C' },
      { id: 4, name: 'd' },
    ],
  },
];

// One scenario per update: mount `base`, then apply one variant.
function pair(name, component, base, variants) {
  const scenarios = [];
  for (const [step, props] of Object.entries(variants)) {
    scenarios.push({
      name: `${name}_${step}`,
      component,
      props: base,
      steps: [{ name: step, props }],
    });
  }
  return scenarios;
}

export default [
  ...pair(
    'arm',
    'LoopArm',
    { ok: true, xs: X },
    {
      same: { ok: true, xs: X },
      replace: { ok: true, xs: swap },
      append: { ok: true, xs: more },
      off: { ok: false, xs: X },
    },
  ),
  {
    name: 'arm_toggle',
    component: 'LoopArm',
    props: { ok: true, xs: X },
    steps: [
      { name: 'off', props: { ok: false, xs: X } },
      { name: 'on', props: { ok: true, xs: swap } },
    ],
  },
  ...pair(
    'callback',
    'LoopCallback',
    { xs: X, v: 1 },
    {
      same: { xs: X, v: 1 },
      value: { xs: X, v: 2 },
      replace: { xs: swap, v: 1 },
      append: { xs: more, v: 1 },
    },
  ),
  ...pair(
    'nested',
    'LoopNested',
    { rows: R },
    {
      same: { rows: R },
      deep: { rows: R2 },
      fresh: { rows: [...R] },
    },
  ),
  ...pair(
    'and',
    'LoopAnd',
    { xs: X },
    {
      same: { xs: X },
      replace: { xs: swap },
      gone: { xs: null },
    },
  ),
  ...pair(
    'of',
    'LoopOf',
    { xs: X, t: 't' },
    {
      same: { xs: X, t: 't' },
      title: { xs: X, t: 'u' },
      replace: { xs: swap, t: 't' },
      append: { xs: more, t: 't' },
      shrink: { xs: [X[2]], t: 't' },
    },
  ),
  ...pair(
    'counter',
    'LoopCounter',
    { n: 3, t: 'a' },
    {
      same: { n: 3, t: 'a' },
      value: { n: 3, t: 'b' },
      grow: { n: 4, t: 'a' },
      shrink: { n: 1, t: 'a' },
    },
  ),
  ...pair(
    'skip',
    'LoopSkip',
    { xs: X, v: 1 },
    {
      same: { xs: X, v: 1 },
      value: { xs: X, v: 2 },
      hide: { xs: [{ ...X[0], hide: true }, X[1], X[2]], v: 1 },
      show: { xs: [X[0], X[1], { ...X[2], hide: false }], v: 1 },
    },
  ),
  {
    name: 'var_of',
    component: 'LoopVarOf',
    props: { xs: [1, 2, 3] },
    steps: [
      { name: 'same', props: { xs: [1, 2, 3] } },
      { name: 'shrink', props: { xs: [1, 2] } },
      { name: 'grow', props: { xs: [1, 2, 3, 4] } },
    ],
  },
  ...pair(
    'var_counter',
    'LoopVarCounter',
    { xs: [1, 2, 3], n: 3 },
    {
      same: { xs: [1, 2, 3], n: 3 },
      shrink: { xs: [1, 2, 3], n: 2 },
    },
  ),
];
