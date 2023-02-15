import { describe, it, expect } from 'vitest';
import add from '../src';

describe('blah', () => {
  it('works', () => {
    expect(add(1, 1)).toEqual(2);
  });
});
