import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { bump } from '../../shared/counter.js';

// core/store.ts
export const ActionType = {
  ADD_TOAST: 0,
  UPDATE_TOAST: 1,
  DISMISS_TOAST: 3,
  REMOVE_TOAST: 4,
  START_PAUSE: 5,
  END_PAUSE: 6,
};

export function reducer(state, action) {
  switch (action.type) {
    case ActionType.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, state.settings.toastLimit),
      };
    case ActionType.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
    case ActionType.DISMISS_TOAST: {
      const { toastId } = action;
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, dismissed: true, visible: false } : t,
        ),
      };
    }
    case ActionType.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) };
    case ActionType.START_PAUSE:
      return { ...state, pausedAt: action.time };
    case ActionType.END_PAUSE: {
      const diff = action.time - (state.pausedAt || 0);
      return {
        ...state,
        pausedAt: undefined,
        toasts: state.toasts.map((t) => ({ ...t, pauseDuration: t.pauseDuration + diff })),
      };
    }
  }
}

const listeners = [];
const defaultToasterState = { toasts: [], pausedAt: undefined, settings: { toastLimit: 20 } };
const memoryState = {};

export const dispatch = (action, toasterId = 'default') => {
  memoryState[toasterId] = reducer(memoryState[toasterId] || defaultToasterState, action);
  listeners.forEach(([id, listener]) => {
    if (id === toasterId) {
      listener(memoryState[toasterId]);
    }
  });
};

const createDispatch = (toasterId) => (action) => {
  dispatch(action, toasterId);
};

const defaultTimeouts = {
  blank: 4000,
  error: 4000,
  success: 2000,
  loading: Infinity,
  custom: 4000,
};

// Census variant: the default literal is made once, as a compiler that caches it would do.
const NO_OPTIONS = {};

