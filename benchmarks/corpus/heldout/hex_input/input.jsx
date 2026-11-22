import { useState, useEffect, useCallback, useRef } from 'react';

// utils/validate.ts
const matcher = /^#?([0-9A-F]{3,8})$/i;

const validHex = (value, alpha) => {
  const match = matcher.exec(value);
  const length = match ? match[1].length : 0;

  return (
    length === 3 || // '#rgb' format
    length === 6 || // '#rrggbb' format
    (!!alpha && length === 4) || // '#rgba' format
    (!!alpha && length === 8) // '#rrggbbaa' format
  );
};

// hooks/useEventCallback.ts
// Saves incoming handler to the ref in order to avoid "useCallback hell"
function useEventCallback(handler) {
  const callbackRef = useRef(handler);
  const fn = useRef((value) => {
    callbackRef.current && callbackRef.current(value);
  });
  callbackRef.current = handler;

  return fn.current;
}

// components/common/ColorInput.tsx
// Props: `escape` blocks typing invalid characters and limits string length.
// `validate` checks that the value is a valid color string.
// `format` processes the value before displaying it in the input.
// `process` processes the value before sending it in `onChange`.
const ColorInput = (props) => {
  const { color = '', onChange, onBlur, escape, validate, format, process, ...rest } = props;
  const [value, setValue] = useState(() => escape(color));
  const onChangeCallback = useEventCallback(onChange);
  const onBlurCallback = useEventCallback(onBlur);

  // Trigger `onChange` handler only if the input value is a valid color
  const handleChange = useCallback(
    (e) => {
      const inputValue = escape(e.target.value);
      setValue(inputValue);
      if (validate(inputValue)) onChangeCallback(process ? process(inputValue) : inputValue);
    },
    [escape, process, validate, onChangeCallback]
  );

  // Take the color from props if the last typed color (in local state) is not valid
  const handleBlur = useCallback(
    (e) => {
      if (!validate(e.target.value)) setValue(escape(color));
      onBlurCallback(e);
    },
    [color, escape, validate, onBlurCallback]
  );

  // Update the local state when `color` property value is changed
  useEffect(() => {
    setValue(escape(color));
  }, [color, escape]);

  return (
    <input
      {...rest}
      value={format ? format(value) : value}
      spellCheck="false" // the element should not be checked for spelling errors
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

// components/HexColorInput.tsx
// Props: `prefixed` enables `#` prefix displaying.
// `alpha` allows `#rgba` and `#rrggbbaa` color formats.
/** Adds "#" symbol to the beginning of the string */
const prefix = (value) => '#' + value;

export const HexColorInput = (props) => {
  const { prefixed, alpha, ...rest } = props;

  /** Escapes all non-hexadecimal characters including "#" */
  const escape = useCallback(
    (value) => value.replace(/([^0-9A-F]+)/gi, '').substring(0, alpha ? 8 : 6),
    [alpha]
  );

  /** Validates hexadecimal strings */
  const validate = useCallback((value) => validHex(value, alpha), [alpha]);

  return (
    <ColorInput
      {...rest}
      escape={escape}
      format={prefixed ? prefix : undefined}
      process={prefix}
      validate={validate}
    />
  );
};
