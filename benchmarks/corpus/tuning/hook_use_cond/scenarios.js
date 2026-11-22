import { phases } from '../../shared/scenarios.js';

const context = { name: 'Ctx', value: 'CTX' };
const scenarios = phases(
  'HookUseCond',
  { flag: true, name: 'n' },
  {
    one_name: { flag: true, name: 'm' },
    flag_off: { flag: false, name: 'n' },
  },
  { context },
);

// The flag turns off and on again, so the use() call is skipped and then runs again.
scenarios.push({
  name: 'flag_toggle',
  component: 'HookUseCond',
  props: { flag: true, name: 'n' },
  context,
  steps: [
    { name: 'off', props: { flag: false, name: 'n' } },
    { name: 'on', props: { flag: true, name: 'n' } },
  ],
});

// The context value changes while the props stay the same.
scenarios.push({
  name: 'context_change',
  component: 'HookUseCond',
  props: { flag: true, name: 'n' },
  context: { name: 'Ctx', value: 'A' },
  steps: [{ name: 'to_B', context: 'B' }],
});

export default scenarios;
