/**
 * A Babel AST node, read loosely. Operators look at a few fields by name and edit the
 * source by its `start` and `end` offsets, so the full Babel types are not needed.
 */
export interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/**
 * One change to the source. `start === end` inserts `text`. Edits at the same position
 * apply in `bias` order, low first, so an outer wrapper opens before an inner one
 * (low bias at the start) and closes after it (high bias at the end).
 */
export interface Edit {
  start: number;
  end: number;
  text: string;
  bias: number;
  /** Edits with the same key apply once, such as the block an expression body becomes. */
  key?: string;
}

/** A place in a function's returned JSX where an operator can render a probe value. */
export interface Probe {
  /** Edits that render `{text}` (or the element `text` when `element` is set) in the returned JSX. */
  render(text: string, element?: boolean): Edit[];
  /** Position after the host element's name, for a `ref` attribute. Null without a host element or when it has a `ref`. */
  attributeAt: number | null;
  /** Start of the return statement or expression body that holds the probe. */
  returnStart: number;
}

export interface FunctionInfo {
  node: Node;
  params: Node[];
  body: Node;
  /** Inserts statements at the start of the body. An expression body becomes a block. */
  prepend(text: string): Edit[];
  /** The probe in the last return with JSX, or null. */
  probe: Probe | null;
  /** All returns with JSX, in source order. */
  probes: Probe[];
  /** Every returned expression (an expression body counts as one), not counting nested functions. */
  returns: Node[];
  /** Edits that put `open` before and `close` after every returned expression. `outer` nests it outside. */
  wrapReturns(open: string, close: string, outer?: boolean): Edit[];
}

export interface ComponentInfo extends FunctionInfo {
  name: string;
  exported: boolean;
  /** `memo` or `forwardRef` when the binding wraps the function in such a call. */
  wrapper: 'memo' | 'forwardRef' | null;
  /** Start of the top-level statement that declares the component. */
  statementStart: number;
}

export interface SourceFile {
  /** `<set>/<case>`. */
  id: string;
  code: string;
  program: Node;
  /** Components in source order, exported ones first. */
  components: ComponentInfo[];
  /** Names bound at the top level, imports included. */
  topLevel: Set<string>;
  /** Names imported from `react`, local name to imported name. */
  reactImports: Map<string, string>;
  /** Components an export reaches through a `memo` node on some path. */
  behindMemo: Set<string>;
  /** Components whose own render function is the body of a `memo` node (`memo(fn)` or `memo(B)`). */
  memoBodies: Set<string>;
  /** Reads the source text of a node. */
  slice(node: Node): string;
}

export interface MutantSpec {
  /** Names the shape, such as `map` or `memo-now`. Reports group mutants by `<operator>/<variant>`. */
  variant: string;
  /** Where the hazard goes, such as the component name. */
  site: string;
  edits: Edit[];
  /** Module-level code appended to the file. Equal snippets are written once. */
  helpers?: string[];
  /** Names the mutant needs from `react`, such as `memo` or `useRef`. */
  react?: string[];
  /**
   * The component whose render holds the hazard. Defaults to the component around the
   * first edit. It decides whether the mutant sits behind `memo` (see `Mutant.exempt`).
   */
  component?: string;
  /** The hazard is in a new child wrapped in `memo`, which may skip renders on equal props. */
  memoChild?: boolean;
  /**
   * The mutant writes to a value the component reached through its props. Changing
   * props breaks the Rules of React, so the user ruled it out of contract: its
   * differences are reported as allowed (props mutation) and do not fail the run.
   */
  propsMutation?: boolean;
}

/** A mutation operator. Each one lives in its own module under `operators/`. */
export interface Operator {
  name: string;
  /** One line on the hazard it inserts. */
  hazard: string;
  generate(file: SourceFile): MutantSpec[];
}

/** A generated mutant, ready to run. */
export interface Mutant {
  operator: string;
  variant: string;
  site: string;
  /** Index among the mutants of the same operator, variant and file. */
  index: number;
  source: string;
  /**
   * Set when the hazard may render behind `memo`. React may skip a `memo` component
   * whose props are equal, and keeping props equal is what a compiler is for, so a
   * stale value there is allowed (debate-2: `memo` stays exempt). A load failure or a
   * different error still counts.
   */
  exempt: string | null;
  /** Copied from `MutantSpec.propsMutation`. */
  propsMutation: boolean;
}
