export type HookIdentity =
  | 'memo'
  | 'callback'
  | 'effect'
  | 'ref';

export interface NamedImportDefinition {
  kind: 'named';
  name: string;
  source: string;
}

export interface DefaultImportDefinition {
  kind: 'default';
  source: string;
}

export type ImportDefinition = NamedImportDefinition | DefaultImportDefinition;

export type HookRegistration = ImportDefinition & {
  type: HookIdentity;
};

export interface RawRegExp {
  source: string;
  flags: string;
}

export interface Preset {
  filters: {
    component: RawRegExp;
    hook?: RawRegExp;
  };
  runtime: {
    useRef: ImportDefinition;
    useMemo: ImportDefinition;
    memo?: ImportDefinition;
  };
  imports: {
    hooks: HookRegistration[];
    hocs: ImportDefinition[];
  };
  optimizations?: {
    hoistConstantJsx?: boolean;
  };
}

export interface Options {
  preset: keyof typeof PRESETS | Preset;
}

export function createPreset(preset: Preset): Preset {
  return preset;
}

export const PRESETS = {
  react: createPreset({
    filters: {
      component: {
        source: '^[A-Z]',
        flags: '',
      },
      hook: {
        source: '^use[A-Z]',
        flags: '',
      },
    },
    runtime: {
      useRef: {
        name: 'useRef',
        source: 'react',
        kind: 'named',
      },
      useMemo: {
        name: 'useMemo',
        source: 'react',
        kind: 'named',
      },
      memo: {
        name: 'memo',
        source: 'react',
        kind: 'named',
      },
    },
    imports: {
      hooks: [
        {
          type: 'ref',
          name: 'useRef',
          source: 'react',
          kind: 'named',
        },
        {
          type: 'memo',
          name: 'useMemo',
          source: 'react',
          kind: 'named',
        },
        {
          type: 'callback',
          name: 'useCallback',
          source: 'react',
          kind: 'named',
        },
        {
          type: 'effect',
          name: 'useEffect',
          source: 'react',
          kind: 'named',
        },
        {
          type: 'effect',
          name: 'useLayoutEffect',
          source: 'react',
          kind: 'named',
        },
        {
          type: 'effect',
          name: 'useInsertionEffect',
          source: 'react',
          kind: 'named',
        },
      ],
      hocs: [
        {
          name: 'forwardRef',
          source: 'react',
          kind: 'named',
        },
        {
          name: 'memo',
          source: 'react',
          kind: 'named',
        },
      ],
    },
    optimizations: {
      hoistConstantJsx: true,
    },
  }),
  preact: createPreset({
    filters: {
      component: {
        source: '^[A-Z]',
        flags: '',
      },
      hook: {
        source: '^use[A-Z]',
        flags: '',
      },
    },
    runtime: {
      useRef: {
        name: 'useRef',
        source: 'preact/hooks',
        kind: 'named',
      },
      useMemo: {
        name: 'useMemo',
        source: 'preact/hooks',
        kind: 'named',
      },
      memo: {
        name: 'memo',
        source: 'preact/compat',
        kind: 'named',
      },
    },
    imports: {
      hooks: [
        {
          type: 'ref',
          name: 'useRef',
          source: 'preact/hooks',
          kind: 'named',
        },
        {
          type: 'memo',
          name: 'useMemo',
          source: 'preact/hooks',
          kind: 'named',
        },
        {
          type: 'callback',
          name: 'useCallback',
          source: 'preact/hooks',
          kind: 'named',
        },
        {
          type: 'effect',
          name: 'useEffect',
          source: 'preact/hooks',
          kind: 'named',
        },
        {
          type: 'effect',
          name: 'useLayoutEffect',
          source: 'preact/hooks',
          kind: 'named',
        },
        {
          type: 'memo',
          name: 'useMemo',
          source: 'preact/compat',
          kind: 'named',
        },
        {
          type: 'callback',
          name: 'useCallback',
          source: 'preact/compat',
          kind: 'named',
        },
        {
          type: 'effect',
          name: 'useEffect',
          source: 'preact/compat',
          kind: 'named',
        },
        {
          type: 'effect',
          name: 'useLayoutEffect',
          source: 'preact/compat',
          kind: 'named',
        },
      ],
      hocs: [
        {
          name: 'forwardRef',
          source: 'preact/compat',
          kind: 'named',
        },
        {
          name: 'memo',
          source: 'preact/compat',
          kind: 'named',
        },
      ],
    },
    optimizations: {
      hoistConstantJsx: true,
    },
  }),
};
