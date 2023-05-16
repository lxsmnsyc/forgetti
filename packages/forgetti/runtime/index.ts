function isEqual(a: unknown, b: unknown): boolean {
  // eslint-disable-next-line no-self-compare
  return a === b || (a !== a && b !== b);
}

export function $$equals(cache: unknown[], index: number, b: unknown): boolean {
  return index in cache && isEqual(cache[index], b);
}

export interface Ref<T> {
  current: T;
}
export type RefHook = <T>(callback: T) => Ref<T>;

export function $$cache(hook: RefHook, size: number): unknown[] {
  const ref = hook<unknown[] | undefined>(undefined);
  if (!ref.current) {
    ref.current = new Array(size);
  }
  return ref.current;
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
