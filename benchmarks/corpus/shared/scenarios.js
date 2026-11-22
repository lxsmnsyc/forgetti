// Builds the scenarios of a case from a base props object and named variants.
// Each scenario mounts `base`, resets the counters, then runs one update step.
// `base` and every variant may be a function, called once per use, for cases
// that mutate their props.
export function phases(component, base, variants, options = {}) {
  const scenarios = [
    { name: 'same', component, props: base, context: options.context, steps: [{ name: 'same' }] },
  ];
  for (const [name, props] of Object.entries(variants)) {
    scenarios.push({
      name,
      component,
      props: base,
      context: options.context,
      steps: [{ name, props }],
    });
  }
  if (options.state) {
    scenarios.push({
      name: 'setState',
      component,
      props: base,
      steps: [{ name: 'setState', act: () => globalThis.__setN(1) }],
    });
  }
  return scenarios;
}
