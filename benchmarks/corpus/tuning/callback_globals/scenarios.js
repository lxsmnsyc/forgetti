// Each global scenario sets a global between two renders of the same props, then clears it.
const setGlobal = {
  name: 'set_global',
  act: () => {
    globalThis.__g = 5;
  },
};
const clearGlobal = {
  name: 'clear_global',
  act: () => {
    delete globalThis.__g;
  },
};

function global(component, props) {
  return {
    name: component,
    component,
    props,
    steps: [setGlobal, { name: 'again' }, clearGlobal, { name: 'again_clear' }],
  };
}

const mapProps = () => ({ a: 1, items: [{ id: 1 }, { id: 2 }] });
const callProps = () => ({ a: 1, b: 'x' });
const fillProps = () => ({ a: 1, b: 2, items: [] });

export default [
  global('GlobalMap', mapProps),
  global('GlobalMemo', callProps),
  global('GlobalPlain', callProps),
  {
    name: 'PropsFill_same',
    component: 'PropsFill',
    props: fillProps,
    steps: [{ name: 'same' }, { name: 'same_again' }],
  },
  {
    name: 'PropsFill_one_a',
    component: 'PropsFill',
    props: fillProps,
    steps: [{ name: 'one_a', props: () => ({ a: 3, b: 2, items: [] }) }, { name: 'same_again' }],
  },
];
