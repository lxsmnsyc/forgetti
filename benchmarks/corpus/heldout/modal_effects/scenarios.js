import { phases } from '../../shared/scenarios.js';

const options = ['light', 'dark', 'system'];
const base = { initialOpen: false, user: 'ada', options, closeOnClickOutside: true };
const dialog = () => globalThis.__dialog;

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

export default [
  ...phases('SettingsDialog', base, {
    new_user: { ...base, user: 'bo' },
    new_options: { ...base, options: [...options] },
    one_flag: { ...base, closeOnClickOutside: false },
  }),
  {
    name: 'open_mounted',
    component: 'SettingsDialog',
    props: { ...base, initialOpen: true },
    steps: [
      { name: 'same' },
      { name: 'new_user', props: { ...base, initialOpen: true, user: 'cy' } },
    ],
  },
  {
    name: 'open_close',
    component: 'SettingsDialog',
    props: base,
    steps: [
      { name: 'open', act: () => dialog().setOpen(true) },
      { name: 'select', act: () => dialog().setSelected('dark') },
      { name: 'escape', act: pressEscape },
      { name: 'reopen', act: () => dialog().setOpen(true) },
      { name: 'new_user_open', props: { ...base, user: 'di' } },
      { name: 'close', act: () => dialog().setOpen(false) },
    ],
  },
];
