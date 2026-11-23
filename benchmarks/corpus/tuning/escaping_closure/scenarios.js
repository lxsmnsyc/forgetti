import { phases } from '../../shared/scenarios.js';

const names = ['a', 'b', 'c'];
const pick = () => {};
const rowsBase = { names, prefix: '-', onPick: pick };
const pairBase = { left: 'l', right: 'r', join: ':' };
const checkBase = { values: { a: 'x', b: '' }, label: 'f' };

// Scenario names are unique across the file, so each component gets its own prefix.
function named(component, scenarios) {
  return scenarios.map((scenario) => ({ ...scenario, name: `${component}_${scenario.name}` }));
}

export default [
  ...named(
    'Rows',
    phases('Rows', rowsBase, {
      new_prefix: { ...rowsBase, prefix: '+' },
      new_pick: { ...rowsBase, onPick: () => {} },
    }),
  ),
  ...named(
    'Pair',
    phases('Pair', pairBase, {
      new_join: { ...pairBase, join: '/' },
    }),
  ),
  ...named(
    'Check',
    phases('Check', checkBase, {
      new_values: { ...checkBase, values: { a: 'x', b: '' } },
      one_value: { ...checkBase, values: { a: 'x', b: 'y' } },
      new_label: { ...checkBase, label: 'g' },
    }),
  ),
];
