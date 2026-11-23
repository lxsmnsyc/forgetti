import { forwardRef } from 'react';
import { bump } from '../../shared/counter.js';
import { KeyCode, clsx } from './util.js';

function Star(props, ref) {
  bump('Row');
  const {
    disabled,
    prefixCls,
    character,
    characterRender,
    index,
    count,
    value,
    allowHalf,
    focused,
    onHover,
    onClick,
  } = props;

  // =========================== Events ===========================
  const onInternalHover = (e) => {
    onHover(e, index);
  };

  const onInternalClick = (e) => {
    onClick(e, index);
  };

  const onInternalKeyDown = (e) => {
    if (e.keyCode === KeyCode.ENTER) {
      onClick(e, index);
    }
  };

  // =========================== Render ===========================
  // >>>>> ClassName
  const starValue = index + 1;
  const classNameList = new Set([prefixCls]);

  // TODO: Current we just refactor from CC to FC. This logic seems can be optimized.
  if (value === 0 && index === 0 && focused) {
    classNameList.add(`${prefixCls}-focused`);
  } else if (allowHalf && value + 0.5 >= starValue && value < starValue) {
    classNameList.add(`${prefixCls}-half`);
    classNameList.add(`${prefixCls}-active`);
    if (focused) {
      classNameList.add(`${prefixCls}-focused`);
    }
  } else {
    if (starValue <= value) {
      classNameList.add(`${prefixCls}-full`);
    } else {
      classNameList.add(`${prefixCls}-zero`);
    }
    if (starValue === value && focused) {
      classNameList.add(`${prefixCls}-focused`);
    }
  }

  // >>>>> Node
  const characterNode = typeof character === 'function' ? character(props) : character;

  let start = (
    <li className={clsx(Array.from(classNameList))} ref={ref}>
      <div
        onClick={disabled ? null : onInternalClick}
        onKeyDown={disabled ? null : onInternalKeyDown}
        onMouseMove={disabled ? null : onInternalHover}
        role="radio"
        aria-checked={value > index ? 'true' : 'false'}
        aria-posinset={index + 1}
        aria-setsize={count}
        tabIndex={disabled ? -1 : 0}
      >
        <div className={`${prefixCls}-first`}>{characterNode}</div>
        <div className={`${prefixCls}-second`}>{characterNode}</div>
      </div>
    </li>
  );

  if (characterRender) {
    start = characterRender(start, props);
  }

  return start;
}

export default forwardRef(Star);
