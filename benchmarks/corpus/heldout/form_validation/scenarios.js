import { phases } from '../../shared/scenarios.js';

const defaults = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' };
const base = { defaults, rules: undefined, mode: 'onBlur', onSubmit: undefined };
const form = () => globalThis.__form;

export default [
  ...phases('SignupForm', base, {
    new_defaults: { ...base, defaults: { ...defaults } },
    one_mode: { ...base, mode: 'onChange' },
    new_submit: { ...base, onSubmit: () => {} },
  }),
  {
    name: 'typing',
    component: 'SignupForm',
    props: base,
    steps: [
      { name: 'bad_email', act: () => form().setValues((v) => ({ ...v, email: 'nope' })) },
      { name: 'touch_email', act: () => form().setTouched({ email: true }) },
      { name: 'fix_email', act: () => form().setValues((v) => ({ ...v, email: 'a@b.co' })) },
      { name: 'long_phone', act: () => form().setValues((v) => ({ ...v, mobileNumber: '123' })) },
      { name: 'submit', act: () => form().setSubmitted((n) => n + 1) },
    ],
  },
];
