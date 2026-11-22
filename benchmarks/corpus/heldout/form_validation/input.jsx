import { useState, useEffect, useCallback } from 'react';
import { bump, Btn, Child } from '../../shared/counter.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Rules follow the registerWithErrorMessages example: required, length limits and a pattern.
const RULES = {
  firstName: { required: 'First name is required', maxLength: 80 },
  lastName: { required: 'Last name is required', maxLength: 100 },
  email: { required: 'Email is required', pattern: EMAIL },
  mobileNumber: { required: true, minLength: 8, maxLength: 11 },
  title: { required: 'Pick a title' },
  developer: { required: 'Answer the question' },
};

export function validateField(name, value, rules) {
  bump('validate');
  const rule = rules[name];
  if (!rule) {
    return null;
  }
  const text = value === undefined || value === null ? '' : String(value);
  if (rule.required && text.trim() === '') {
    return typeof rule.required === 'string' ? rule.required : `${name} is required`;
  }
  if (rule.maxLength && text.length > rule.maxLength) {
    return `At most ${rule.maxLength} characters`;
  }
  if (rule.minLength && text.length > 0 && text.length < rule.minLength) {
    return `At least ${rule.minLength} characters`;
  }
  if (rule.pattern && text.length > 0 && !rule.pattern.test(text)) {
    return 'Invalid format';
  }
  return null;
}

function validateAll(values, rules) {
  const errors = {};
  for (const name of Object.keys(rules)) {
    const message = validateField(name, values[name], rules);
    if (message) {
      errors[name] = message;
    }
  }
  return errors;
}

function Field({ name, label, error, touched, children }) {
  const showError = touched && error;
  return (
    <div className={showError ? 'field invalid' : 'field'}>
      <label htmlFor={name}>{label}</label>
      {children}
      {showError ? <span role="alert">{error}</span> : null}
    </div>
  );
}

export function SignupForm({ defaults, rules, mode, onSubmit }) {
  const [values, setValues] = useState(() => ({ title: 'Mr', ...defaults }));
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(0);
  const activeRules = rules || RULES;

  const errors = validateAll(values, activeRules);
  const invalidCount = Object.keys(errors).length;

  useEffect(() => {
    globalThis.__form = { setValues, setTouched, setSubmitted };
  }, []);

  const change = useCallback((name, value) => {
    setValues((old) => ({ ...old, [name]: value }));
    if (mode === 'onChange') {
      setTouched((old) => ({ ...old, [name]: true }));
    }
  }, [mode]);

  const blur = (name) => setTouched((old) => ({ ...old, [name]: true }));

  const submit = (event) => {
    if (event) {
      event.preventDefault();
    }
    // A submit marks every field as touched so all errors show.
    const all = {};
    for (const name of Object.keys(activeRules)) {
      all[name] = true;
    }
    setTouched(all);
    setSubmitted((n) => n + 1);
    if (invalidCount === 0 && onSubmit) {
      onSubmit(values);
    }
  };

  const text = (name, label, type = 'text') => (
    <Field name={name} label={label} error={errors[name]} touched={touched[name]}>
      <input
        id={name}
        type={type}
        value={values[name] || ''}
        onChange={(e) => change(name, e.target.value)}
        onBlur={() => blur(name)}
      />
    </Field>
  );

  return (
    <form onSubmit={submit}>
      {text('firstName', 'First name')}
      {text('lastName', 'Last name')}
      {text('email', 'Email')}
      {text('mobileNumber', 'Mobile number', 'tel')}
      <Field name="title" label="Title" error={errors.title} touched={touched.title}>
        <select id="title" value={values.title} onChange={(e) => change('title', e.target.value)}>
          {['Mr', 'Mrs', 'Miss', 'Dr'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend>Are you a developer?</legend>
        {['Yes', 'No'].map((answer) => (
          <label key={answer}>
            <input
              type="radio"
              name="developer"
              value={answer}
              checked={values.developer === answer}
              onChange={() => change('developer', answer)}
            />
            {answer}
          </label>
        ))}
        {touched.developer && errors.developer ? <span role="alert">{errors.developer}</span> : null}
      </fieldset>
      <Btn onClick={submit} label="Submit" />
      <Child v={`${invalidCount} invalid, ${submitted} submits`} />
    </form>
  );
}
