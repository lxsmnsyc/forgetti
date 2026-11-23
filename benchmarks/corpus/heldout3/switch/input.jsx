import { forwardRef, memo, useEffect, useMemo, useRef, useState } from 'react';
import { bump } from '../../shared/counter.js';

// Stands in for the `clsx` package.
function clsx(...args) {
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

// @rc-component/util KeyCode and useControlledState, reduced to what Switch uses.
const KeyCode = { LEFT: 37, RIGHT: 39 };

function useControlledState(defaultValue, value) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  const mergedValue = value !== undefined ? value : innerValue;
  return [mergedValue, setInnerValue];
}

const Switch = forwardRef(
  (
    {
      prefixCls = 'rc-switch',
      className,
      checked,
      defaultChecked,
      disabled,
      loadingIcon,
      checkedChildren,
      unCheckedChildren,
      onClick,
      onChange,
      onKeyDown,
      styles,
      classNames: switchClassNames,
      ...restProps
    },
    ref,
  ) => {
    const [innerChecked, setInnerChecked] = useControlledState(defaultChecked ?? false, checked);

    function triggerChange(newChecked, event) {
      let mergedChecked = innerChecked;

      if (!disabled && newChecked !== innerChecked) {
        mergedChecked = newChecked;
        setInnerChecked(mergedChecked);
        onChange?.(mergedChecked, event);
      }

      return mergedChecked;
    }

    function onInternalKeyDown(e) {
      if (e.which === KeyCode.LEFT) {
        triggerChange(false, e);
      } else if (e.which === KeyCode.RIGHT) {
        triggerChange(true, e);
      }
      onKeyDown?.(e);
    }

    function onInternalClick(e) {
      const ret = triggerChange(!innerChecked, e);
      // [Legacy] trigger onClick with value
      onClick?.(ret, e);
    }

    const switchClassName = clsx(prefixCls, className, {
      [`${prefixCls}-checked`]: innerChecked,
      [`${prefixCls}-disabled`]: disabled,
    });

    return (
      <button
        {...restProps}
        type="button"
        role="switch"
        aria-checked={innerChecked}
        disabled={disabled}
        className={switchClassName}
        ref={ref}
        onKeyDown={onInternalKeyDown}
        onClick={onInternalClick}
      >
        {loadingIcon}
        <span className={`${prefixCls}-inner`}>
          <span
            className={clsx(`${prefixCls}-inner-checked`, switchClassNames?.content)}
            style={styles?.content}
          >
            {checkedChildren}
          </span>
          <span
            className={clsx(`${prefixCls}-inner-unchecked`, switchClassNames?.content)}
            style={styles?.content}
          >
            {unCheckedChildren}
          </span>
        </span>
      </button>
    );
  },
);

Switch.displayName = 'Switch';

export default Switch;

// Harness entry, after the rc-switch demos: a list of settings, each with a switch.
const SettingRow = memo(function SettingRow({ setting, checked, disabled, onToggle }) {
  bump('Row');
  return (
    <li>
      <span>{setting.label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onChange={(next) => onToggle(setting.id, next)}
        checkedChildren="on"
        unCheckedChildren="off"
        title={setting.label}
      />
    </li>
  );
});

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function countEnabled(settings, values) {
  bump('enabled');
  let count = 0;
  for (const setting of settings) {
    if (values[setting.id]) {
      count += 1;
    }
  }
  return count;
}

export function SettingsPanel({ settings, locked, defaultValues }) {
  const [values, setValues] = useState(defaultValues);
  const listRef = useRef(null);

  const onToggle = (id, next) => {
    setValues((previous) => ({ ...previous, [id]: next }));
  };

  useEffect(() => {
    globalThis.__switch = { root: listRef.current, setValues };
  });

  const enabled = useMemo(() => countEnabled(settings, values), [settings, values]);

  return (
    <section>
      <h3>
        {enabled} of {settings.length} on
      </h3>
      <ul ref={listRef}>
        {settings.map((setting) => (
          <SettingRow
            key={setting.id}
            setting={setting}
            checked={!!values[setting.id]}
            disabled={locked}
            onToggle={onToggle}
          />
        ))}
      </ul>
      <Switch defaultChecked loadingIcon={locked ? <i>…</i> : null} className="master" />
    </section>
  );
}
