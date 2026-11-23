// `cfg` is the same object in every step; only `n` changes.
const cfg = { label: 'L' };

export default [
  {
    name: 'with_memo',
    component: 'WithMemo',
    props: { n: 1, cfg },
    steps: [{ name: 'n2', props: { n: 2, cfg } }],
  },
  {
    name: 'no_memo',
    component: 'NoMemo',
    props: { n: 1, cfg },
    steps: [{ name: 'n2', props: { n: 2, cfg } }],
  },
];
