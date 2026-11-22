import { makeResource, getResource, resolveResource } from '../../shared/resource.js';

export default [
  {
    name: 'suspend_same_tag',
    component: 'SuspenseUpdate',
    props: () => ({ res: makeResource(false), tag: 't' }),
    steps: [
      { name: 'suspend', props: () => ({ res: makeResource(true), tag: 't' }) },
      { name: 'resolve', act: resolveResource },
      { name: 'same' },
    ],
  },
  {
    name: 'suspend_new_tag',
    component: 'SuspenseUpdate',
    props: () => ({ res: makeResource(false), tag: 't' }),
    steps: [
      { name: 'suspend', props: () => ({ res: makeResource(true), tag: 'u' }) },
      { name: 'resolve', act: resolveResource },
      { name: 'one_tag', props: () => ({ res: getResource(), tag: 'v' }) },
    ],
  },
  {
    name: 'retag_while_pending',
    component: 'SuspenseUpdate',
    props: () => ({ res: makeResource(false), tag: 't' }),
    steps: [
      { name: 'suspend', props: () => ({ res: makeResource(true), tag: 'u' }) },
      { name: 'retag', props: () => ({ res: getResource(), tag: 'w' }) },
      { name: 'resolve', act: resolveResource },
    ],
  },
];
