import { phases } from '../../shared/scenarios.js';

export default phases(
  'HookNested',
  { v: 1, tag: 't', other: 'o' },
  {
    one_v: { v: 2, tag: 't', other: 'o' },
    one_tag: { v: 1, tag: 'u', other: 'o' },
    one_other: { v: 1, tag: 't', other: 'p' },
  },
  { state: true },
);
