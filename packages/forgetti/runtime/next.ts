/** Marks an unwritten slot. A slot holding `EMPTY` is never a hit. */
export const EMPTY: unique symbol = Symbol('empty');

function createSlots(size: number): unknown[] {
  return Array<unknown>(size).fill(EMPTY);
}

/** Root cache of one component or hook. `useRef` is the preset's hook, so React and Preact share this code. */
export function useCache(useRef: <T>(initial: T) => { current: T }, size: number): unknown[] {
  const ref = useRef<unknown[] | null>(null);
  // `||=` stays: at the es2018 target `??=` costs 19 bytes, and the ref holds null or an array.
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing
  return (ref.current ||= createSlots(size));
}

/** Child cache stored at `parent[index]`, created with `size` empty slots on first use. */
export function branch(parent: unknown[], index: number, size: number): unknown[] {
  const stored: unknown = parent[index];
  return Array.isArray(stored) ? stored : (parent[index] = createSlots(size));
}

/**
 * Returns the array at `cache[index]` when it has the same length and `Object.is`-equal
 * elements as `next`. Otherwise stores `next` and returns it.
 */
export function keep<T extends unknown[]>(cache: unknown[], index: number, next: T): T {
  const stored: unknown = cache[index];
  let position = next.length;
  if (Array.isArray(stored) && stored.length === position) {
    // Walk down from the end. `position` is -1 once every element matched.
    while (position-- > 0 && Object.is(stored[position], next[position])) {
      // The condition does the work.
    }
    if (position < 0) {
      // `stored` is a former `next`, so it has the same shape as `T`.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return stored as T;
    }
  }
  return (cache[index] = next);
}
