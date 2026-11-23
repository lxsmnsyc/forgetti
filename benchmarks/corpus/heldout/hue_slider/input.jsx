import { memo, useRef, useMemo, useEffect } from 'react';

// utils/clamp.ts
const clamp = (number, min = 0, max = 1) => {
  return number > max ? max : number < min ? min : number;
};

// utils/round.ts
const round = (number, digits = 0, base = Math.pow(10, digits)) => {
  return Math.round(base * number) / base;
};

// utils/format.ts
const formatClassName = (names) => names.filter(Boolean).join(' ');

// utils/convert.ts
const hsvaToHsla = ({ h, s, v, a }) => {
  const hh = ((200 - s) * v) / 100;

  return {
    h: round(h),
    s: round(hh > 0 && hh < 200 ? ((s * v) / 100 / (hh <= 100 ? hh : 200 - hh)) * 100 : 0),
    l: round(hh / 2),
    a: round(a, 2),
  };
};

const hsvaToHslString = (hsva) => {
  const { h, s, l } = hsvaToHsla(hsva);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

// hooks/useEventCallback.ts
function useEventCallback(handler) {
  const callbackRef = useRef(handler);
  const fn = useRef((value) => {
    callbackRef.current && callbackRef.current(value);
  });
  callbackRef.current = handler;

  return fn.current;
}

// components/common/Pointer.tsx
export const Pointer = ({ className, color, left, top = 0.5 }) => {
  const nodeClassName = formatClassName(['react-colorful__pointer', className]);

  const style = {
    top: `${top * 100}%`,
    left: `${left * 100}%`,
  };

  return (
    <div className={nodeClassName} style={style}>
      <div className="react-colorful__pointer-fill" style={{ backgroundColor: color }} />
    </div>
  );
};

// components/common/Interactive.tsx
const isTouch = (event) => 'touches' in event;

const getTouchPoint = (touches, touchId) => {
  for (let i = 0; i < touches.length; i++) {
    if (touches[i].identifier === touchId) return touches[i];
  }
  return touches[0];
};

const getParentWindow = (node) => {
  return (node && node.ownerDocument.defaultView) || self;
};

const getRelativePosition = (node, event, touchId) => {
  const rect = node.getBoundingClientRect();
  const pointer = isTouch(event) ? getTouchPoint(event.touches, touchId) : event;

  return {
    left: clamp((pointer.pageX - (rect.left + getParentWindow(node).pageXOffset)) / rect.width),
    top: clamp((pointer.pageY - (rect.top + getParentWindow(node).pageYOffset)) / rect.height),
  };
};

const preventDefaultMove = (event) => {
  !isTouch(event) && event.preventDefault();
};

const InteractiveBase = ({ onMove, onKey, onEnd, ...rest }) => {
  const container = useRef(null);
  const onMoveCallback = useEventCallback(onMove);
  const onKeyCallback = useEventCallback(onKey);
  const onEndCallback = useEventCallback(onEnd);
  const touchId = useRef(null);

  const [handleMoveStart, handleKeyDown, handleKeyUp, toggleDocumentEvents] = useMemo(() => {
    let hasTouch = false;
    let lastTouch = 0;

    const handleMoveStart = ({ nativeEvent }) => {
      const el = container.current;
      if (!el || (!isTouch(nativeEvent) && (nativeEvent.button || Date.now() - lastTouch < 800))) {
        return;
      }

      preventDefaultMove(nativeEvent);

      toggleDocumentEvents(false);
      hasTouch = isTouch(nativeEvent);

      if (isTouch(nativeEvent)) {
        lastTouch = Date.now();
        const changedTouches = nativeEvent.changedTouches || [];
        if (changedTouches.length) touchId.current = changedTouches[0].identifier;
      }

      el.focus();
      toggleDocumentEvents(true);
      onMoveCallback(getRelativePosition(el, nativeEvent, touchId.current));
    };

    const handleMove = (event) => {
      if (isTouch(event)) lastTouch = Date.now();
      preventDefaultMove(event);

      const isDown = isTouch(event) ? event.touches.length > 0 : event.buttons > 0;

      if (isDown && container.current) {
        onMoveCallback(getRelativePosition(container.current, event, touchId.current));
      } else {
        toggleDocumentEvents(false);
        onEndCallback();
      }
    };

    const handleMoveEnd = () => {
      if (hasTouch) lastTouch = Date.now();
      toggleDocumentEvents(false);
      onEndCallback();
    };

    const handleKeyDown = (event) => {
      const keyCode = event.which || event.keyCode;

      if (keyCode < 37 || keyCode > 40) return;
      event.preventDefault();
      onKeyCallback({
        left: keyCode === 39 ? 0.05 : keyCode === 37 ? -0.05 : 0,
        top: keyCode === 40 ? 0.05 : keyCode === 38 ? -0.05 : 0,
      });
    };

    const handleKeyUp = (event) => {
      const keyCode = event.which || event.keyCode;
      if (keyCode >= 37 && keyCode <= 40) onEndCallback();
    };

    function toggleDocumentEvents(state) {
      const el = container.current;
      const parentWindow = getParentWindow(el);

      const toggleEvent = state ? parentWindow.addEventListener : parentWindow.removeEventListener;
      toggleEvent(hasTouch ? 'touchmove' : 'mousemove', handleMove);
      toggleEvent(hasTouch ? 'touchend' : 'mouseup', handleMoveEnd);
      if (hasTouch) toggleEvent('touchcancel', handleMoveEnd);
    }

    return [handleMoveStart, handleKeyDown, handleKeyUp, toggleDocumentEvents];
  }, [onKeyCallback, onMoveCallback, onEndCallback]);

  useEffect(() => toggleDocumentEvents, [toggleDocumentEvents]);

  return (
    <div
      {...rest}
      onTouchStart={handleMoveStart}
      onMouseDown={handleMoveStart}
      className="react-colorful__interactive"
      ref={container}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      tabIndex={0}
      role="slider"
    />
  );
};

const Interactive = memo(InteractiveBase);

// components/common/Hue.tsx
const HueBase = ({ className, hue, onChange, onChangeEnd }) => {
  const handleMove = (interaction) => {
    onChange({ h: 360 * interaction.left });
  };

  const handleKey = (offset) => {
    onChange({
      h: clamp(hue + offset.left * 360, 0, 360),
    });
  };

  const nodeClassName = formatClassName(['react-colorful__hue', className]);

  return (
    <div className={nodeClassName}>
      <Interactive
        onMove={handleMove}
        onKey={handleKey}
        onEnd={onChangeEnd}
        aria-label="Hue"
        aria-valuenow={round(hue)}
        aria-valuemax="360"
        aria-valuemin="0"
      >
        <Pointer
          className="react-colorful__hue-pointer"
          left={hue / 360}
          color={hsvaToHslString({ h: hue, s: 100, v: 100, a: 1 })}
        />
      </Interactive>
    </div>
  );
};

export const Hue = memo(HueBase);
