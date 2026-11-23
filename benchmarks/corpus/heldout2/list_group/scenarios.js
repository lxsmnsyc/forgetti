import { phases } from '../../shared/scenarios.js';

const messages = [
  { id: 'm1', title: 'Welcome', body: 'Hello there', unread: true },
  { id: 'm2', title: 'Invoice', body: 'Amount due', unread: false },
  { id: 'm3', title: 'Archived', body: 'Old thread', unread: false, locked: true },
];
const base = {
  messages,
  defaultActiveKey: 'm1',
  isControlled: true,
  variant: undefined,
  horizontal: false,
};
const inbox = () => globalThis.__inbox;
const theme = { name: 'ThemeContext', value: { prefixes: {} } };

export default [
  ...phases(
    'Inbox',
    base,
    {
      same_messages: { ...base, messages: [...messages] },
      flush: { ...base, variant: 'flush' },
      horizontal: { ...base, horizontal: 'md' },
      uncontrolled: { ...base, isControlled: false },
      fewer: { ...base, messages: messages.slice(0, 2) },
    },
    { context: theme },
  ),
  {
    name: 'theme',
    component: 'Inbox',
    props: base,
    context: theme,
    steps: [
      { name: 'same_theme', context: { prefixes: {} } },
      { name: 'new_prefix', context: { prefixes: { 'list-group': 'lg' } } },
    ],
  },
  {
    name: 'select',
    component: 'Inbox',
    props: base,
    context: theme,
    steps: [
      { name: 'pick_m2', act: () => inbox().select('m2') },
      { name: 'pick_m2_again', act: () => inbox().select('m2') },
      { name: 'pick_m3', act: () => inbox().select('m3') },
      { name: 'pick_none', act: () => inbox().select(undefined) },
    ],
  },
];
