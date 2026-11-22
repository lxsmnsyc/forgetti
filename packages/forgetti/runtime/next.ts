/** Marks an unwritten slot. A slot holding `EMPTY` is never a hit. */
export const EMPTY: unique symbol = Symbol('forgetti.empty');

function createSlots(size: number): unknown[] {
  const slots: unknown[] = [];
  for (let index = 0; index < size; index++) {
    slots.push(EMPTY);
  }
  return slots;
}

/** Root cache of one component or hook. `useRef` is the preset's hook, so React and Preact share this code. */
export function useCache(useRef: <T>(initial: T) => { current: T }, size: number): unknown[] {
  const ref = useRef<unknown[] | null>(null);
  ref.current ??= createSlots(size);
  return ref.current;
}

/** Child cache stored at `parent[index]`, created with `size` empty slots on first use. */
export function branch(parent: unknown[], index: number, size: number): unknown[] {
  const stored = parent[index];
  if (Array.isArray(stored)) {
    return stored;
  }
  const created = createSlots(size);
  parent[index] = created;
  return created;
}

/**
 * Returns the array at `cache[index]` when it has the same length and `Object.is`-equal
 * elements as `next`. Otherwise stores `next` and returns it.
 */
export function keep<T extends unknown[]>(cache: unknown[], index: number, next: T): T {
  const stored = cache[index];
  if (Array.isArray(stored) && stored.length === next.length) {
    let same = true;
    for (let position = 0; position < next.length; position++) {
      if (!Object.is(stored[position], next[position])) {
        same = false;
        break;
      }
    }
    if (same) {
      // `stored` is a former `next`, so it has the same shape as `T`.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return stored as T;
    }
  }
  cache[index] = next;
  return next;
}
