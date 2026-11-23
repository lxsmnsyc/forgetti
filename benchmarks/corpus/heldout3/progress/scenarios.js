import { phases } from '../../shared/scenarios.js';

const base = { initialPercent: [30, 20], strokeWidth: 6, strokeColor: ['#87d068', '#108ee9'] };
const progress = () => globalThis.__progress;

export default [
  ...phases('UploadProgress', base, {
    same_colors: { ...base, strokeColor: ['#87d068', '#108ee9'] },
    wider: { ...base, strokeWidth: 10 },
    gap: { ...base, gapDegree: 70, gapPosition: 'top' },
    square: { ...base, strokeLinecap: 'square' },
    gradient: { ...base, strokeColor: { '0%': '#108ee9', '100%': '#87d068' } },
    steps: { ...base, steps: { count: 5, gap: 4 } },
    loading: { ...base, loading: true },
    class_names: { ...base, classNames: { track: 'track' }, styles: { rail: { opacity: 0.5 } } },
  }),
  {
    name: 'upload',
    component: 'UploadProgress',
    props: base,
    steps: [
      { name: 'grow', act: () => progress().setPercent([40, 30]) },
      { name: 'single', act: () => progress().setPercent(75) },
      { name: 'same_single', act: () => progress().setPercent(75) },
      { name: 'done', act: () => progress().setPercent(100) },
      { name: 'rerender', props: { ...base } },
    ],
  },
];
