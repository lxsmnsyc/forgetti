import type {
  ArrowFunctionExpression,
  IdentifierReference,
  Function as OxcFunction,
  Program,
} from 'oxc-parser';
import type { BailoutReason } from './index';

export interface Range {
  start: number;
  end: number;
}

// Phase 1: parse and scope

/** A lexical scope inside a unit. Branch and loop scopes let eligibility find conditional hooks. */
export interface Scope {
  id: number;
  parent: number | null;
  kind: 'unit' | 'function' | 'block' | 'branch' | 'loop' | 'catch';
  range: Range;
}

export interface Reference {
  range: Range;
  write: boolean;
  node: IdentifierReference;
  scope: number;
  /** Set when the reference sits inside a nested function of the unit. */
  closure?: number;
}

export interface Binding {
  id: number;
  name: string;
  kind: 'param' | 'const' | 'let' | 'var' | 'function' | 'class' | 'import' | 'catch';
  declaration: Range;
  scope: number;
  references: Reference[];
  /** Set for import bindings. */
  imported?: { source: string; name: string };
}

export interface Unit {
  id: number;
  kind: 'component' | 'hook';
  name: string;
  node: OxcFunction | ArrowFunctionExpression;
  /** True after a `@forgetti skip` block comment. */
  skip: boolean;
}

export interface ScopeResult {
  program: Program;
  units: Unit[];
  bindings: Binding[];
  scopes: Scope[];
  /** Looks a binding up by node identity. */
  bindingOf(node: IdentifierReference): Binding | undefined;
}

// Phase 2: eligibility

export type Eligibility =
  | { unit: number; ok: true }
  | { unit: number; ok: false; reason: BailoutReason; range: Range; message: string };

// Phase 3: ownership

export interface Group {
  id: number;
  /** Binding ids that may point at the group's fresh value. */
  members: number[];
  created: Range[];
  /**
   * Statements or calls that mutate any member, in source order, with the scope they run in.
   * A mutation in a loop scope repeats, so the group stays fresh until the loop's range ends.
   */
  mutations: { range: Range; scope: number }[];
  /** Index after the last mutation, extended to the end of any loop that holds one. */
  frozenAt: number;
  /** Binding ids of the group's non-fresh inputs (props, state, hook results). */
  inputs: number[];
}

export interface OwnershipResult {
  unit: number;
  groups: Group[];
  opaque: number[];
}

// Phase 4: cache-tree plan

export type ValueRef =
  | { kind: 'binding'; id: number }
  | { kind: 'output'; block: number; index: number };

export interface Output {
  range: Range;
  local: string;
}

export interface SlotBlock {
  id: number;
  /** `value`: inputs then outputs. `keep`: one slot holding an array passed through `keep()`. */
  kind: 'value' | 'keep';
  /** Index of the block's first slot in its cache node. */
  first: number;
  inputs: ValueRef[];
  outputs: Output[];
  /**
   * Root and iteration nodes: the block's code is inserted before the statement that holds
   * `at`. Branch nodes: `at` is the arm, and the code goes inside the arm that emit lowers
   * to a statement list. In both cases each output's range is replaced by its local, and the
   * local is declared with `let` in the inserted code.
   * Output ranges of different blocks may nest when a later block reads an earlier block's
   * output through a `ValueRef`. The earlier block has the lower `first`.
   */
  at: Range;
}

export interface CacheNode {
  kind: 'root' | 'branch' | 'iteration';
  range: Range;
  /** Slot count. A block holds `inputs.length + outputs.length` slots, a child node holds one. */
  size: number;
  blocks: SlotBlock[];
  children: CacheNode[];
  /** Branch and iteration nodes: the slot index in the parent. */
  parentIndex?: number;
  /** Branch nodes: the arm this cache serves (consequent, alternate, a switch case or a logical right side). */
  arm?: Range;
  /** Iteration nodes: the loop body or callback body. */
  body?: Range;
  /** Iteration nodes: the index variable. Emit declares a counter local of this name when the source has none. */
  indexLocal?: string;
}

export interface CachePlan {
  unit: number;
  root: CacheNode;
}
