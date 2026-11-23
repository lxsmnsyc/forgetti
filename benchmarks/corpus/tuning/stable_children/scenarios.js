import { phases } from '../../shared/scenarios.js';

const items = [
  { id: 1, label: 'one' },
  { id: 2, label: 'two' },
  { id: 3, label: 'three' },
];
const pick = () => {};
const pickerBase = { items, onPick: pick, heading: 'h' };

const entries = [
  { name: 'a', amount: 40 },
  { name: 'b', amount: 75 },
  { name: 'c', amount: 5 },
];
const copy = () => entries.map((entry) => ({ ...entry }));
const totalsBase = () => ({ entries: copy(), currency: '$' });

const mode = { user: { name: 'ann' }, flag: false };

// Scenario names are unique across the file, so each component gets its own prefix.
function named(component, scenarios) {
  return scenarios.map((scenario) => ({ ...scenario, name: `${component}_${scenario.name}` }));
}

export default [
  ...named(
    'Picker',
    phases('Picker', pickerBase, {
      new_items: { ...pickerBase, items: [...items] },
      new_heading: { ...pickerBase, heading: 'g' },
      new_pick: { ...pickerBase, onPick: () => {} },
      one_item: {
        ...pickerBase,
        items: [items[0], { id: 2, label: 'deux' }, items[2]],
      },
    }),
  ),
  ...named(
    'Totals',
    phases('Totals', totalsBase, {
      new_entries: () => ({ entries: copy(), currency: '$' }),
      one_currency: () => ({ entries: copy(), currency: 'EUR ' }),
      one_amount: () => ({
        entries: entries.map((entry, i) => ({ ...entry, amount: i === 2 ? 6 : entry.amount })),
        currency: '$',
      }),
      new_top: () => ({
        entries: entries.map((entry, i) => ({ ...entry, amount: i === 0 ? 90 : entry.amount })),
        currency: '$',
      }),
      no_entries: () => ({ entries: [], currency: '$' }),
    }),
  ),
  ...named(
    'Mode',
    phases('Mode', mode, {
      new_user: { ...mode, user: { name: 'ann' } },
      other_user: { ...mode, user: { name: 'bob' } },
      no_user: { ...mode, user: null },
      flag_on: { ...mode, flag: true },
    }),
  ),
];
