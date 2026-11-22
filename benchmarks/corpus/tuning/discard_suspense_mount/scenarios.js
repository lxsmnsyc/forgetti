import { makeResource, getResource, resolveResource } from '../../shared/resource.js';

export default [
  {
    name: 'resolve',
    component: 'SuspenseMount',
    props: () => ({ res: makeResource(true), tag: 't' }),
    steps: [
      { name: 'resolve', act: resolveResource },
      { name: 'one_tag', props: () => ({ res: getResource(), tag: 'u' }) },
    ],
  },
  {
    name: 'ready',
    component: 'SuspenseMount',
    props: () => ({ res: makeResource(false), tag: 't' }),
    steps: [{ name: 'one_tag', props: () => ({ res: getResource(), tag: 'u' }) }, { name: 'same' }],
  },
  {
    name: 'tag_while_pending',
    component: 'SuspenseMount',
    props: () => ({ res: makeResource(true), tag: 't' }),
    steps: [
      { name: 'one_tag', props: () => ({ res: getResource(), tag: 'u' }) },
      { name: 'resolve', act: resolveResource },
    ],
  },
];
