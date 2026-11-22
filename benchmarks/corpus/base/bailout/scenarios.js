import { phases } from '../../shared/scenarios.js';

// The component mutates its props, so every use gets a fresh object.
export default phases('Bailout', () => ({ a: 1, box: { n: 0 } }), {
  one_a: () => ({ a: 2, box: { n: 0 } }),
});
