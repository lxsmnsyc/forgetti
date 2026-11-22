import type { CompileOptions, HookType, ImportDefinition, Preset } from '../index';

function createHooks(
  source: string,
  hooks: [name: string, type: HookType][],
): Preset['imports']['hooks'] {
  const result: Preset['imports']['hooks'] = [];
  for (const [name, type] of hooks) {
    result.push({ kind: 'named', name, source, type });
  }
  return result;
}

function createNamed(source: string, names: string[]): ImportDefinition[] {
  const result: ImportDefinition[] = [];
  for (const name of names) {
    result.push({ kind: 'named', name, source });
  }
  return result;
}

// The 0.8 component filter. The hook filter also accepts a digit after `use`, as compiler-api says.
const FILTERS: Preset['filters'] = {
  component: { source: '^[A-Z]', flags: '' },
  hook: { source: '^use[A-Z0-9]', flags: '' },
};

const REACT_HOOKS: [name: string, type: HookType][] = [
  ['useRef', 'ref'],
  ['useMemo', 'memo'],
  ['useCallback', 'callback'],
  ['useEffect', 'effect'],
  ['useLayoutEffect', 'effect'],
  ['useInsertionEffect', 'effect'],
  ['useState', 'state'],
  ['useReducer', 'state'],
  ['use', 'use'],
  ['useEffectEvent', 'effect-event'],
];

// `preact/hooks` 11.2 has no `use`, `useEffectEvent` or `useInsertionEffect`. `preact/compat` has all three.
const PREACT_HOOKS: [name: string, type: HookType][] = [
  ['useRef', 'ref'],
  ['useMemo', 'memo'],
  ['useCallback', 'callback'],
  ['useEffect', 'effect'],
  ['useLayoutEffect', 'effect'],
  ['useState', 'state'],
  ['useReducer', 'state'],
];

const PREACT_COMPAT_HOOKS: [name: string, type: HookType][] = [
  ...PREACT_HOOKS,
  ['useInsertionEffect', 'effect'],
  ['use', 'use'],
  ['useEffectEvent', 'effect-event'],
];

/** The built-in presets. Hooks and HOCs are the 0.8 lists plus the hooks React 19 added. */
export const PRESETS: Record<'react' | 'preact', Preset> = {
  react: {
    filters: FILTERS,
    runtime: { useRef: { kind: 'named', name: 'useRef', source: 'react' } },
    imports: {
      hooks: createHooks('react', REACT_HOOKS),
      hocs: createNamed('react', ['forwardRef', 'memo']),
    },
  },
  preact: {
    filters: FILTERS,
    runtime: { useRef: { kind: 'named', name: 'useRef', source: 'preact/hooks' } },
    imports: {
      hooks: [
        ...createHooks('preact/hooks', PREACT_HOOKS),
        ...createHooks('preact/compat', PREACT_COMPAT_HOOKS),
      ],
      hocs: createNamed('preact/compat', ['forwardRef', 'memo']),
    },
  },
};

export function resolvePreset(preset: CompileOptions['preset']): Preset {
  if (typeof preset === 'string') {
    return PRESETS[preset];
  }
  return preset;
}
