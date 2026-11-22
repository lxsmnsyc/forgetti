export type Compiler = 'plain' | 'forgetti-0.8' | 'react-compiler' | 'next';
export type Target = 'react' | 'preact';

export const COMPILERS: Compiler[] = ['plain', 'forgetti-0.8', 'react-compiler', 'next'];
export const TARGETS: Target[] = ['react', 'preact'];

/** Child components that count one render each. Every other counter key is a recompute. */
export const RENDER_KEYS = new Set(['Child', 'Row', 'Btn']);

export interface CaseMeta {
  source: string;
  license: string;
  targets: Target[];
}

export interface CorpusCase {
  set: string;
  name: string;
  dir: string;
  inputFile: string;
  source: string;
  meta: CaseMeta;
}

export interface Step {
  name: string;
  props?: unknown;
  act?: (context: ActContext) => unknown;
  context?: unknown;
}

export interface Scenario {
  name: string;
  component?: string;
  props: unknown;
  context?: { name: string; value: unknown };
  wrap?: (h: (...args: unknown[]) => unknown, element: unknown) => unknown;
  steps: Step[];
}

export interface ActContext {
  mod: Record<string, unknown>;
  startTransition: (callback: () => void) => void;
}

export interface CompileInfo {
  code: string;
  raw: number;
  gz: number;
  slots: number;
  /** Median of 20 compiles after the first one. */
  ms: number;
  units: number;
  compiled: number;
  bailouts: string[];
}

export interface StepResult {
  scenario: string;
  step: string;
  counts: Record<string, number>;
  html: string;
  error?: string;
}

export interface Cell {
  compile: CompileInfo;
  steps: StepResult[];
  /** Set when the module failed to load or a scenario threw outside a step. */
  failure?: string;
}

export interface CaseResult {
  set: string;
  name: string;
  /** Keyed by `<compiler>@<target>`. */
  cells: Map<string, Cell>;
}

export function getCellKey(compiler: Compiler, target: Target): string {
  return `${compiler}@${target}`;
}
