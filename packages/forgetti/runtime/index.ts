function isEqual(a: unknown, b: unknown): boolean {
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

const EMPTY_ARRAY: never[] = [];

export function $$cache(hook: MemoHook, size: number): unknown[] {
  return hook(() => new Array<unknown>(size), EMPTY_ARRAY);
}

export function $$branch(
  parent: unknown[],
  index: number,
  size: number,
): unknown[] {
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

interface MemoComponent {
  (props: MemoProps): unknown;
  displayName: string;
}

export type MemoFunction = (
  Component: MemoComponent,
  arePropsEqual: (prev: MemoProps, next: MemoProps) => boolean,
) => MemoComponent;

export function $$memo(
  memoFunc: MemoFunction,
  name: string,
  render: (values: unknown[]) => unknown,
): MemoComponent {
  const OriginalComponent = (props: MemoProps) => render(props.v);
  if (import.meta.env.DEV) {
    OriginalComponent.displayName = `Forgetti(${name}.render)`;
  }
  const Component = memoFunc(OriginalComponent, arePropsEqual);
  if (import.meta.env.DEV) {
    Component.displayName = `Forgetti(${name}.template)`;
  }
  return Component;
}
