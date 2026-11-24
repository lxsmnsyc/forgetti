export default [
  {
    name: 'Page',
    props: { a: 1, b: 2 },
    steps: [{ name: 'same' }, { name: 'one_b', props: { a: 1, b: 3 } }],
  },
];
