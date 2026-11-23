import {
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { bump } from '../../shared/counter.js';

// ThemeProvider.tsx
export const ThemeContext = createContext({ prefixes: {} });

function useBootstrapPrefix(prefix, defaultPrefix) {
  const { prefixes } = useContext(ThemeContext);
  return prefix || prefixes[defaultPrefix] || defaultPrefix;
}

// Stands in for the `classnames` package. Objects map a class name to a flag.
function classNames(...args) {
  const parts = [];
  for (const arg of args) {
    if (typeof arg === 'string' && arg) {
      parts.push(arg);
    } else if (arg && typeof arg === 'object') {
      for (const name of Object.keys(arg)) {
        if (arg[name]) {
          parts.push(name);
        }
      }
    }
  }
  return parts.join(' ');
}

// @restart/hooks useEventCallback
function useEventCallback(fn) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  return useCallback(
    function (...args) {
      return ref.current && ref.current(...args);
    },
    [ref],
  );
}

// @restart/ui Anchor, reduced: an anchor without a real href acts as a button.
function isTrivialHref(href) {
  return !href || href.trim() === '#';
}

const Anchor = forwardRef(({ onKeyDown, onClick, ...props }, ref) => {
  const trivial = isTrivialHref(props.href);
  const handleClick = useEventCallback((event) => {
    if (trivial) {
      event.preventDefault();
    }
    onClick?.(event);
  });
  const handleKeyDown = useEventCallback((event) => {
    if (event.key === ' ' && trivial) {
      event.preventDefault();
    }
    onKeyDown?.(event);
  });

  return (
    <a
      ref={ref}
      {...props}
      role={trivial && !props.role ? 'button' : props.role}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  );
});
Anchor.displayName = 'Anchor';

// PageItem.tsx
const PageItem = forwardRef(
  (
    {
      active = false,
      disabled = false,
      className,
      style,
      activeLabel = '(current)',
      children,
      linkStyle,
      linkClassName,
      as = Anchor,
      ...props
    },
    ref,
  ) => {
    const Component = active || disabled ? 'span' : as;
    return (
      <li ref={ref} style={style} className={classNames(className, 'page-item', { active, disabled })}>
        <Component className={classNames('page-link', linkClassName)} style={linkStyle} {...props}>
          {children}
          {active && activeLabel && <span className="visually-hidden">{activeLabel}</span>}
        </Component>
      </li>
    );
  },
);
PageItem.displayName = 'PageItem';

function createButton(name, defaultValue, label = name) {
  const Button = forwardRef(({ children, ...props }, ref) => (
    <PageItem {...props} ref={ref}>
      <span aria-hidden="true">{children || defaultValue}</span>
      <span className="visually-hidden">{label}</span>
    </PageItem>
  ));

  Button.displayName = name;

  return Button;
}

const First = createButton('First', '«');
const Prev = createButton('Prev', '‹', 'Previous');
const Ellipsis = createButton('Ellipsis', '…', 'More');
const Next = createButton('Next', '›');
const Last = createButton('Last', '»');

// Pagination.tsx
const Pagination = forwardRef(({ bsPrefix, className, size, ...props }, ref) => {
  const decoratedBsPrefix = useBootstrapPrefix(bsPrefix, 'pagination');
  return (
    <ul
      ref={ref}
      {...props}
      className={classNames(
        className,
        decoratedBsPrefix,
        size && `${decoratedBsPrefix}-${size}`,
      )}
    />
  );
});
Pagination.displayName = 'Pagination';

const Summary = memo(function Summary({ from, to, total }) {
  bump('Row');
  return (
    <small>
      {from} to {to} of {total}
    </small>
  );
});

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function findWindow(page, pageCount, siblings) {
  bump('window');
  const first = Math.max(1, Math.min(page - siblings, pageCount - siblings * 2));
  const last = Math.min(pageCount, first + siblings * 2);
  const numbers = [];
  for (let n = first; n <= last; n += 1) {
    numbers.push(n);
  }
  return { first, last, numbers };
}

// Harness entry: a pager over a result list with a window of page links.
export function Pager({ total, pageSize, initialPage, size, siblings }) {
  const [page, setPage] = useState(initialPage);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const pages = useMemo(() => findWindow(page, pageCount, siblings), [page, pageCount, siblings]);

  useEffect(() => {
    globalThis.__pager = { go: setPage };
  });

  const go = (n) => setPage(Math.min(Math.max(1, n), pageCount));

  return (
    <nav aria-label="pages">
      <Pagination size={size}>
        <First disabled={page === 1} onClick={() => go(1)} />
        <Prev disabled={page === 1} onClick={() => go(page - 1)} />
        {pages.first > 1 && <Ellipsis disabled />}
        {pages.numbers.map((n) => (
          <PageItem key={n} active={n === page} onClick={() => go(n)}>
            {n}
          </PageItem>
        ))}
        {pages.last < pageCount && <Ellipsis disabled />}
        <Next disabled={page === pageCount} onClick={() => go(page + 1)} />
        <Last disabled={page === pageCount} onClick={() => go(pageCount)} />
      </Pagination>
      <Summary from={(page - 1) * pageSize + 1} to={Math.min(page * pageSize, total)} total={total} />
    </nav>
  );
}
