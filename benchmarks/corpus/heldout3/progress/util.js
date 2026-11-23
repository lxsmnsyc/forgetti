import { useState } from 'react';

// Stands in for the `clsx` package.
export function clsx(...args) {
  const parts = [];
  for (const arg of args) {
    if (typeof arg === 'string' && arg) {
      parts.push(arg);
    }
  }
  return parts.join(' ');
}

// @rc-component/util useId, reduced to its counter fallback so React and Preact print the
// same ids.
let uuid = 0;

export function useId(id) {
  const [innerId] = useState(() => {
    uuid += 1;
    return `rc_unique_${uuid}`;
  });
  return id || innerId;
}
