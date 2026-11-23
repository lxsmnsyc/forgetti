import {
  createContext,
  forwardRef,
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

// @restart/hooks useCommittedRef, useEventCallback, useMounted
function useCommittedRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function useEventCallback(fn) {
  const ref = useCommittedRef(fn);
  return useCallback(
    function (...args) {
      return ref.current && ref.current(...args);
    },
    [ref],
  );
}

function useMounted() {
  const mounted = useRef(true);
  const isMounted = useRef(() => mounted.current);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return isMounted.current;
}

// @restart/hooks useTimeout
function useTimeout() {
  const [timeout, setTimeoutState] = useState(null);
  const isMounted = useMounted();
  const handleRef = useRef(null);

  useEffect(() => {
    if (!timeout) {
      return;
    }

    const { fn, delayMs } = timeout;

    function task() {
      if (isMounted()) {
        setTimeoutState(null);
      }
      fn();
    }

    handleRef.current = setTimeout(task, delayMs);
    const handle = handleRef.current;

    return () => {
      if (handleRef.current !== handle) {
        clearTimeout(handle);
      }
      clearTimeout(handleRef.current);
    };
  }, [timeout]);

  const isPending = !!timeout;

  return useMemo(() => {
    const set = (fn, delayMs = 0) => {
      if (isMounted()) {
        setTimeoutState({ fn, delayMs });
      }
    };
    return { set, clear: () => setTimeoutState(null), isPending, handleRef };
  }, [isPending, setTimeoutState, handleRef, isMounted]);
}

// CloseButton.tsx
const CloseButton = forwardRef(({ className, variant, 'aria-label': ariaLabel = 'Close', ...props }, ref) => (
  <button ref={ref} type="button" className={classNames('btn-close', variant && `btn-close-${variant}`, className)} aria-label={ariaLabel} {...props} />
));
CloseButton.displayName = 'CloseButton';

// ToastContext.tsx
const ToastContext = createContext({ onClose() {} });

// ToastHeader.tsx
const ToastHeader = forwardRef(
  (
    { bsPrefix, closeLabel = 'Close', closeVariant, closeButton = true, className, children, ...props },
    ref,
  ) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'toast-header');
    const context = useContext(ToastContext);

    const handleClick = useEventCallback((e) => {
      context?.onClose?.(e);
    });

    return (
      <div ref={ref} {...props} className={classNames(bsPrefix, className)}>
        {children}
        {closeButton && (
          <CloseButton
            aria-label={closeLabel}
            variant={closeVariant}
            onClick={handleClick}
            data-dismiss="toast"
          />
        )}
      </div>
    );
  },
);
ToastHeader.displayName = 'ToastHeader';

// ToastBody.tsx
const ToastBody = forwardRef(({ className, bsPrefix, as: Component = 'div', ...props }, ref) => {
  bsPrefix = useBootstrapPrefix(bsPrefix, 'toast-body');
  bump('Child');
  return <Component ref={ref} className={classNames(className, bsPrefix)} {...props} />;
});
ToastBody.displayName = 'ToastBody';

// Toast.tsx, without the transition branch.
const Toast = forwardRef(
  (
    { bsPrefix, className, show = true, delay = 5000, autohide = false, onClose, bg, ...props },
    ref,
  ) => {
    bsPrefix = useBootstrapPrefix(bsPrefix, 'toast');

    // Refs, so a new delay or onClose does not restart the autohide timer.
    const delayRef = useRef(delay);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
      delayRef.current = delay;
      onCloseRef.current = onClose;
    }, [delay, onClose]);

    const autohideTimeout = useTimeout();
    const autohideToast = !!(autohide && show);

    const autohideFunc = useCallback(() => {
      if (autohideToast) {
        onCloseRef.current?.();
      }
    }, [autohideToast]);

    useEffect(() => {
      autohideTimeout.set(autohideFunc, delayRef.current);
    }, [autohideTimeout, autohideFunc]);

    const toastContext = useMemo(() => ({ onClose }), [onClose]);

    return (
      <ToastContext.Provider value={toastContext}>
        <div
          {...props}
          ref={ref}
          className={classNames(bsPrefix, className, bg && `bg-${bg}`, show ? 'show' : 'hide')}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        />
      </ToastContext.Provider>
    );
  },
);
Toast.displayName = 'Toast';

function pickVisible(toasts, muted) {
  bump('visible');
  const list = [];
  for (const toast of toasts) {
    if (!(muted && toast.level === 'info')) {
      list.push(toast);
    }
  }
  return list;
}

// Harness entry: a stack of toasts that can be added and dismissed.
export function ToastStack({ initial, autohide, delay, bg }) {
  const [toasts, setToasts] = useState(initial);
  const [muted, setMuted] = useState(false);

  const visible = useMemo(() => pickVisible(toasts, muted), [toasts, muted]);

  useEffect(() => {
    globalThis.__toasts = {
      add(toast) {
        setToasts((current) => [...current, toast]);
      },
      dismiss(id) {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      },
      setMuted,
    };
  });

  return (
    <div className="toast-container">
      {visible.map((toast) => (
        <Toast
          key={toast.id}
          autohide={autohide}
          delay={delay}
          bg={bg}
          data-level={toast.level}
          onClose={() => globalThis.__toasts.dismiss(toast.id)}
        >
          <ToastHeader>
            <strong>{toast.title}</strong>
          </ToastHeader>
          <ToastBody>{toast.text}</ToastBody>
        </Toast>
      ))}
    </div>
  );
}
