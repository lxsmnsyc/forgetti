import { phases } from '../../shared/scenarios.js';

const options = [
  { id: 'a', label: 'Email' },
  { id: 'b', label: 'Phone', required: true },
  { id: 'c', label: 'Post' },
];
const base = {
  options,
  selected: ['a'],
  controlId: 'contact',
  disabledKeys: [],
  type: 'checkbox',
  inline: false,
};
const checks = () => globalThis.__checks;

export default [
  ...phases(
    'CheckGroup',
    base,
    {
      same_options: { ...base, options: [...options] },
      radio: { ...base, type: 'radio' },
      inline: { ...base, inline: true },
      disabled: { ...base, disabledKeys: ['c'] },
      control_id: { ...base, controlId: 'other' },
    },
    { context: { name: 'ThemeContext', value: { prefixes: {} } } },
  ),
  {
    name: 'theme',
    component: 'CheckGroup',
    props: base,
    context: { name: 'ThemeContext', value: { prefixes: {} } },
    steps: [
      { name: 'same_theme', context: { prefixes: {} } },
      { name: 'new_prefix', context: { prefixes: { 'form-check': 'fc' } } },
    ],
  },
  {
    name: 'toggles',
    component: 'CheckGroup',
    props: base,
    context: { name: 'ThemeContext', value: { prefixes: {} } },
    steps: [
      { name: 'check_b', act: () => checks().toggle('b') },
      { name: 'check_c', act: () => checks().toggle('c') },
      { name: 'uncheck_a', act: () => checks().toggle('a') },
      { name: 'clear', act: () => checks().clear() },
    ],
  },
];
