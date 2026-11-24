import { phases } from '../../shared/scenarios.js';

const noon = new Date(2024, 4, 10, 12, 15, 30, 250);
const base = {
  initialValue: noon,
  locale: 'en-US',
  size: 150,
  renderNumbers: false,
  className: 'sample-clock',
};
const clock = () => globalThis.__clock;
const twoDigits = (locale, hour) => String(hour).padStart(2, '0');

export default [
  ...phases('ClockSample', base, {
    same_value: { ...base, initialValue: new Date(noon.getTime()) },
    bigger: { ...base, size: 300 },
    no_second_hand: { ...base, renderSecondHand: false },
    long_marks: { ...base, hourMarksLength: 20, minuteMarksWidth: 2 },
    format_hour: { ...base, formatHour: twoDigits, renderNumbers: true },
    millis: { ...base, useMillisecondPrecision: true },
  }),
  {
    name: 'tick',
    component: 'ClockSample',
    props: base,
    steps: [
      { name: 'next_second', act: () => clock().setValue(new Date(2024, 4, 10, 12, 15, 31)) },
      { name: 'same_time', act: () => clock().setValue(new Date(2024, 4, 10, 12, 15, 31)) },
      { name: 'next_hour', act: () => clock().setValue(new Date(2024, 4, 10, 13, 0, 0)) },
      { name: 'string_value', act: () => clock().setValue('08:30:15') },
    ],
  },
  {
    name: 'numbers',
    component: 'ClockSample',
    props: base,
    steps: [
      { name: 'show_numbers', act: () => clock().setRenderNumbers(true) },
      { name: 'rerender', props: { ...base } },
      { name: 'hide_numbers', act: () => clock().setRenderNumbers(false) },
    ],
  },
];
