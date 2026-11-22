let current;

// Makes a resource whose promise stays pending until `resolveResource` runs.
// The latest resource is kept so a later step can reuse or resolve it.
export function makeResource(pending) {
  let release;
  const promise = pending
    ? new Promise((resolve) => {
        release = resolve;
      })
    : Promise.resolve('v');
  current = { promise, resolve: () => release?.('v') };
  return current;
}

export function getResource() {
  return current;
}

export function resolveResource() {
  current.resolve();
}
