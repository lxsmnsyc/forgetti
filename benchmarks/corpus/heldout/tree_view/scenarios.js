import { phases } from '../../shared/scenarios.js';

const initial = {
  0: { id: 0, counter: 0, childIds: [1, 2] },
  1: { id: 1, counter: 0, childIds: [3] },
  2: { id: 2, counter: 0, childIds: [] },
  3: { id: 3, counter: 0, childIds: [4] },
  4: { id: 4, counter: 0, childIds: [] },
};
const base = { initial, title: 'Tree' };
const tree = () => globalThis.__tree;

export default [
  ...phases('TreeView', base, {
    new_initial: { ...base, initial: { ...initial } },
    one_title: { ...base, title: 'Nodes' },
  }),
  {
    name: 'editing',
    component: 'TreeView',
    props: base,
    steps: [
      { name: 'increment_root', act: () => tree().dispatch({ type: 'INCREMENT', nodeId: 0 }) },
      { name: 'increment_leaf', act: () => tree().dispatch({ type: 'INCREMENT', nodeId: 2 }) },
      {
        name: 'add_child',
        act: () => tree().dispatch({ type: 'ADD_CHILD', nodeId: 2, childId: 5 }),
      },
      {
        name: 'remove_child',
        act: () => tree().dispatch({ type: 'REMOVE_CHILD', nodeId: 0, childId: 1 }),
      },
      { name: 'unknown', act: () => tree().dispatch({ type: 'NOOP' }) },
    ],
  },
];
