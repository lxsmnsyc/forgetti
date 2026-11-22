import { describe, expect, it } from 'vitest';
import { EMPTY, branch, keep, useCache } from '../../../runtime/next';

function createRef<T>(initial: T): { current: T } {
  return { current: initial };
}

/** A `useRef` that keeps its ref across calls, like a hook does across renders. */
function createHook(): <T>(initial: T) => { current: T } {
  let stored: { current: unknown } | null = null;
  return <T>(initial: T): { current: T } => {
    stored ??= createRef<unknown>(initial);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return stored as { current: T };
  };
}

describe('useCache', () => {
  it('fills a new array with EMPTY', () => {
    const cache = useCache(createRef, 3);
    expect(cache).toHaveLength(3);
    for (const slot of cache) {
      expect(slot).toBe(EMPTY);
    }
  });

  it('returns the same array on the next render', () => {
    const useRef = createHook();
    const first = useCache(useRef, 2);
    first[0] = 'value';
    const second = useCache(useRef, 2);
    expect(second).toBe(first);
    expect(second[0]).toBe('value');
  });

  it('makes a size 0 cache', () => {
    expect(useCache(createRef, 0)).toEqual([]);
  });

  it('gives each call its own array', () => {
    expect(useCache(createRef, 1)).not.toBe(useCache(createRef, 1));
  });
});

describe('branch', () => {
  it('creates a child of EMPTY slots on first use', () => {
    const parent = useCache(createRef, 2);
    const child = branch(parent, 1, 4);
    expect(child).toHaveLength(4);
    for (const slot of child) {
      expect(slot).toBe(EMPTY);
    }
    expect(parent[1]).toBe(child);
  });

  it('returns the stored child afterwards, whatever the size', () => {
    const parent = useCache(createRef, 1);
    const child = branch(parent, 0, 2);
    child[0] = 'kept';
    expect(branch(parent, 0, 5)).toBe(child);
    expect(child).toHaveLength(2);
    expect(child[0]).toBe('kept');
  });

  it('treats undefined and other non-arrays as missing', () => {
    const parent: unknown[] = [undefined, 'text', null, 0, {}];
    for (let index = 0; index < parent.length; index++) {
      const child = branch(parent, index, 1);
      expect(Array.isArray(child)).toBe(true);
      expect(parent[index]).toBe(child);
    }
  });

  it('accepts an index past the parent length', () => {
    const parent = useCache(createRef, 0);
    const child = branch(parent, 3, 2);
    expect(parent[3]).toBe(child);
    expect(branch(parent, 3, 2)).toBe(child);
  });

  it('does not write to an existing child', () => {
    const parent = useCache(createRef, 1);
    const child = branch(parent, 0, 2);
    const frozen = Object.freeze([...child]);
    parent[0] = frozen;
    expect(branch(parent, 0, 2)).toBe(frozen);
  });

  it('nests', () => {
    const root = useCache(createRef, 1);
    const inner = branch(branch(root, 0, 1), 0, 1);
    expect(branch(branch(root, 0, 1), 0, 1)).toBe(inner);
  });
});

describe('keep', () => {
  it('stores the first array itself and returns it', () => {
    const cache = useCache(createRef, 1);
    const next = [1, 2];
    expect(keep(cache, 0, next)).toBe(next);
    expect(cache[0]).toBe(next);
  });

  it('returns the stored array for equal elements', () => {
    const cache = useCache(createRef, 1);
    const first = keep(cache, 0, ['a', 1]);
    const second = keep(cache, 0, ['a', 1]);
    expect(second).toBe(first);
    expect(cache[0]).toBe(first);
  });

  it('stores the new array when an element differs', () => {
    const cache = useCache(createRef, 1);
    keep(cache, 0, [1, 2]);
    const next = [1, 3];
    expect(keep(cache, 0, next)).toBe(next);
    expect(cache[0]).toBe(next);
  });

  it('stores the new array when the length differs', () => {
    const cache = useCache(createRef, 1);
    keep(cache, 0, [1]);
    const next = [1, undefined];
    expect(keep(cache, 0, next)).toBe(next);
    const shorter: unknown[] = [];
    expect(keep(cache, 0, shorter)).toBe(shorter);
  });

  it('hits on NaN', () => {
    const cache = useCache(createRef, 1);
    const first = keep(cache, 0, [Number.NaN]);
    expect(keep(cache, 0, [Number.NaN])).toBe(first);
  });

  it('misses on 0 against -0', () => {
    const cache = useCache(createRef, 1);
    keep(cache, 0, [0]);
    const negative = [-0];
    expect(keep(cache, 0, negative)).toBe(negative);
  });

  it('compares elements by identity', () => {
    const cache = useCache(createRef, 1);
    const object = {};
    const first = keep(cache, 0, [object]);
    expect(keep(cache, 0, [object])).toBe(first);
    const other = [{}];
    expect(keep(cache, 0, other)).toBe(other);
  });

  it('never hits on an EMPTY slot', () => {
    const cache = useCache(createRef, 1);
    const next: unknown[] = [];
    expect(keep(cache, 0, next)).toBe(next);
  });

  it('treats a non-array slot as a miss', () => {
    const cache: unknown[] = ['text'];
    const next = ['text'];
    expect(keep(cache, 0, next)).toBe(next);
  });

  it('keeps an empty tuple stable', () => {
    const cache = useCache(createRef, 1);
    const first = keep(cache, 0, []);
    expect(keep(cache, 0, [])).toBe(first);
  });
});

describe('write rule', () => {
  // A slot that hits when its stored inputs equal the current ones, written in two orders.
  function createSlot(order: 'value-first' | 'inputs-first'): {
    render: (input: number, run: (input: number) => string) => string;
  } {
    const cache = useCache(createRef, 2);
    return {
      render(input, run) {
        if (Object.is(cache[0], input)) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          return cache[1] as string;
        }
        if (order === 'value-first') {
          const value = run(input);
          cache[0] = input;
          cache[1] = value;
          return value;
        }
        cache[0] = input;
        const value = run(input);
        cache[1] = value;
        return value;
      },
    };
  }

  function computeValue(input: number): string {
    if (input < 0) {
      throw new Error('negative');
    }
    return `value ${input}`;
  }

  // The renderer retries a render that threw, with the same props.
  function renderTwice(slot: ReturnType<typeof createSlot>, input: number): string {
    try {
      return slot.render(input, computeValue);
    } catch {
      return slot.render(input, computeValue);
    }
  }

  it('writing the value first lets the retry throw again', () => {
    const slot = createSlot('value-first');
    expect(slot.render(1, computeValue)).toBe('value 1');
    expect(() => renderTwice(slot, -1)).toThrow('negative');
  });

  it('writing the inputs first turns the retry into a hit on a stale value', () => {
    const slot = createSlot('inputs-first');
    expect(slot.render(1, computeValue)).toBe('value 1');
    // The first render throws after the input was stored. The retry sees equal inputs.
    expect(renderTwice(slot, -1)).toBe('value 1');
  });
});
