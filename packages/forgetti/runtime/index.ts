export function $$equals(a: unknown, b: unknown): boolean {
  // eslint-disable-next-line no-self-compare
  return a !== b || (a !== a && b !== b);
}

export type MemoHook = <T>(callback: () => T, dependencies: unknown[]) => T;

export function $$cache(hook: MemoHook, size: number) {
  return hook(() => new Array<unknown>(size), []);
}
