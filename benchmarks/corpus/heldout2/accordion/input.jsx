import {
  createContext,
  forwardRef,
  memo,
  useContext,
  useEffect,
  useMemo,
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

// AccordionContext.tsx
function isAccordionItemSelected(activeEventKey, eventKey) {
  return Array.isArray(activeEventKey)
    ? activeEventKey.includes(eventKey)
    : activeEventKey === eventKey;
}

const AccordionContext = createContext({});
const AccordionItemContext = createContext({ eventKey: '' });

// AccordionButton.tsx
function useAccordionButton(eventKey, onClick) {
  const { activeEventKey, onSelect, alwaysOpen } = useContext(AccordionContext);

  return (e) => {
    // Same key as the context: collapse. Otherwise select it.
    let eventKeyPassed = eventKey === activeEventKey ? null : eventKey;
    if (alwaysOpen) {
      if (Array.isArray(activeEventKey)) {
        if (activeEventKey.includes(eventKey)) {
          eventKeyPassed = activeEventKey.filter((k) => k !== eventKey);
        } else {
          eventKeyPassed = [...activeEventKey, eventKey];
        }
      } else {
        // activeEventKey is undefined.
        eventKeyPassed = [eventKey];
      }
    }

    onSelect?.(eventKeyPassed, e);
    onClick?.(e);
  };
}

const AccordionButton = forwardRef(
  ({ as: Component = 'button', bsPrefix, className, onClick, ...props }, ref) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'accordion-button');
    const { eventKey } = useContext(AccordionItemContext);
    const accordionOnClick = useAccordionButton(eventKey, onClick);
    const { activeEventKey } = useContext(AccordionContext);

    if (Component === 'button') {
      props.type = 'button';
    }

    return (
      <Component
        ref={ref}
        onClick={accordionOnClick}
        {...props}
        aria-expanded={
          Array.isArray(activeEventKey) ? activeEventKey.includes(eventKey) : eventKey === activeEventKey
        }
        className={classNames(
          className,
          bsPrefix,
          !isAccordionItemSelected(activeEventKey, eventKey) && 'collapsed',
        )}
      />
    );
  },
);
AccordionButton.displayName = 'AccordionButton';

// AccordionHeader.tsx
const AccordionHeader = forwardRef(
  ({ as: Component = 'h2', bsPrefix, className, children, onClick, ...props }, ref) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'accordion-header');
    return (
      <Component ref={ref} {...props} className={classNames(className, bsPrefix)}>
        <AccordionButton onClick={onClick}>{children}</AccordionButton>
      </Component>
    );
  },
);
AccordionHeader.displayName = 'AccordionHeader';

// AccordionCollapse.tsx and AccordionBody.tsx, without the Collapse transition.
const AccordionBody = forwardRef(
  ({ as: Component = 'div', bsPrefix, className, ...props }, ref) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'accordion-body');
    const { eventKey } = useContext(AccordionItemContext);
    const { activeEventKey } = useContext(AccordionContext);
    const show = isAccordionItemSelected(activeEventKey, eventKey);

    return (
      <div className={classNames('accordion-collapse', 'collapse', show && 'show')}>
        <Component ref={ref} {...props} className={classNames(className, bsPrefix)} />
      </div>
    );
  },
);
AccordionBody.displayName = 'AccordionBody';

// AccordionItem.tsx
const AccordionItem = forwardRef(
  ({ as: Component = 'div', bsPrefix, className, eventKey, ...props }, ref) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'accordion-item');
    const contextValue = useMemo(() => ({ eventKey }), [eventKey]);

    return (
      <AccordionItemContext.Provider value={contextValue}>
        <Component ref={ref} {...props} className={classNames(className, bsPrefix)} />
      </AccordionItemContext.Provider>
    );
  },
);
AccordionItem.displayName = 'AccordionItem';

// Accordion.tsx
const Accordion = forwardRef((props, ref) => {
  const {
    as: Component = 'div',
    activeKey,
    bsPrefix,
    className,
    onSelect,
    flush,
    alwaysOpen,
    ...controlledProps
  } = useUncontrolled(props, {
    activeKey: 'onSelect',
  });

  const prefix = useBootstrapPrefix(bsPrefix, 'accordion');
  const contextValue = useMemo(
    () => ({
      activeEventKey: activeKey,
      onSelect,
      alwaysOpen,
    }),
    [activeKey, onSelect, alwaysOpen],
  );

  return (
    <AccordionContext.Provider value={contextValue}>
      <Component
        ref={ref}
        {...controlledProps}
        className={classNames(className, prefix, flush && `${prefix}-flush`)}
      />
    </AccordionContext.Provider>
  );
});
Accordion.displayName = 'Accordion';

const Answer = memo(function Answer({ text }) {
  bump('Row');
  return <p>{text}</p>;
});

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function findMatches(items, query) {
  bump('matches');
  const lower = query.toLowerCase();
  const found = [];
  for (const item of items) {
    if (item.question.toLowerCase().includes(lower)) {
      found.push(item);
    }
  }
  return found;
}

// Harness entry: a list of questions, controlled or uncontrolled.
export function Faq({ items, isControlled, defaultActiveKey, alwaysOpen, flush, query }) {
  const [active, setActive] = useState(defaultActiveKey);

  const matches = useMemo(() => findMatches(items, query), [items, query]);

  useEffect(() => {
    globalThis.__faq = { open: setActive };
  });

  const accordionProps = isControlled
    ? { activeKey: active, onSelect: setActive }
    : { defaultActiveKey };

  return (
    <Accordion {...accordionProps} alwaysOpen={alwaysOpen} flush={flush}>
      {matches.map((item) => (
        <AccordionItem key={item.id} eventKey={item.id}>
          <AccordionHeader>{item.question}</AccordionHeader>
          <AccordionBody>
            <Answer text={item.answer} />
          </AccordionBody>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
