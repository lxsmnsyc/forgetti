// Stands in for the `clsx` package.
export default function clsx(...args) {
  const parts = [];
  for (const arg of args) {
    if (typeof arg === 'string' && arg) {
      parts.push(arg);
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

// lib/utils.ts
export const createUrl = (pathname, params) => {
  const paramsString = params.toString();
  const queryString = `${paramsString.length ? '?' : ''}${paramsString}`;

  return `${pathname}${queryString}`;
};

// Stands in for the @heroicons/react outline icon.
export function ChevronDownIcon({ className }) {
  return <svg className={className} aria-hidden="true" data-icon="chevron-down" />;
}
