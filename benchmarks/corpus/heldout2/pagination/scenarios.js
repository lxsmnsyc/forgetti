import { phases } from '../../shared/scenarios.js';

const base = { total: 95, pageSize: 10, initialPage: 1, size: undefined, siblings: 2 };
const pager = () => globalThis.__pager;
const theme = { name: 'ThemeContext', value: { prefixes: {} } };

export default [
  ...phases(
    'Pager',
    base,
    {
      small: { ...base, size: 'sm' },
      more_total: { ...base, total: 400 },
      fewer_siblings: { ...base, siblings: 1 },
      page_size: { ...base, pageSize: 25 },
      other_start: { ...base, initialPage: 5 },
    },
    { context: theme },
  ),
  {
    name: 'theme',
    component: 'Pager',
    props: base,
    context: theme,
    steps: [
      { name: 'same_theme', context: { prefixes: {} } },
      { name: 'new_prefix', context: { prefixes: { pagination: 'pg' } } },
    ],
  },
  {
    name: 'paging',
    component: 'Pager',
    props: base,
    context: theme,
    steps: [
      { name: 'page_2', act: () => pager().go(2) },
      { name: 'page_2_again', act: () => pager().go(2) },
      { name: 'page_6', act: () => pager().go(6) },
      { name: 'page_10', act: () => pager().go(10) },
      { name: 'page_1', act: () => pager().go(1) },
    ],
  },
];