const useStore = (toastOptions = NO_OPTIONS, toasterId = 'default') => {
  const [state, setState] = useState(memoryState[toasterId] || defaultToasterState);
  const initial = useRef(memoryState[toasterId]);

  useEffect(() => {
    if (initial.current !== memoryState[toasterId]) {
      setState(memoryState[toasterId]);
    }
    listeners.push([toasterId, setState]);
    return () => {
      const index = listeners.findIndex(([id, setter]) => id === toasterId && setter === setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [toasterId]);

  return { ...state, toasts: mergeToasts(state.toasts, toastOptions) };
};

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function mergeToasts(toasts, toastOptions) {
  bump('merge');
  return toasts.map((t) => ({
    ...toastOptions,
    ...toastOptions[t.type],
    ...t,
    removeDelay: t.removeDelay || toastOptions[t.type]?.removeDelay || toastOptions?.removeDelay,
    duration:
      t.duration ||
      toastOptions[t.type]?.duration ||
      toastOptions?.duration ||
      defaultTimeouts[t.type],
    style: { ...toastOptions.style, ...toastOptions[t.type]?.style, ...t.style },
  }));
}

// core/use-toaster.ts, with toast.dismiss inlined as a dispatch and the remove queue left out.
const useToaster = (toastOptions, toasterId = 'default') => {
  const { toasts, pausedAt } = useStore(toastOptions, toasterId);

  useEffect(() => {
    if (pausedAt) {
      return;
    }
    const now = Date.now();
    const timeouts = toasts.map((t) => {
      if (t.duration === Infinity) {
        return;
      }
      const durationLeft = (t.duration || 0) + t.pauseDuration - (now - t.createdAt);
      if (durationLeft < 0) {
        if (t.visible) {
          dispatch({ type: ActionType.DISMISS_TOAST, toastId: t.id }, toasterId);
        }
        return;
      }
      return setTimeout(
        () => dispatch({ type: ActionType.DISMISS_TOAST, toastId: t.id }, toasterId),
        durationLeft,
      );
    });
    return () => {
      timeouts.forEach((timeout) => timeout && clearTimeout(timeout));
    };
  }, [toasts, pausedAt, toasterId]);

  const dispatchHere = useCallback(createDispatch(toasterId), [toasterId]);

  const startPause = useCallback(() => {
    dispatchHere({ type: ActionType.START_PAUSE, time: Date.now() });
  }, [dispatchHere]);

  const updateHeight = useCallback(
    (toastId, height) => {
      dispatchHere({ type: ActionType.UPDATE_TOAST, toast: { id: toastId, height } });
    },
    [dispatchHere],
  );

  const endPause = useCallback(() => {
    if (pausedAt) {
      dispatchHere({ type: ActionType.END_PAUSE, time: Date.now() });
    }
  }, [pausedAt, dispatchHere]);

  const calculateOffset = useCallback(
    (toast, opts) => {
      const { reverseOrder = false, gutter = 8, defaultPosition } = opts || {};
      const relevantToasts = toasts.filter(
        (t) => (t.position || defaultPosition) === (toast.position || defaultPosition) && t.height,
      );
      const toastIndex = relevantToasts.findIndex((t) => t.id === toast.id);
      const toastsBefore = relevantToasts.filter(
        (toast, i) => i < toastIndex && toast.visible,
      ).length;
      return relevantToasts
        .filter((t) => t.visible)
        .slice(...(reverseOrder ? [toastsBefore + 1] : [0, toastsBefore]))
        .reduce((acc, t) => acc + (t.height || 0) + gutter, 0);
    },
    [toasts],
  );

  return { toasts, handlers: { updateHeight, startPause, endPause, calculateOffset } };
};

// components/toast-bar.tsx, reduced to a memo child that prints the message.
const ToastBar = memo(function ToastBar({ toast, position }) {
  bump('Child');
  return (
    <div className="toast-bar" data-position={position} role="status">
      {toast.message}
    </div>
  );
});

// components/toaster.tsx
const ToastWrapper = ({ id, className, style, onHeightUpdate, children }) => {
  const ref = useCallback(
    (el) => {
      if (el) {
        const updateHeight = () => {
          onHeightUpdate(id, el.getBoundingClientRect().height);
        };
        updateHeight();
        new MutationObserver(updateHeight).observe(el, {
          subtree: true,
          childList: true,
          characterData: true,
        });
      }
    },
    [id, onHeightUpdate],
  );
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
};

const getPositionStyle = (position, offset) => {
  const top = position.includes('top');
  const verticalStyle = top ? { top: 0 } : { bottom: 0 };
  const horizontalStyle = position.includes('center')
    ? { justifyContent: 'center' }
    : position.includes('right')
      ? { justifyContent: 'flex-end' }
      : {};
  return {
    left: 0,
    right: 0,
    display: 'flex',
    position: 'absolute',
    transition: `all 230ms cubic-bezier(.21,1.02,.73,1)`,
    transform: `translateY(${offset * (top ? 1 : -1)}px)`,
    ...verticalStyle,
    ...horizontalStyle,
  };
};

export const Toaster = ({
  reverseOrder,
  position = 'top-center',
  toastOptions,
  gutter,
  children,
  toasterId,
  containerStyle,
  containerClassName,
}) => {
  const { toasts, handlers } = useToaster(toastOptions, toasterId);

  return (
    <div
      data-rht-toaster={toasterId || ''}
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: 16,
        left: 16,
        right: 16,
        bottom: 16,
        pointerEvents: 'none',
        ...containerStyle,
      }}
      className={containerClassName}
      onMouseEnter={handlers.startPause}
      onMouseLeave={handlers.endPause}
    >
      {toasts.map((t) => {
        const toastPosition = t.position || position;
        const offset = handlers.calculateOffset(t, {
          reverseOrder,
          gutter,
          defaultPosition: position,
        });
        const positionStyle = getPositionStyle(toastPosition, offset);

        return (
          <ToastWrapper
            id={t.id}
            key={t.id}
            onHeightUpdate={handlers.updateHeight}
            className={t.visible ? 'toast-active' : ''}
            style={positionStyle}
          >
            {children ? children(t) : <ToastBar toast={t} position={toastPosition} />}
          </ToastWrapper>
        );
      })}
    </div>
  );
};

// Harness entry: clears the toaster once on mount, then seeds it, so every scenario starts alike.
export function SeededToaster({ seed, ...props }) {
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    dispatch({ type: ActionType.REMOVE_TOAST }, props.toasterId);
    for (const item of seed) {
      dispatch({ type: ActionType.ADD_TOAST, toast: item }, props.toasterId);
    }
  }
  return <Toaster {...props} />;
}
