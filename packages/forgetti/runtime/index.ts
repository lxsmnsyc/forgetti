function isEqual(a: unknown, b: unknown): boolean {
  // eslint-disable-next-line no-self-compare
  return a === b || (a !== a && b !== b);
}

export function $$equals(cache: unknown[], index: number, b: unknown): boolean {
  return index in cache && isEqual(cache[index], b);
}

export type MemoHook = <T>(callback: () => T, dependencies: unknown[]) => T;

export function $$cache(hook: MemoHook, size: number): unknown[] {
  return hook(() => new Array<unknown>(size), []);
}

export function $$branch(parent: unknown[], index: number, size: number): unknown[] {
  parent[index] ||= new Array(size);
  return parent[index] as unknown[];
}

export interface MemoProps {
  value: unknown;
}

function arePropsEqual(prev: MemoProps, next: MemoProps): boolean {
  return isEqual(prev.value, next.value);
}

type MemoComponent = (props: MemoProps) => unknown;

export type MemoFunction = (
  Component: MemoComponent,
  arePropsEqual: (prev: MemoProps, next: MemoProps) => boolean,
) => MemoComponent;

function MemoComp(props: MemoProps): unknown {
  return props.value;
}

export function $$memo(
  memoFunc: MemoFunction,
): MemoComponent {
  return memoFunc(MemoComp, arePropsEqual);
}
