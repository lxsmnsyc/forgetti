import { phases } from '../../shared/scenarios.js';

const initial = [
  { id: 1, level: 'info', title: 'Saved', text: 'Draft saved' },
  { id: 2, level: 'error', title: 'Failed', text: 'Upload failed' },
];
const base = { initial, autohide: false, delay: 60000, bg: undefined };
const stack = () => globalThis.__toasts;

export default [
  ...phases(
    'ToastStack',
    base,
    {
      same_initial: { ...base, initial: [...initial] },
      autohide: { ...base, autohide: true },
      new_delay: { ...base, delay: 30000 },
      bg: { ...base, bg: 'warning' },
    },
    { context: { name: 'ThemeContext', value: { prefixes: {} } } },
  ),
  {
    name: 'timer',
    component: 'ToastStack',
    props: { ...base, autohide: true },
    steps: [
      { name: 'same_timer' },
      { name: 'delay', props: { ...base, autohide: true, delay: 90000 } },
      { name: 'stop_autohide', props: base },
    ],
  },
  {
    name: 'edits',
    component: 'ToastStack',
    props: base,
    steps: [
      {
        name: 'add',
        act: () => stack().add({ id: 3, level: 'info', title: 'Sync', text: 'Synced' }),
      },
      { name: 'dismiss', act: () => stack().dismiss(2) },
      { name: 'mute', act: () => stack().setMuted(true) },
      { name: 'mute_again', act: () => stack().setMuted(true) },
      { name: 'unmute', act: () => stack().setMuted(false) },
    ],
  },
];
