export default [
  {
    name: 'one_n',
    component: 'EffectEvent',
    props: { tag: 't', n: 1 },
    steps: [{ name: 'one_n', props: { tag: 't', n: 2 } }],
  },
  {
    name: 'one_tag',
    component: 'EffectEvent',
    props: { tag: 't', n: 1 },
    steps: [{ name: 'one_tag', props: { tag: 'u', n: 1 } }],
  },
  {
    name: 'both',
    component: 'EffectEvent',
    props: { tag: 't', n: 1 },
    steps: [
      { name: 'one_n', props: { tag: 't', n: 5 } },
      { name: 'one_tag', props: { tag: 'u', n: 5 } },
    ],
  },
];
