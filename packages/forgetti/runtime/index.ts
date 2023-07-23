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

export function $$ref(hook: RefHook, size: number): unknown[] {
  const ref = hook<unknown[] | undefined>(undefined);
  if (!ref.current) {
    ref.current = new Array(size);
  }
  return ref.current;
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
  v: unknown[];
}

function arePropsEqual(prev: MemoProps, next: MemoProps): boolean {
  for (let i = 0, len = prev.v.length; i < len; i++) {
    if (!isEqual(prev.v[i], next.v[i])) {
      return false;
    }
  }
  return true;
}

type MemoComponent = (props: MemoProps) => unknown;

export type MemoFunction = (
  Component: MemoComponent,
  arePropsEqual: (prev: MemoProps, next: MemoProps) => boolean,
) => MemoComponent;

export function $$memo(
  memoFunc: MemoFunction,
  render: (values: unknown[]) => unknown,
): MemoComponent {
  return memoFunc((props: MemoProps) => render(props.v), arePropsEqual);
}
