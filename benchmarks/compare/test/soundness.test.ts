import { describe, expect, it } from 'vitest';
import { collect } from '../src/collect.ts';
import { findDifferences, getCell } from '../src/metrics.ts';

describe('new compiler on base', () => {
  it('has 0 differences from uncompiled output on both targets', async () => {
    const results = await collect({ sets: ['base'], compilers: ['plain', 'next'] });
    expect(results).toHaveLength(15);
    for (const result of results) {
      for (const target of ['react', 'preact'] as const) {
        const cell = getCell(result, 'next', target);
        const plain = getCell(result, 'plain', target);
        if (cell === undefined || plain === undefined) {
          throw new Error(`${result.name}: missing cell on ${target}`);
        }
        expect(findDifferences(cell, plain), `${result.name} on ${target}`).toEqual([]);
      }
    }
  });
});
