import { phases } from '../../shared/scenarios.js';

const items = [
  { id: 'q1', question: 'How do I start', answer: 'Run install' },
  { id: 'q2', question: 'How do I stop', answer: 'Press stop' },
  { id: 'q3', question: 'Where are the docs', answer: 'On the site' },
];
const base = {
  items,
  isControlled: true,
  defaultActiveKey: 'q1',
  alwaysOpen: false,
  flush: false,
  query: '',
};
const faq = () => globalThis.__faq;
const theme = { name: 'ThemeContext', value: { prefixes: {} } };

export default [
  ...phases(
    'Faq',
    base,
    {
      same_items: { ...base, items: [...items] },
      flush: { ...base, flush: true },
      always_open: { ...base, alwaysOpen: true, defaultActiveKey: ['q1'] },
      uncontrolled: { ...base, isControlled: false },
      query: { ...base, query: 'how' },
      query_none: { ...base, query: 'zzz' },
    },
    { context: theme },
  ),
  {
    name: 'theme',
    component: 'Faq',
    props: base,
    context: theme,
    steps: [
      { name: 'same_theme', context: { prefixes: {} } },
      { name: 'new_prefix', context: { prefixes: { accordion: 'acc' } } },
    ],
  },
  {
    name: 'open',
    component: 'Faq',
    props: base,
    context: theme,
    steps: [
      { name: 'open_q2', act: () => faq().open('q2') },
      { name: 'open_q2_again', act: () => faq().open('q2') },
      { name: 'close', act: () => faq().open(null) },
    ],
  },
  {
    name: 'open_many',
    component: 'Faq',
    props: { ...base, alwaysOpen: true, defaultActiveKey: ['q1'] },
    context: theme,
    steps: [
      { name: 'add_q3', act: () => faq().open(['q1', 'q3']) },
      {
        name: 'filter',
        props: { ...base, alwaysOpen: true, defaultActiveKey: ['q1'], query: 'stop' },
      },
    ],
  },
];
