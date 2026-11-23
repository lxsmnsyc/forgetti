import { phases } from '../../shared/scenarios.js';

const initial = [
  { id: 1, title: 'write corpus', completed: false },
  { id: 2, title: 'run harness', completed: true },
  { id: 3, title: 'read results', completed: false },
];
const base = { initial, route: '/', nextId: 10 };
const app = () => globalThis.__todo;

export default [
  ...phases('TodoApp', base, {
    route_active: { ...base, route: '/active' },
    route_completed: { ...base, route: '/completed' },
    new_next_id: { ...base, nextId: 20 },
  }),
  {
    name: 'edits',
    component: 'TodoApp',
    props: base,
    steps: [
      { name: 'toggle', act: () => app().dispatch({ type: 'TOGGLE_ITEM', payload: { id: 1 } }) },
      { name: 'draft', act: () => app().setDraft('ship it') },
      {
        name: 'update',
        act: () => app().dispatch({ type: 'UPDATE_ITEM', payload: { id: 3, title: 'read more' } }),
      },
      {
        name: 'toggle_all',
        act: () => app().dispatch({ type: 'TOGGLE_ALL', payload: { completed: true } }),
      },
      { name: 'clear', act: () => app().dispatch({ type: 'CLEAR_COMPLETED' }) },
      {
        name: 'add',
        act: () => app().dispatch({ type: 'ADD_ITEM', payload: { id: 7, title: 'again' } }),
      },
    ],
  },
  {
    name: 'filtered_edit',
    component: 'TodoApp',
    props: { ...base, route: '/active' },
    steps: [
      {
        name: 'toggle_hides',
        act: () => app().dispatch({ type: 'TOGGLE_ITEM', payload: { id: 1 } }),
      },
      { name: 'remove', act: () => app().dispatch({ type: 'REMOVE_ITEM', payload: { id: 3 } }) },
    ],
  },
];
