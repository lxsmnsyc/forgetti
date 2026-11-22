import type { SourceMap } from 'magic-string';
import { parseSync } from 'oxc-parser';

// Same shapes as 0.8 (`src/core/presets.ts`), so plugin options keep working.
export type ImportDefinition =
  | { kind: 'named'; name: string; source: string }
  | { kind: 'default'; source: string };

/** Serializable, as in 0.8. Plugins pass presets through JSON-like config. */
export interface RawRegExp {
  source: string;
  flags: string;
}

export type HookType =
  /** `useRef`: the result is a stable object. */
  | 'ref'
  /** `useMemo`: the callback runs only when deps change, and the result is opaque. */
  | 'memo'
  /** `useCallback`: the result is opaque. */
  | 'callback'
  /** `useEffect`, `useLayoutEffect`, `useInsertionEffect`: the callback never runs during render. */
  | 'effect'
  /** `useState`, `useReducer`: `[value, setter]`. The value is opaque and never mutated, the setter is stable. */
  | 'state'
  /** `use()`: may be called in branches and loops, never cached. */
  | 'use'
  /** `useEffectEvent`: the result is never an input of any slot. */
  | 'effect-event';

export interface Preset {
  filters: { component: RawRegExp; hook?: RawRegExp };
  runtime: { useRef: ImportDefinition };
  imports: {
    hooks: (ImportDefinition & { type: HookType })[];
    /** HOCs whose first argument is a component, such as `memo` and `forwardRef`. */
    hocs: ImportDefinition[];
  };
}

export interface CompileOptions {
  preset: 'react' | 'preact' | Preset;
  filename: string;
  sourceMap?: boolean;
}

export type BailoutReason =
  | 'mutates-props'
  | 'mutates-state'
  | 'mutates-hook-argument'
  | 'stores-fresh-in-ref'
  | 'stores-fresh-in-module'
  | 'returns-fresh-from-hook'
  | 'escaping-closure'
  | 'conditional-hook'
  | 'unsupported-syntax';

export interface Diagnostic {
  /** Component or hook name. */
  unit: string;
  reason: BailoutReason;
  /** UTF-16 index into the input. */
  start: number;
  end: number;
  message: string;
}

export interface CompileResult {
  code: string;
  map: SourceMap | null;
  diagnostics: Diagnostic[];
  /** Every component and hook found, compiled or not, for the bailout-rate gate. */
  units: { name: string; compiled: boolean }[];
}

const DEFAULT_FILTERS: Preset['filters'] = {
  component: { source: '^[A-Z]', flags: '' },
  hook: { source: '^use[A-Z0-9]', flags: '' },
};

// Matches `function Name`, and `const Name =` followed by `function` or an arrow.
const DECLARATION =
  /(?:\bfunction\s*\*?\s*([\p{L}_$][\p{L}\p{N}_$]*))|(?:\b(?:const|let|var)\s+([\p{L}_$][\p{L}\p{N}_$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[\p{L}_$][\p{L}\p{N}_$]*\s*=>))/gu;

function getFilters(preset: CompileOptions['preset']): Preset['filters'] {
  if (typeof preset === 'string') {
    return DEFAULT_FILTERS;
  }
  return preset.filters;
}

function createRegExp(raw: RawRegExp): RegExp {
  return new RegExp(raw.source, raw.flags);
}

/** Throws an `Error` that names the first parse error and its UTF-16 offset. */
function assertParses(code: string, filename: string): void {
  const { errors } = parseSync(filename, code, { preserveParens: false });
  for (const error of errors) {
    if (error.severity.toString() !== 'Error') {
      continue;
    }
    const start = error.labels[0]?.start ?? 0;
    throw new Error(`${error.message} (at ${start})`);
  }
}

/** Stub: finds unit names with a text scan, so the harness can count units before any phase exists. */
function scanUnits(code: string, filters: Preset['filters']): CompileResult['units'] {
  const component = createRegExp(filters.component);
  const hook = filters.hook ? createRegExp(filters.hook) : null;
  const units: CompileResult['units'] = [];
  const seen = new Set<string>();

  for (const match of code.matchAll(DECLARATION)) {
    const name: string | undefined = match[1] || match[2];
    if (!name || seen.has(name)) {
      continue;
    }
    if (component.test(name) || hook?.test(name)) {
      seen.add(name);
      units.push({ name, compiled: false });
    }
  }
  return units;
}

/** Compiles one module. The stub returns the input unchanged and lists the units it finds. */
export function compile(code: string, options: CompileOptions): CompileResult {
  // Parse first, so a syntax error surfaces the same way it will once phases exist.
  assertParses(code, options.filename);

  // No phase exists yet: nothing is compiled and nothing bails out.
  return {
    code,
    map: null,
    diagnostics: [],
    units: scanUnits(code, getFilters(options.preset)),
  };
}
