// shared/utils.ts
function isValidNumber(num) {
  return num !== null && num !== false && !Number.isNaN(Number(num));
}

export function safeMax(...args) {
  return Math.max(...args.filter(isValidNumber));
}

// Stands in for the `clsx` package.
export function clsx(...args) {
  const parts = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      parts.push(clsx(...arg));
    } else if (typeof arg === 'string' && arg) {
      parts.push(arg);
    }
  }
  return parts.join(' ');
}

// @wojtekmaj/date-utils getHours, getMinutes, getSeconds and getMilliseconds, reduced to
// a Date or an "HH:MM:SS.mmm" string.
function getTimePart(date, index, fromDate) {
  if (date instanceof Date) {
    return fromDate(date);
  }
  if (typeof date === 'string') {
    const parts = date.split(/[:.]/);
    const part = parts[index];
    if (part === undefined) {
      return 0;
    }
    const result = Number.parseInt(part, 10);
    if (!Number.isNaN(result)) {
      return result;
    }
  }
  throw new Error(`Failed to get a time part from date: ${date}.`);
}

export function getHours(date) {
  return getTimePart(date, 0, (value) => value.getHours());
}

export function getMinutes(date) {
  return getTimePart(date, 1, (value) => value.getMinutes());
}

export function getSeconds(date) {
  return getTimePart(date, 2, (value) => value.getSeconds());
}

export function getMilliseconds(date) {
  return getTimePart(date, 3, (value) => value.getMilliseconds());
}
