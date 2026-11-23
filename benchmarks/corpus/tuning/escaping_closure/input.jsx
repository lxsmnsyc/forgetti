import { bump, Child } from '../../shared/counter.js';

function label(value) {
  bump('label');
  return `<${value}>`;
}

// A local helper that builds elements and is called once per row. It changes nothing it captures.
export function Rows({ names, prefix, onPick }) {
  const tag = (name) => <i>{label(name)}</i>;
  const row = (name, index) => (
    <li key={name} onClick={() => onPick(index)}>
      {prefix}
      {tag(name)}
    </li>
  );
  return (
    <ul>
      {row(names[0], 0)}
      {row(names[1], 1)}
      {row(names[2], 2)}
    </ul>
  );
}

function validate(values) {
  bump('validate');
  const errors = {};
  for (const name of Object.keys(values)) {
    if (!values[name]) {
      errors[name] = 'required';
    }
  }
  return errors;
}

// The helper renders one field per call, and the error count passes the result to Object.keys.
export function Check({ values, label }) {
  const errors = validate(values);
  const count = Object.keys(errors).length;
  const field = (name) => (
    <p>
      {name}: {errors[name] || 'ok'}
    </p>
  );
  return (
    <form>
      <b>{label}</b>
      {field('a')}
      {field('b')}
      <Child v={`${count} invalid`} />
    </form>
  );
}

// The helper is a closure over a closure, called with a value read from state-like props.
export function Pair({ left, right, join }) {
  const wrap = (side) => <Child v={`${side}${join}`} />;
  const show = (side) => <div>{wrap(side)}</div>;
  return (
    <section>
      {show(left)}
      {show(right)}
    </section>
  );
}
