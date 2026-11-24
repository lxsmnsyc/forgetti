import { phases } from '../../shared/scenarios.js';

const settings = [
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'bluetooth', label: 'Bluetooth' },
  { id: 'location', label: 'Location' },
];
const base = { settings, locked: false, defaultValues: { wifi: true } };
const panel = () => globalThis.__switch;

function dispatchOn(index, event) {
  const buttons = panel().root.querySelectorAll('button');
  buttons[index].dispatchEvent(event);
}

export default [
  ...phases('SettingsPanel', base, {
    same_settings: { ...base, settings: [...settings] },
    locked: { ...base, locked: true },
    fewer: { ...base, settings: settings.slice(0, 2) },
  }),
  {
    name: 'toggle',
    component: 'SettingsPanel',
    props: base,
    steps: [
      {
        name: 'click_bluetooth',
        act: () => dispatchOn(1, new MouseEvent('click', { bubbles: true })),
      },
      { name: 'click_wifi', act: () => dispatchOn(0, new MouseEvent('click', { bubbles: true })) },
      {
        name: 'right_location',
        act: () =>
          dispatchOn(2, new KeyboardEvent('keydown', { bubbles: true, keyCode: 39, which: 39 })),
      },
      {
        name: 'right_location_again',
        act: () =>
          dispatchOn(2, new KeyboardEvent('keydown', { bubbles: true, keyCode: 39, which: 39 })),
      },
    ],
  },
  {
    name: 'set_values',
    component: 'SettingsPanel',
    props: base,
    steps: [
      {
        name: 'all_on',
        act: () => panel().setValues({ wifi: true, bluetooth: true, location: true }),
      },
      { name: 'rerender', props: { ...base } },
    ],
  },
];
