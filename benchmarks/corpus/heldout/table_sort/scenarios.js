import { phases } from '../../shared/scenarios.js';

const columns = [
  { id: 'name', header: 'Name' },
  { id: 'age', header: 'Age' },
  { id: 'status', header: 'Status' },
  { id: 'rank', header: 'Rank', invert: true },
  { id: 'note', header: 'Note', sortable: false },
];
const rows = [
  { id: 1, name: 'Ada', age: 36, status: 'single', rank: 2, note: 'x' },
  { id: 2, name: 'Bo', age: 29, status: 'relationship', rank: 5 },
  { id: 3, name: 'Cy', age: 41, status: 'complicated', rank: 1, note: 'y' },
  { id: 4, name: 'Di', age: 29, status: 'single', rank: 3 },
];

const sortBy =
  (id, desc = false) =>
  () =>
    globalThis.__setSorting([{ id, desc }]);

const base = { rows, columns, initialSorting: [{ id: 'name', desc: false }], pageSize: 3 };

export default [
  ...phases('SortTable', base, {
    new_rows: { ...base, rows: [...rows] },
    new_columns: { ...base, columns: [...columns] },
    one_page: { ...base, pageSize: 4 },
    one_row: { ...base, rows: [rows[0], rows[1], { ...rows[2], age: 50 }, rows[3]] },
  }),
  {
    name: 'sorting',
    component: 'SortTable',
    props: base,
    steps: [
      { name: 'by_age', act: sortBy('age') },
      { name: 'by_status_desc', act: sortBy('status', true) },
      { name: 'by_rank', act: sortBy('rank') },
      { name: 'multi_on', act: () => globalThis.__setMulti(true) },
      { name: 'clear', act: () => globalThis.__setSorting([]) },
    ],
  },
];
