export default [
  {
    name: 'if_flip',
    component: 'ControlIf',
    props: { k: true, b: 1 },
    steps: [
      { name: 'test_off', props: { k: false, b: 1 } },
      { name: 'test_on', props: { k: true, b: 1 } },
    ],
  },
  {
    name: 'switch_flip',
    component: 'ControlSwitch',
    props: { k: 1, b: 1 },
    steps: [
      { name: 'test_off', props: { k: 2, b: 1 } },
      { name: 'test_on', props: { k: 1, b: 1 } },
    ],
  },
  {
    name: 'and_flip',
    component: 'ControlAnd',
    props: { k: true, b: 1 },
    steps: [
      { name: 'test_off', props: { k: false, b: 1 } },
      { name: 'test_on', props: { k: true, b: 1 } },
    ],
  },
  {
    name: 'skip_flip',
    component: 'ControlSkip',
    props: { k: true, b: 1, xs: [1, 2] },
    steps: [
      { name: 'test_off', props: { k: false, b: 1, xs: [1, 2] } },
      { name: 'test_on', props: { k: true, b: 1, xs: [1, 2] } },
    ],
  },
];
