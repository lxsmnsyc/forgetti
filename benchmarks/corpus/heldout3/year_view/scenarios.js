import { phases } from '../../shared/scenarios.js';

const activeStartDate = new Date(2019, 0, 1);
const base = {
  activeStartDate,
  initialValue: new Date(2019, 4, 15),
  locale: 'en-US',
  selectRange: false,
};
const months = () => globalThis.__months;
const quarterStart = ({ date }) => (date.getMonth() % 3 === 0 ? 'quarter' : null);
const winter = ({ date }) => date.getMonth() === 11 || date.getMonth() < 2;
const shortMonth = (locale, date) => date.toLocaleString(locale, { month: 'short' });

function clickMonth(index) {
  const tiles = months().root.querySelectorAll('button');
  tiles[index].dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

export default [
  ...phases('MonthPicker', base, {
    same_start: { ...base, activeStartDate: new Date(2019, 0, 1) },
    next_year: { ...base, activeStartDate: new Date(2020, 0, 1) },
    locale: { ...base, locale: 'de-DE' },
    min_max: { ...base, minDate: new Date(2019, 2, 10), maxDate: new Date(2019, 9, 1) },
    class_fn: { ...base, tileClassName: quarterStart },
    content: { ...base, tileContent: 'note' },
    disabled_fn: { ...base, tileDisabled: winter },
    format_month: { ...base, formatMonth: shortMonth },
  }),
  {
    name: 'click',
    component: 'MonthPicker',
    props: base,
    steps: [
      { name: 'click_march', act: () => clickMonth(2) },
      { name: 'click_march_again', act: () => clickMonth(2) },
      { name: 'click_december', act: () => clickMonth(11) },
    ],
  },
  {
    name: 'range',
    component: 'MonthPicker',
    props: { ...base, selectRange: true },
    steps: [
      { name: 'hover_august', act: () => months().setHover(new Date(2019, 7, 1)) },
      { name: 'click_august', act: () => clickMonth(7) },
      { name: 'clear', act: () => months().setValue(null) },
    ],
  },
];
