import type { Range } from '../../../src/next/ir';

/** Finds the first `text` at or after `from` and returns its UTF-16 range. Throws when absent. */
export function findRange(source: string, text: string, from = 0): Range {
  const start = source.indexOf(text, from);
  if (start === -1) {
    throw new Error(`Fixture text not found: ${text}`);
  }
  return { start, end: start + text.length };
}

/** Returns the range from the first `startText` to the end of the last `endText` after it. */
export function findSpan(source: string, startText: string, endText: string): Range {
  const start = findRange(source, startText);
  const end = source.lastIndexOf(endText);
  if (end < start.start) {
    throw new Error(`Fixture end text not found: ${endText}`);
  }
  return { start: start.start, end: end + endText.length - 1 };
}
