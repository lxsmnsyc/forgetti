import { phases } from '../../shared/scenarios.js';

const list = [1, 2, 3];
const scenarios = phases(
  'Transition',
  { list, tag: 't' },
  { one_tag: { list, tag: 'u' } },
  { state: true },
);

// A transition update starts, then an urgent update lands before it commits.
scenarios.push({
  name: 'interrupt',
  component: 'Transition',
  props: { list, tag: 't' },
  steps: [
    {
      name: 'interrupt',
      act: ({ startTransition }) => {
        startTransition(() => globalThis.__setN(1));
        globalThis.__setN(2);
      },
    },
    { name: 'after', props: { list, tag: 'u' } },
  ],
});

export default scenarios;
