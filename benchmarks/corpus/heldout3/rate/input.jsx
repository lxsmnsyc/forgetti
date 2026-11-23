import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { bump } from '../../shared/counter.js';
import Star from './star.jsx';
import useRefs from './use_refs.js';
import { KeyCode, clsx, getOffsetLeft, pickAttrs, useControlledState } from './util.js';

function Rate(props, ref) {
  const {
    // Base
    prefixCls = 'rc-rate',
    className,

    // Value
    defaultValue,
    value: propValue,
    count = 5,
    allowHalf = false,
    allowClear = true,
    keyboard = true,

    // Display
    character = '★',
    characterRender,

    // Meta
    disabled,
    direction = 'ltr',
    tabIndex = 0,
    autoFocus,

    // Events
    onHoverChange,
    onChange,
    onFocus,
    onBlur,
    onKeyDown,
    onMouseLeave,

    ...restProps
  } = props;

  const [getStarRef, setStarRef] = useRefs();
  const rateRef = useRef(null);

  // ============================ Ref =============================
  const triggerFocus = () => {
    if (!disabled) {
      rateRef.current?.focus();
    }
  };

  useImperativeHandle(ref, () => ({
    focus: triggerFocus,
    blur: () => {
      if (!disabled) {
        rateRef.current?.blur();
      }
    },
  }));

  // =========================== Value ============================
  const [value, setValue] = useControlledState(defaultValue || 0, propValue);
  const [cleanedValue, setCleanedValue] = useControlledState(null);

  const getStarValue = (index, x) => {
    const reverse = direction === 'rtl';
    let starValue = index + 1;
    if (allowHalf) {
      const starEle = getStarRef(index);
      const leftDis = getOffsetLeft(starEle);
      const width = starEle.clientWidth;
      if (reverse && x - leftDis > width / 2) {
        starValue -= 0.5;
      } else if (!reverse && x - leftDis < width / 2) {
        starValue -= 0.5;
      }
    }
    return starValue;
  };

  // >>>>> Change
  const changeValue = (nextValue) => {
    setValue(nextValue);
    onChange?.(nextValue);
  };

  // =========================== Focus ============================
  const [focused, setFocused] = useState(false);

  const onInternalFocus = () => {
    setFocused(true);
    onFocus?.();
  };

  const onInternalBlur = () => {
    setFocused(false);
    onBlur?.();
  };

  // =========================== Hover ============================
  const [hoverValue, setHoverValue] = useState(null);

  const onHover = (event, index) => {
    const nextHoverValue = getStarValue(index, event.pageX);
    if (nextHoverValue !== cleanedValue) {
      setHoverValue(nextHoverValue);
      setCleanedValue(null);
    }
    onHoverChange?.(nextHoverValue);
  };

  const onMouseLeaveCallback = (event) => {
    if (!disabled) {
      setHoverValue(null);
      setCleanedValue(null);
      onHoverChange?.(undefined);
    }
    if (event) {
      onMouseLeave?.(event);
    }
  };

  // =========================== Click ============================
  const onClick = (event, index) => {
    const newValue = getStarValue(index, event.pageX);
    let isReset = false;
    if (allowClear) {
      isReset = newValue === value;
    }
    onMouseLeaveCallback();
    changeValue(isReset ? 0 : newValue);
    setCleanedValue(isReset ? newValue : null);
  };

  const onInternalKeyDown = (event) => {
    const { keyCode } = event;
    const reverse = direction === 'rtl';
    const step = allowHalf ? 0.5 : 1;

    if (keyboard) {
      if (keyCode === KeyCode.RIGHT && value < count && !reverse) {
        changeValue(value + step);
        event.preventDefault();
      } else if (keyCode === KeyCode.LEFT && value > 0 && !reverse) {
        changeValue(value - step);
        event.preventDefault();
      } else if (keyCode === KeyCode.RIGHT && value > 0 && reverse) {
        changeValue(value - step);
        event.preventDefault();
      } else if (keyCode === KeyCode.LEFT && value < count && reverse) {
        changeValue(value + step);
        event.preventDefault();
      }
    }

    onKeyDown?.(event);
  };

  // =========================== Effect ===========================

  useEffect(() => {
    if (autoFocus && !disabled) {
      triggerFocus();
    }
  }, []);

  // =========================== Render ===========================
  // >>> Star
  const starNodes = new Array(count)
    .fill(0)
    .map((item, index) => (
      <Star
        ref={setStarRef(index)}
        index={index}
        count={count}
        disabled={disabled}
        prefixCls={`${prefixCls}-star`}
        allowHalf={allowHalf}
        value={hoverValue === null ? value : hoverValue}
        onClick={onClick}
        onHover={onHover}
        key={item || index}
        character={character}
        characterRender={characterRender}
        focused={focused}
      />
    ));

  const classString = clsx(prefixCls, className, {
    [`${prefixCls}-disabled`]: disabled,
    [`${prefixCls}-rtl`]: direction === 'rtl',
  });

  // >>> Node
  return (
    <ul
      className={classString}
      onMouseLeave={onMouseLeaveCallback}
      tabIndex={disabled ? -1 : tabIndex}
      onFocus={disabled ? null : onInternalFocus}
      onBlur={disabled ? null : onInternalBlur}
      onKeyDown={disabled ? null : onInternalKeyDown}
      ref={rateRef}
      {...pickAttrs(restProps, { aria: true, data: true, attr: true })}
    >
      {starNodes}
    </ul>
  );
}

const RateWithRef = forwardRef(Rate);
export default RateWithRef;

const LABELS = ['Terrible', 'Bad', 'Normal', 'Good', 'Wonderful'];

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function describeScore(value, count) {
  bump('describe');
  if (!value) {
    return 'No rating';
  }
  const label = LABELS[Math.ceil((value / count) * LABELS.length) - 1] ?? '';
  return `${value} of ${count}: ${label}`;
}

// Harness entry, after the rc-rate demo: a controlled rating with a caption and a
// wrapper element so scenarios can dispatch DOM events on the stars.
export function ReviewRating({
  initialValue,
  count,
  allowHalf,
  allowClear,
  disabled,
  character,
  direction,
}) {
  const [value, setValue] = useState(initialValue);
  const rootRef = useRef(null);

  useEffect(() => {
    globalThis.__rate = { root: rootRef.current, setValue };
  });

  const caption = useMemo(() => describeScore(value, count ?? 5), [value, count]);

  return (
    <div ref={rootRef} className="review">
      <RateWithRef
        value={value}
        count={count}
        allowHalf={allowHalf}
        allowClear={allowClear}
        disabled={disabled}
        character={character}
        direction={direction}
        onChange={setValue}
        aria-label="Product rating"
        data-section="review"
      />
      <span className="caption">{caption}</span>
    </div>
  );
}
