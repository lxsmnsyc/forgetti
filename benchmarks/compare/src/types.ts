export type Compiler = 'plain' | 'forgetti-0.8' | 'react-compiler' | 'next';
export type Target = 'react' | 'preact';

export const COMPILERS: Compiler[] = ['plain', 'forgetti-0.8', 'react-compiler', 'next'];
export const TARGETS: Target[] = ['react', 'preact'];

/** Child components that count one render each. Every other counter key is a recompute. */
export const RENDER_KEYS = new Set(['Child', 'Row', 'Btn']);

export interface CaseMeta {
  source: string;
  license: string;
  /** One line that says what the case tests. */
  tests?: string;
  targets: Target[];
}

/** Extensions of a module file in a case folder. */
export const MODULE_FILE = /\.(jsx|tsx|js|ts)$/;

/** The `.js` name the harness writes for a module file. */
export function getOutputName(file: string): string {
  return file.replace(MODULE_FILE, '.js');
}

/** A module next to the input, in the same case folder. */
export interface SiblingModule {
  /** File name in the case folder, such as `button.jsx`. */
  file: string;
  /** Absolute path. */
  path: string;
  source: string;
}

export interface CorpusCase {
  set: string;
  name: string;
  dir: string;
  inputFile: string;
  source: string;
  /** Sibling modules, sorted by file name. Empty for a single-file case. */
  siblings: SiblingModule[];
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

/** The compiled code of one sibling module. */
export interface CompiledSibling {
  file: string;
  code: string;
}

export interface CompileInfo {
  /** The compiled input. */
  code: string;
  /** The compiled siblings. Empty for a single-file case. */
  siblings: CompiledSibling[];
  /** Bytes of every compiled file. */
  raw: number;
  /** Gzip of every compiled file, input first, then siblings by name, joined in one stream. */
  gz: number;
  slots: number;
  /** Median of 20 compiles after the first one. Summed over the files. */
  ms: number;
  units: number;
  compiled: number;
  /** A sibling's bailouts are prefixed with its file name. */
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
