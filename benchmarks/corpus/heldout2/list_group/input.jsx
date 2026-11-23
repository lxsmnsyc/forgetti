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

// Stands in for the `classnames` package.
function classNames(...args) {
  const parts = [];
  for (const arg of args) {
    if (typeof arg === 'string' && arg) {
      parts.push(arg);
    }
  }
  return parts.join(' ');
}

// @restart/hooks useCommittedRef and useEventCallback
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

// `uncontrollable` useUncontrolled, reduced to the activeKey and onSelect pair.
function useUncontrolled(props, { activeKey: handler }) {
  const { defaultActiveKey, ...rest } = props;
  const [state, setState] = useState(defaultActiveKey);
  const isControlled = props.activeKey !== undefined;
  const onSelect = (...args) => {
    if (!isControlled) {
      setState(args[0]);
    }
    props[handler]?.(...args);
  };
  return { ...rest, activeKey: isControlled ? props.activeKey : state, [handler]: onSelect };
}

// @restart/ui NavContext, makeEventKey, useNavItem and Nav, reduced to the selection logic.
const NavContext = createContext(null);

function makeEventKey(eventKey, href = null) {
  if (eventKey != null) {
    return String(eventKey);
  }
  return href || null;
}

function useNavItem({ key, onClick, active, disabled, ...props }) {
  const parent = useContext(NavContext);
  const isActive = active == null && key != null ? parent?.activeKey === key : active;

  const handleClick = (event) => {
    if (disabled) {
      return;
    }
    onClick?.(event);
    if (key != null) {
      parent?.onSelect?.(key, event);
    }
  };

  return [{ ...props, role: parent ? 'option' : undefined, onClick: handleClick }, { isActive }];
}

const BaseNav = forwardRef(({ as: Component = 'div', activeKey, onSelect, ...props }, ref) => {
  const context = useMemo(() => ({ activeKey, onSelect }), [activeKey, onSelect]);
  return (
    <NavContext.Provider value={context}>
      <Component ref={ref} role="listbox" {...props} />
    </NavContext.Provider>
  );
});

// ListGroupItem.tsx
const ListGroupItem = forwardRef(
  ({ bsPrefix, active, disabled, eventKey, className, variant, action, as, ...props }, ref) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'list-group-item');
    const [navItemProps, meta] = useNavItem({
      key: makeEventKey(eventKey, props.href),
      active,
      ...props,
    });

    const handleClick = useEventCallback((event) => {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      navItemProps.onClick(event);
    });

    if (disabled && props.tabIndex === undefined) {
      props.tabIndex = -1;
      props['aria-disabled'] = true;
    }

    const Component = as || (action ? (props.href ? 'a' : 'button') : 'div');

    return (
      <Component
        ref={ref}
        {...props}
        {...navItemProps}
        onClick={handleClick}
        className={classNames(
          className,
          bsPrefix,
          meta.isActive && 'active',
          disabled && 'disabled',
          variant && `${bsPrefix}-${variant}`,
          action && `${bsPrefix}-action`,
        )}
      />
    );
  },
);
ListGroupItem.displayName = 'ListGroupItem';

// ListGroup.tsx
const ListGroup = forwardRef((props, ref) => {
  const {
    className,
    bsPrefix: initialBsPrefix,
    variant,
    horizontal,
    numbered,
    as = 'div',
    ...controlledProps
  } = useUncontrolled(props, {
    activeKey: 'onSelect',
  });

  const bsPrefix = useBootstrapPrefix(initialBsPrefix, 'list-group');

  let horizontalVariant;
  if (horizontal) {
    horizontalVariant = horizontal === true ? 'horizontal' : `horizontal-${horizontal}`;
  }

  return (
    <BaseNav
      ref={ref}
      {...controlledProps}
      as={as}
      className={classNames(
        className,
        bsPrefix,
        variant && `${bsPrefix}-${variant}`,
        horizontalVariant && `${bsPrefix}-${horizontalVariant}`,
        numbered && `${bsPrefix}-numbered`,
      )}
    />
  );
});
ListGroup.displayName = 'ListGroup';

const Preview = memo(function Preview({ message }) {
  bump('Row');
  return <article>{message ? message.body : 'Nothing selected'}</article>;
});

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function countUnread(messages) {
  bump('unread');
  let count = 0;
  for (const message of messages) {
    if (message.unread) {
      count += 1;
    }
  }
  return count;
}

// Harness entry: a mailbox list with a preview of the selected message.
export function Inbox({ messages, defaultActiveKey, isControlled, variant, horizontal }) {
  const [selected, setSelected] = useState(defaultActiveKey);

  const unread = useMemo(() => countUnread(messages), [messages]);

  useEffect(() => {
    globalThis.__inbox = { select: setSelected };
  });

  const current = messages.find((message) => message.id === selected);
  const listProps = isControlled
    ? { activeKey: selected, onSelect: setSelected }
    : { defaultActiveKey };

  return (
    <section>
      <h2>Inbox ({unread})</h2>
      <ListGroup {...listProps} variant={variant} horizontal={horizontal}>
        {messages.map((message) => (
          <ListGroupItem
            key={message.id}
            eventKey={message.id}
            action
            disabled={message.locked}
            variant={message.unread ? 'primary' : undefined}
          >
            {message.title}
          </ListGroupItem>
        ))}
      </ListGroup>
      <Preview message={current} />
    </section>
  );
}
