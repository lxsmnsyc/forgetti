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

// Stands in for the @heroicons/react outline icons.
export function PlusIcon({ className }) {
  return <svg className={className} aria-hidden="true" data-icon="plus" />;
}

export function ShoppingCartIcon({ className }) {
  return <svg className={className} aria-hidden="true" data-icon="cart" />;
}
