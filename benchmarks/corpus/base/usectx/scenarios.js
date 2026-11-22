import { phases } from '../../shared/scenarios.js';

const scenarios = phases(
  'UseCtx',
  { flag: true, name: 'n' },
  {
    one_name: { flag: true, name: 'm' },
    flag_off: { flag: false, name: 'n' },
  },
  { context: { name: 'Ctx', value: 'CTX' } },
);

// The context value changes while the props stay the same.
scenarios.push({
  name: 'context_change',
  component: 'UseCtx',
  props: { flag: true, name: 'n' },
  context: { name: 'Ctx', value: 'A' },
  steps: [{ name: 'to_B', context: 'B' }],
});

export default scenarios;
