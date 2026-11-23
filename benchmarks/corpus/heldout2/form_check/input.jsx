import {
  createContext,
  forwardRef,
  isValidElement,
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

// ElementChildren.tsx, with Children.toArray replaced because the harness maps Children to no Preact export.
function hasChildOfType(children, type) {
  const list = Array.isArray(children) ? children : [children];
  return list.some((el) => isValidElement(el) && el.type === type);
}

// FormContext.tsx
const FormContext = createContext({});

// Feedback.tsx
const Feedback = forwardRef(
  ({ as: Component = 'div', className, type = 'valid', tooltip = false, ...props }, ref) => (
    <Component
      {...props}
      ref={ref}
      className={classNames(className, `${type}-${tooltip ? 'tooltip' : 'feedback'}`)}
    />
  ),
);
Feedback.displayName = 'Feedback';

// FormCheckInput.tsx
const FormCheckInput = forwardRef(
  (
    {
      id,
      bsPrefix,
      className,
      type = 'checkbox',
      isValid = false,
      isInvalid = false,
      as: Component = 'input',
      ...props
    },
    ref,
  ) => {
    const { controlId } = useContext(FormContext);
    bsPrefix = useBootstrapPrefix(bsPrefix, 'form-check-input');

    return (
      <Component
        {...props}
        ref={ref}
        type={type}
        id={id || controlId}
        className={classNames(
          className,
          bsPrefix,
          isValid && 'is-valid',
          isInvalid && 'is-invalid',
        )}
      />
    );
  },
);
FormCheckInput.displayName = 'FormCheckInput';

// FormCheckLabel.tsx
const FormCheckLabel = forwardRef(({ bsPrefix, className, htmlFor, ...props }, ref) => {
  const { controlId } = useContext(FormContext);
  bsPrefix = useBootstrapPrefix(bsPrefix, 'form-check-label');
  bump('Child');

  return (
    <label
      {...props}
      ref={ref}
      htmlFor={htmlFor || controlId}
      className={classNames(className, bsPrefix)}
    />
  );
});
FormCheckLabel.displayName = 'FormCheckLabel';

// FormCheck.tsx
const FormCheck = forwardRef(
  (
    {
      id,
      bsPrefix,
      bsSwitchPrefix,
      inline = false,
      reverse = false,
      disabled = false,
      isValid = false,
      isInvalid = false,
      feedbackTooltip = false,
      feedback,
      feedbackType,
      className,
      style,
      title = '',
      type = 'checkbox',
      label,
      children,
      as = 'input',
      ...props
    },
    ref,
  ) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'form-check');
    bsSwitchPrefix = useBootstrapPrefix(bsSwitchPrefix, 'form-switch');

    const { controlId } = useContext(FormContext);
    const innerFormContext = useMemo(
      () => ({
        controlId: id || controlId,
      }),
      [controlId, id],
    );

    const hasLabel =
      (!children && label != null && label !== false) || hasChildOfType(children, FormCheckLabel);

    const input = (
      <FormCheckInput
        {...props}
        type={type === 'switch' ? 'checkbox' : type}
        ref={ref}
        isValid={isValid}
        isInvalid={isInvalid}
        disabled={disabled}
        as={as}
      />
    );

    return (
      <FormContext.Provider value={innerFormContext}>
        <div
          style={style}
          className={classNames(
            className,
            hasLabel && bsPrefix,
            inline && `${bsPrefix}-inline`,
            reverse && `${bsPrefix}-reverse`,
            type === 'switch' && bsSwitchPrefix,
          )}
        >
          {children || (
            <>
              {input}
              {hasLabel && <FormCheckLabel title={title}>{label}</FormCheckLabel>}
              {feedback && (
                <Feedback type={feedbackType} tooltip={feedbackTooltip}>
                  {feedback}
                </Feedback>
              )}
            </>
          )}
        </div>
      </FormContext.Provider>
    );
  },
);
FormCheck.displayName = 'FormCheck';

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function summarize(options, selected) {
  bump('summary');
  const names = [];
  for (const option of options) {
    if (selected.includes(option.id)) {
      names.push(option.label);
    }
  }
  return names.join(', ');
}

// Harness entry: a group of checks that a form would render from a list of options.
export function CheckGroup({ options, selected: initial, controlId, disabledKeys, type, inline }) {
  const [selected, setSelected] = useState(initial);

  const summary = useMemo(() => summarize(options, selected), [options, selected]);

  const groupContext = useMemo(() => ({ controlId }), [controlId]);

  useEffect(() => {
    globalThis.__checks = {
      toggle(id) {
        setSelected((current) =>
          current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
        );
      },
      clear() {
        setSelected([]);
      },
    };
  });

  return (
    <FormContext.Provider value={groupContext}>
      <div role="group">
        {options.map((option) => (
          <FormCheck
            key={option.id}
            id={`${controlId}-${option.id}`}
            type={type}
            inline={inline}
            name={controlId}
            label={option.label}
            checked={selected.includes(option.id)}
            disabled={disabledKeys.includes(option.id)}
            isInvalid={option.required && !selected.includes(option.id)}
            feedback={option.required && !selected.includes(option.id) ? 'Required' : undefined}
            feedbackType="invalid"
            onChange={() => globalThis.__checks.toggle(option.id)}
          />
        ))}
        <p>{summary}</p>
      </div>
    </FormContext.Provider>
  );
}
