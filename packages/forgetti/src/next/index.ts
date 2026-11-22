import type { SourceMap } from 'magic-string';
import { checkEligibility } from './eligibility';
import { emit } from './emit';
import type { CachePlan } from './ir';
import { analyzeOwnership } from './ownership';
import { parseAndScope, resolvePreset } from './parse';
import { runPlanPasses } from './plan';

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

/** Compiles one module. Throws on a syntax error, like `parseAndScope`. */
export function compile(code: string, options: CompileOptions): CompileResult {
  // Phase 1: parse, find units and build scopes.
  const preset = resolvePreset(options.preset);
  const parsed = parseAndScope(code, options);

  // Phase 2: eligibility. Skipped units get neither a diagnostic nor a plan.
  const eligibility = checkEligibility(parsed, preset);
  const diagnostics: Diagnostic[] = [];
  const units: CompileResult['units'] = [];
  const plans: CachePlan[] = [];

  for (const unit of parsed.units) {
    const entry = eligibility.find((item) => item.unit === unit.id);
    if (unit.skip) {
      units.push({ name: unit.name, compiled: false });
      continue;
    }
    if (entry && !entry.ok) {
      diagnostics.push({
        unit: unit.name,
        reason: entry.reason,
        start: entry.range.start,
        end: entry.range.end,
        message: entry.message,
      });
      units.push({ name: unit.name, compiled: false });
      continue;
    }

    // Phase 3: ownership. A closure that escapes early bails the unit out.
    const ownership = analyzeOwnership(parsed, unit.id);
    const bailout = ownership.bailout;
    if (bailout) {
      diagnostics.push({
        unit: unit.name,
        reason: bailout.reason,
        start: bailout.range.start,
        end: bailout.range.end,
        message: bailout.message,
      });
      units.push({ name: unit.name, compiled: false });
      continue;
    }

    // Phase 4: the planner passes. A unit with no block is compiled and left as written.
    const empty: CachePlan = {
      unit: unit.id,
      root: {
        kind: 'root',
        range: { start: unit.node.start, end: unit.node.end },
        size: 0,
        blocks: [],
        children: [],
      },
    };
    const plan = runPlanPasses(parsed, ownership, empty);
    if (plan.root.blocks.length > 0 || plan.root.children.length > 0) {
      plans.push(plan);
    }
    units.push({ name: unit.name, compiled: true });
  }

  // Phase 5: emit. Nothing is written when no unit has a plan.
  if (plans.length === 0) {
    return { code, map: null, diagnostics, units };
  }
  const result = emit(
    { code, program: parsed.program, bindings: parsed.bindings, plans },
    { useRef: preset.runtime.useRef, filename: options.filename, sourceMap: options.sourceMap },
  );
  return { code: result.code, map: result.map, diagnostics, units };
}
