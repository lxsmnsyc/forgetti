export function $$equals(cache: unknown[], index: number, b: unknown): boolean {
  if (index in cache) {
    const a = cache[index];
    // eslint-disable-next-line no-self-compare
    return a === b || (a !== a && b !== b);
  }
  return false;
}

export type MemoHook = <T>(callback: () => T, dependencies: unknown[]) => T;

export function $$cache(hook: MemoHook, size: number): unknown[] {
  return hook(() => new Array<unknown>(size), []);
}
