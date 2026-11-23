// Reduced stand-ins for clsx and the parts of @rc-component/util that the steps use.
export function clsx(...args) {
  const parts = [];
  for (const arg of args) {
    if (typeof arg === 'string' && arg) {
      parts.push(arg);
    } else if (Array.isArray(arg)) {
      parts.push(clsx(...arg));
    } else if (arg && typeof arg === 'object') {
      for (const [key, on] of Object.entries(arg)) {
        if (on) {
          parts.push(key);
        }
      }
    }
  }
  return parts.join(' ');
}

export function isNonNullable(value) {
  return value !== undefined && value !== null;
}

const ATTRS = ['id', 'role', 'title', 'tabIndex', 'lang', 'dir'];

// `false` picks every kind, as in @rc-component/util.
export function pickAttrs(props, ariaOnly = false) {
  const config =
    ariaOnly === false
      ? { aria: true, data: true, attr: true }
      : ariaOnly === true
        ? { aria: true }
        : ariaOnly;
  const picked = {};
  for (const key of Object.keys(props)) {
    if (
      (config.aria && (key === 'role' || key.startsWith('aria-'))) ||
      (config.data && key.startsWith('data-')) ||
      (config.attr && ATTRS.includes(key))
    ) {
      picked[key] = props[key];
    }
  }
  return picked;
}
