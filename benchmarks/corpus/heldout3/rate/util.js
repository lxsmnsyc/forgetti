import { useState } from 'react';

// util.ts
function getScroll(w) {
  let ret = w.pageXOffset;
  const method = 'scrollLeft';
  if (typeof ret !== 'number') {
    const d = w.document;
    // ie6,7,8 standard mode
    ret = d.documentElement[method];
    if (typeof ret !== 'number') {
      // quirks mode
      ret = d.body[method];
    }
  }
  return ret;
}

function getClientPosition(elem) {
  let x;
  let y;
  const doc = elem.ownerDocument;
  const { body } = doc;
  const docElem = doc && doc.documentElement;
  const box = elem.getBoundingClientRect();
  x = box.left;
  y = box.top;
  x -= docElem.clientLeft || body.clientLeft || 0;
  y -= docElem.clientTop || body.clientTop || 0;
  return {
    left: x,
    top: y,
  };
}

export function getOffsetLeft(el) {
  const pos = getClientPosition(el);
  const doc = el.ownerDocument;
  // Only IE use `parentWindow`
  const w = doc.defaultView || doc.parentWindow;
  pos.left += getScroll(w);
  return pos.left;
}

// Reduced stand-ins for the parts of @rc-component/util and clsx that Rate and Star use.
export const KeyCode = {
  ENTER: 13,
  LEFT: 37,
  RIGHT: 39,
};

export function useControlledState(defaultValue, value) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  const mergedValue = value !== undefined ? value : innerValue;
  return [mergedValue, setInnerValue];
}

const ATTRS = ['id', 'role', 'title', 'tabIndex', 'lang', 'dir'];

export function pickAttrs(props, config) {
  const picked = {};
  for (const key of Object.keys(props)) {
    if (
      (config.aria && (key === 'role' || key.startsWith('aria-'))) ||
      (config.data && key.startsWith('data-')) ||
      (config.attr && ATTRS.includes(key))
    ) {
      picked[key] = props[key];
    }
  }
  return picked;
}

export function clsx(...args) {
  const parts = [];
  for (const arg of args) {
    if (typeof arg === 'string' && arg) {
      parts.push(arg);
    } else if (Array.isArray(arg)) {
      parts.push(clsx(...arg));
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
