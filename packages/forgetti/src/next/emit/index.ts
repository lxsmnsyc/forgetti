import MagicString from 'magic-string';
import type { SourceMap } from 'magic-string';
import type { Program } from 'oxc-parser';
import type { ImportDefinition } from '../index';
import type { Binding, CacheNode, CachePlan, Range, SlotBlock, ValueRef } from '../ir';
import type { AstIndex, AstNode } from './ast';
import {
  findExact,
  findFunction,
  findInnermost,
  getChild,
  getChildren,
  indexProgram,
  isFunction,
  isLoop,
} from './ast';

export interface EmitOptions {
  /** The preset's `useRef`. An existing import of it in the module is reused. */
  useRef: ImportDefinition;
  /** Module the runtime helpers are imported from. Default `forgetti/runtime`. */
  runtime?: string;
  filename?: string;
  sourceMap?: boolean;
}

export interface EmitInput {
  code: string;
  program: Program;
  /** Names of the bindings that block inputs refer to. */
  bindings: readonly Pick<Binding, 'id' | 'name'>[];
  plans: readonly CachePlan[];
}

export interface EmitResult {
  code: string;
  map: SourceMap | null;
}

type Helper = 'useCache' | 'branch' | 'keep' | 'EMPTY';

/**
 * Where a block's code goes. `statement`: before the statement, wrapped in braces when the
 * statement sits alone in an `if` or loop body. `prelude`: in the statement list that emit
 * builds for an expression, such as a lowered arm or an arrow function's expression body.
 */
type Anchor =
  | { kind: 'statement'; node: AstNode; wrap: boolean }
  | { kind: 'prelude'; node: AstNode };

interface State {
  code: string;
  ms: MagicString;
  index: AstIndex;
  bindingNames: Map<number, string>;
  /** Block id to the slot reads of its outputs, for inputs that read another block. */
  outputReads: Map<number, string[]>;
  helpers: Map<Helper, string>;
  useRef: { definition: ImportDefinition; local: string | undefined; imported: boolean };
  /** Unit functions and iteration callbacks. A walk may stop at their expression bodies. */
  functions: Set<AstNode>;
  /** Conditional and logical expressions that emit rewrites as `if` statements. */
  lowered: Set<AstNode>;
  done: Set<AstNode>;
  preludes: Map<AstNode, string[]>;
  wrapped: Set<AstNode>;
  /** Names emit declared inside the current unit. Each unit starts with none. */
  unitNames: Set<string>;
  counter: number;
}

function createName(state: State, base: string, scope: 'module' | 'unit' = 'unit'): string {
  // A number suffix keeps the name clear of every identifier in the module. A unit name only
  // has to differ from the other names emit declares in the same unit.
  let name = base;
  for (let suffix = 1; state.index.names.has(name) || state.unitNames.has(name); suffix++) {
    name = `${base}${suffix}`;
  }
  (scope === 'module' ? state.index.names : state.unitNames).add(name);
  return name;
}

function getHelper(state: State, helper: Helper): string {
  let local = state.helpers.get(helper);
  if (local === undefined) {
    local = createName(state, helper, 'module');
    state.helpers.set(helper, local);
  }
  return local;
}

function getUseRef(state: State): string {
  state.useRef.local ??= createName(
    state,
    state.useRef.definition.kind === 'named' ? state.useRef.definition.name : 'useRef',
    'module',
  );
  return state.useRef.local;
}

function getIndent(code: string, position: number): string {
  let index = code.lastIndexOf('\n', position - 1) + 1;
  const start = index;
  while (code[index] === ' ' || code[index] === '\t') {
    index++;
  }
  return code.slice(start, index);
}

function isArm(parent: AstNode, child: AstNode): boolean {
  if (parent.type === 'ConditionalExpression') {
    return child === getChild(parent, 'consequent') || child === getChild(parent, 'alternate');
  }
  return parent.type === 'LogicalExpression' && child === getChild(parent, 'right');
}

function findAnchor(state: State, start: AstNode): Anchor {
  // The walk goes up to the first statement of a statement list, or to the first arm of a
  // conditional, which then gets lowered. Code never leaves a branch, a loop test or a closure.
  let child = start;
  for (
    let parent = state.index.parents.get(child);
    parent;
    parent = state.index.parents.get(child)
  ) {
    // An arm runs only on its condition, so code for it goes inside the lowered arm.
    if (isArm(parent, child)) {
      state.lowered.add(parent);
      return { kind: 'prelude', node: child };
    }

    // Only an expression body of a unit or an iteration callback can hold code.
    if (isFunction(parent)) {
      if (
        state.functions.has(parent) &&
        child === getChild(parent, 'body') &&
        child.type !== 'BlockStatement'
      ) {
        return { kind: 'prelude', node: child };
      }
      throw new Error(`emit: slot code at ${start.start} would cross a function boundary`);
    }

    // A member of a statement list takes code before it.
    if (
      (parent.type === 'BlockStatement' ||
        parent.type === 'Program' ||
        parent.type === 'StaticBlock') &&
      getChildren(parent, 'body').includes(child)
    ) {
      return { kind: 'statement', node: child, wrap: false };
    }
    if (parent.type === 'SwitchCase' && getChildren(parent, 'consequent').includes(child)) {
      return { kind: 'statement', node: child, wrap: false };
    }

    // A lone `if` or loop body becomes a block, so the code stays under its condition.
    if (parent.type === 'IfStatement' && child !== getChild(parent, 'test')) {
      return { kind: 'statement', node: child, wrap: true };
    }
    if (isLoop(parent)) {
      if (child === getChild(parent, 'body')) {
        return { kind: 'statement', node: child, wrap: true };
      }
      const once =
        parent.type === 'ForInStatement' ||
        parent.type === 'ForOfStatement' ||
        child === getChild(parent, 'init');
      if (!once) {
        throw new Error(`emit: slot code at ${start.start} sits in a loop test or update`);
      }
    }
    child = parent;
  }
  throw new Error(`emit: no statement holds ${start.start}`);
}

function getAnchorIndent(state: State, anchor: Anchor): string {
  const indent = getIndent(state.code, anchor.node.start);
  return anchor.kind === 'prelude' ? `${indent}  ` : indent;
}

function getPrelude(state: State, node: AstNode): string[] {
  let prelude = state.preludes.get(node);
  if (!prelude) {
    prelude = [];
    state.preludes.set(node, prelude);
  }
  return prelude;
}

function wrapStatement(state: State, node: AstNode): void {
  if (!state.wrapped.has(node)) {
    state.wrapped.add(node);
    state.ms.appendLeft(node.start, '{ ');
    state.ms.prependRight(node.end, ' }');
  }
}

function insertCode(state: State, anchor: Anchor, code: string): void {
  if (anchor.kind === 'prelude') {
    getPrelude(state, anchor.node).push(code);
    return;
  }
  if (anchor.wrap) {
    wrapStatement(state, anchor.node);
  }
  state.ms.appendLeft(anchor.node.start, `${code}\n${getIndent(state.code, anchor.node.start)}`);
}

function takeText(state: State, range: Range): string {
  lowerWithin(state, range);
  return state.ms.slice(range.start, range.end);
}

function getInput(state: State, ref: ValueRef): string {
  let name: string | undefined;
  if (ref.kind === 'output') {
    name = state.outputReads.get(ref.block)?.[ref.index];
  } else {
    name = state.bindingNames.get(ref.id);
    if (name !== undefined && ref.kind === 'member') {
      name = `${name}.${ref.name}`;
    }
  }
  if (name === undefined) {
    throw new Error(`emit: unknown input ${JSON.stringify(ref)}`);
  }
  return name;
}

function createBlockCode(state: State, cache: string, block: SlotBlock, texts: string[]): string {
  // Every value is computed before any slot is written, so a throw leaves the slots as they
  // were (debate J13). A keep block hands the array to the runtime, which stores it after it is built.
  if (block.kind === 'keep') {
    return `${getHelper(state, 'keep')}(${cache}, ${block.first}, ${texts[0]});`;
  }

  // A block without inputs computes once, while its first value slot is still empty.
  const valueStart = block.first + block.inputs.length;
  const inputs: string[] = [];
  const checks: string[] = [];
  for (const [position, ref] of block.inputs.entries()) {
    const input = getInput(state, ref);
    inputs.push(input);
    checks.push(`!Object.is(${cache}[${block.first + position}], ${input})`);
  }
  if (checks.length === 0) {
    checks.push(`${cache}[${valueStart}] === ${getHelper(state, 'EMPTY')}`);
  }

  // One value is computed, then stored. Several values are all computed into locals first.
  const body: string[] = [];
  if (block.outputs.length === 1) {
    body.push(`${cache}[${valueStart}] = ${texts[0]};`);
  } else {
    const locals: string[] = [];
    for (const [position, output] of block.outputs.entries()) {
      locals.push(`${output.local} = ${texts[position]}`);
    }
    body.push(`const ${locals.join(', ')};`);
    for (const [position, output] of block.outputs.entries()) {
      body.push(`${cache}[${valueStart + position}] = ${output.local};`);
    }
  }
  for (const [position, input] of inputs.entries()) {
    body.push(`${cache}[${block.first + position}] = ${input};`);
  }
  return `if (${checks.join(' || ')}) { ${body.join(' ')} }`;
}

function getOutputSlots(cache: string, block: SlotBlock): string[] {
  const valueStart = block.kind === 'keep' ? block.first : block.first + block.inputs.length;
  const slots: string[] = [];
  for (const position of block.outputs.keys()) {
    slots.push(`${cache}[${valueStart + position}]`);
  }
  return slots;
}

function lowerWithin(state: State, range: Range): void {
  // Innermost first, so an outer arm's text already holds the lowered inner expression.
  const pending: AstNode[] = [];
  for (const node of state.lowered) {
    if (!state.done.has(node) && range.start <= node.start && node.end <= range.end) {
      pending.push(node);
    }
  }
  pending.sort((left, right) => left.end - left.start - (right.end - right.start));
  for (const node of pending) {
    lowerExpression(state, node);
  }
}

function createArm(state: State, arm: AstNode, last: string, indent: string): string {
  const lines = [...(state.preludes.get(arm) ?? []), last];
  return `\n${indent}  ${lines.join(`\n${indent}  `)}\n${indent}`;
}

function lowerExpression(state: State, node: AstNode): void {
  // The expression becomes an `if` statement before its statement, so each arm gets a
  // statement list for its cache code, and the expression is replaced by a local.
  state.done.add(node);
  const anchor = findAnchor(state, node);
  const indent = getAnchorIndent(state, anchor);

  if (node.type === 'ConditionalExpression') {
    const test = getChild(node, 'test');
    const consequent = getChild(node, 'consequent');
    const alternate = getChild(node, 'alternate');
    if (!test || !consequent || !alternate) {
      throw new Error('emit: malformed conditional');
    }
    const testText = takeText(state, test);
    const consequentText = takeText(state, consequent);
    const alternateText = takeText(state, alternate);

    // A returned conditional returns from each arm, so it needs no local.
    if (
      anchor.kind === 'statement' &&
      anchor.node.type === 'ReturnStatement' &&
      getChild(anchor.node, 'argument') === node
    ) {
      const consequentArm = createArm(state, consequent, `return ${consequentText};`, indent);
      const alternateArm = createArm(state, alternate, `return ${alternateText};`, indent);
      state.ms.overwrite(
        anchor.node.start,
        anchor.node.end,
        `if (${testText}) {${consequentArm}} else {${alternateArm}}`,
      );
      return;
    }

    const local = createName(state, '$v');
    const consequentArm = createArm(state, consequent, `${local} = ${consequentText};`, indent);
    const alternateArm = createArm(state, alternate, `${local} = ${alternateText};`, indent);
    insertCode(
      state,
      anchor,
      `let ${local};\n${indent}if (${testText}) {${consequentArm}} else {${alternateArm}}`,
    );
    state.ms.overwrite(node.start, node.end, local);
    return;
  }

  // A logical expression keeps its left value unless the right side runs.
  const left = getChild(node, 'left');
  const right = getChild(node, 'right');
  if (!left || !right) {
    throw new Error('emit: malformed logical expression');
  }
  const leftText = takeText(state, left);
  const rightText = takeText(state, right);
  const local = createName(state, '$v');
  let test = local;
  if (node.operator === '||') {
    test = `!${local}`;
  } else if (node.operator === '??') {
    test = `${local} == null`;
  }
  const arm = createArm(state, right, `${local} = ${rightText};`, indent);
  insertCode(state, anchor, `let ${local} = ${leftText};\n${indent}if (${test}) {${arm}}`);
  state.ms.overwrite(node.start, node.end, local);
}

/** The code region a cache node owns: a statement it opens, or an expression it lowers. */
interface Region {
  node: AstNode;
  /** `expression`: emit builds a statement list for it. `statement`: code goes inside it. */
  kind: 'statement' | 'expression';
  /** The function whose expression body is the region, when it is one. */
  owner?: AstNode;
}

function insertHeader(state: State, region: Region, header: string): void {
  const { node } = region;

  // An expression region gets a statement list, and the header is its first statement.
  if (region.kind === 'expression') {
    getPrelude(state, node).unshift(header);
    return;
  }

  // A block or a case takes the header before its first statement.
  if (node.type === 'BlockStatement') {
    const first = getChildren(node, 'body').at(0);
    const indent = first
      ? getIndent(state.code, first.start)
      : `${getIndent(state.code, node.start)}  `;
    state.ms.appendLeft(node.start + 1, `\n${indent}${header}`);
    return;
  }
  if (node.type === 'SwitchCase') {
    const first = getChildren(node, 'consequent').at(0);
    if (first) {
      state.ms.appendLeft(first.start, `${header}\n${getIndent(state.code, first.start)}`);
    }
    return;
  }

  // A lone statement becomes a block that opens with the header.
  wrapStatement(state, node);
  state.ms.appendLeft(node.start, `${header} `);
}

function finishExpressionBody(state: State, fn: AstNode, body: AstNode): void {
  // The body becomes a block: the region's prelude, then a return of the body.
  const arrow = state.code.lastIndexOf('=>', body.start) + 2;
  // The slice keeps the parentheses around an object literal body.
  const text = state.ms.slice(arrow, fn.end).trim();
  const indent = getIndent(state.code, fn.start);
  const arm = createArm(state, body, `return ${text};`, indent);
  state.ms.overwrite(arrow, fn.end, ` {${arm}}`);
}

function getCallbackIndex(state: State, fn: AstNode, node: CacheNode): string {
  const params = getChildren(fn, 'params');
  const first = params.at(0);
  const second = params.at(1);
  if (second) {
    if (second.type !== 'Identifier' || typeof second.name !== 'string') {
      throw new Error('emit: the index parameter of an iteration callback is not an identifier');
    }
    return second.name;
  }
  const index = node.indexLocal ?? createName(state, 'i');
  if (!first) {
    const open = state.code.indexOf('(', fn.start);
    state.ms.appendLeft(open + 1, `${createName(state, '_')}, ${index}`);
    return index;
  }
  // `item => ...` has no parentheses around its parameter.
  if (
    state.code[first.start - 1] === '(' ||
    state.code.slice(fn.start, first.start).includes('(')
  ) {
    state.ms.appendLeft(first.end, `, ${index}`);
  } else {
    state.ms.prependRight(first.start, '(');
    state.ms.appendLeft(first.end, `, ${index})`);
  }
  return index;
}

/** A slot read that replaces a JSX child or attribute value needs braces to stay an expression. */
function wrapJsxRead(state: State, range: Range, read: string): string {
  const parent = state.index.parents.get(findExact(state.index, range));
  const isChild = parent?.type === 'JSXElement' || parent?.type === 'JSXFragment';
  return isChild || parent?.type === 'JSXAttribute' ? `{${read}}` : read;
}

function getBlockTarget(state: State, block: SlotBlock): AstNode {
  // An `at` that names a whole block or case, as a branch arm does, means the statement
  // inside it that holds the output.
  const target = findInnermost(state.index, block.at);
  const [output] = block.outputs;
  if (
    (target.type === 'BlockStatement' || target.type === 'SwitchCase') &&
    target.start <= output.range.start &&
    output.range.end <= target.end
  ) {
    return findInnermost(state.index, output.range);
  }
  return target;
}

function getSpan(block: SlotBlock): number {
  let start = Infinity;
  let end = -Infinity;
  for (const output of block.outputs) {
    start = Math.min(start, output.range.start);
    end = Math.max(end, output.range.end);
  }
  return end - start;
}

function emitNode(
  state: State,
  node: CacheNode,
  region: Region,
  header: string,
  cache: string,
): void {
  // The header goes first, so code that later lands at the same index comes after it.
  insertHeader(state, region, header);

  // Children first, so their text is final before a block of this node moves it.
  for (const child of node.children) {
    emitChild(state, child, cache);
  }

  // Each output is read from its slot. The slot holds the value once the block's code ran.
  for (const block of node.blocks) {
    state.outputReads.set(block.id, getOutputSlots(cache, block));
  }

  // Blocks go innermost first: a block that holds another output moves it with its slot read.
  const blocks = [...node.blocks].sort((left, right) => getSpan(left) - getSpan(right));
  for (const block of blocks) {
    const anchor = findAnchor(state, getBlockTarget(state, block));
    const reads = getOutputSlots(cache, block);
    const texts: string[] = [];
    for (const [position, output] of block.outputs.entries()) {
      texts.push(takeText(state, output.range));
      state.ms.overwrite(
        output.range.start,
        output.range.end,
        wrapJsxRead(state, output.range, reads[position]),
      );
    }
    insertCode(state, anchor, createBlockCode(state, cache, block, texts));
  }

  // Conditionals inside the region are lowered before an expression body is closed.
  lowerWithin(state, region.node);
  if (region.owner) {
    finishExpressionBody(state, region.owner, region.node);
  }
}

function getBodyRegion(fn: AstNode): Region {
  const body = getChild(fn, 'body');
  if (!body) {
    throw new Error('emit: function without a body');
  }
  return body.type === 'BlockStatement'
    ? { node: body, kind: 'statement' }
    : { node: body, kind: 'expression', owner: fn };
}

function emitChild(state: State, node: CacheNode, parentCache: string): void {
  if (node.parentIndex === undefined) {
    throw new Error(`emit: a ${node.kind} node has no parentIndex`);
  }
  state.counter++;
  const cache = createName(state, `$${state.counter}`);
  const branch = getHelper(state, 'branch');

  if (node.kind === 'branch') {
    const arm = findExact(state.index, node.arm ?? node.range);
    const parent = state.index.parents.get(arm);
    const kind = parent && isArm(parent, arm) ? 'expression' : 'statement';
    const header = `const ${cache} = ${branch}(${parentCache}, ${node.parentIndex}, ${node.size});`;
    emitNode(state, node, { node: arm, kind }, header, cache);
    return;
  }
  if (node.kind !== 'iteration') {
    throw new Error('emit: a root node cannot be a child');
  }

  // Each row's cache sits in a rows array at the parent slot, by position.
  const body = findExact(state.index, node.body ?? node.range);
  const owner = state.index.parents.get(body);
  const rows = createName(state, `${cache}r`);
  if (owner && isFunction(owner) && getChild(owner, 'body') === body) {
    const index = getCallbackIndex(state, owner, node);
    const header = `const ${rows} = ${branch}(${parentCache}, ${node.parentIndex}, 0), ${cache} = ${branch}(${rows}, ${index}, ${node.size});`;
    emitNode(state, node, getBodyRegion(owner), header, cache);
    return;
  }
  if (owner && isLoop(owner) && getChild(owner, 'body') === body) {
    // A loop has no index of its own, so a counter starts at -1 before it and counts up first.
    const index = createName(state, node.indexLocal ?? 'i');
    const anchor = findAnchor(state, owner);
    insertCode(state, anchor, `let ${index} = -1;`);
    const header = `const ${rows} = ${branch}(${parentCache}, ${node.parentIndex}, 0), ${cache} = ${branch}(${rows}, ++${index}, ${node.size});`;
    emitNode(state, node, { node: body, kind: 'statement' }, header, cache);
    return;
  }
  throw new Error('emit: an iteration body is neither a callback body nor a loop body');
}

function preparePlan(state: State, plan: CachePlan): void {
  // Functions and lowered expressions are known before any edit. Functions come first,
  // since walks may stop at their expression bodies.
  const nodes: CacheNode[] = [plan.root];
  for (const node of nodes) {
    nodes.push(...node.children);
    for (const block of node.blocks) {
      for (const output of block.outputs) {
        state.index.names.add(output.local);
      }
    }
    if (node.kind === 'iteration') {
      const owner = state.index.parents.get(findExact(state.index, node.body ?? node.range));
      if (owner && isFunction(owner)) {
        state.functions.add(owner);
      }
    }
  }

  // Each block's anchor and each branch arm decide which expressions get lowered.
  for (const node of nodes) {
    if (node.kind === 'branch') {
      const arm = findExact(state.index, node.arm ?? node.range);
      const parent = state.index.parents.get(arm);
      if (parent && isArm(parent, arm)) {
        state.lowered.add(parent);
      }
    }
    for (const block of node.blocks) {
      findAnchor(state, getBlockTarget(state, block));
    }
  }

  // A lowered expression moves before its statement, which may lower the arms around it.
  // A set visits the items added while it is iterated, so this reaches every one.
  for (const node of state.lowered) {
    findAnchor(state, node);
  }
}

function findImportedLocal(program: AstNode, definition: ImportDefinition): string | undefined {
  for (const statement of getChildren(program, 'body')) {
    if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') {
      continue;
    }
    if (getChild(statement, 'source')?.value !== definition.source) {
      continue;
    }
    for (const specifier of getChildren(statement, 'specifiers')) {
      const local = getChild(specifier, 'local')?.name;
      if (typeof local !== 'string' || specifier.importKind === 'type') {
        continue;
      }
      if (definition.kind === 'default' && specifier.type === 'ImportDefaultSpecifier') {
        return local;
      }
      const imported = getChild(specifier, 'imported');
      const name = imported?.name ?? imported?.value;
      if (
        definition.kind === 'named' &&
        specifier.type === 'ImportSpecifier' &&
        name === definition.name
      ) {
        return local;
      }
    }
  }
  return undefined;
}

function insertImports(state: State, runtime: string): void {
  // The runtime helpers, then `useRef` unless the module imports it already.
  const lines: string[] = [];
  const specifiers: string[] = [];
  for (const [helper, local] of state.helpers) {
    specifiers.push(helper === local ? helper : `${helper} as ${local}`);
  }
  if (specifiers.length > 0) {
    lines.push(`import { ${specifiers.join(', ')} } from '${runtime}';`);
  }
  const { definition, local, imported } = state.useRef;
  if (local !== undefined && !imported) {
    if (definition.kind === 'default') {
      lines.push(`import ${local} from '${definition.source}';`);
    } else {
      const alias = definition.name === local ? local : `${definition.name} as ${local}`;
      lines.push(`import { ${alias} } from '${definition.source}';`);
    }
  }
  if (lines.length === 0) {
    return;
  }

  // The imports go after any directive prologue or hashbang.
  let directiveEnd = -1;
  for (const statement of getChildren(state.index.root, 'body')) {
    if (statement.type !== 'ExpressionStatement' || typeof statement.directive !== 'string') {
      break;
    }
    directiveEnd = statement.end;
  }
  const text = lines.join('\n');
  if (directiveEnd !== -1) {
    state.ms.appendLeft(directiveEnd, `\n${text}`);
  } else if (state.code.startsWith('#!')) {
    state.ms.appendLeft(state.code.indexOf('\n') + 1, `${text}\n`);
  } else {
    state.ms.prepend(`${text}\n`);
  }
}

/** Phase 5: writes the cache code of every plan into the module, at the plan's ranges. */
export function emit(input: EmitInput, options: EmitOptions): EmitResult {
  const index = indexProgram(input.program);
  const existing = findImportedLocal(index.root, options.useRef);
  const state: State = {
    code: input.code,
    ms: new MagicString(input.code),
    index,
    bindingNames: new Map(),
    outputReads: new Map(),
    helpers: new Map(),
    useRef: { definition: options.useRef, local: existing, imported: existing !== undefined },
    functions: new Set(),
    lowered: new Set(),
    done: new Set(),
    preludes: new Map(),
    wrapped: new Set(),
    unitNames: new Set(),
    counter: 0,
  };
  for (const binding of input.bindings) {
    state.bindingNames.set(binding.id, binding.name);
  }

  // Every unit function is known before any walk, since a walk may stop at its body.
  const roots: AstNode[] = [];
  for (const plan of input.plans) {
    const fn = findFunction(index, plan.root.range);
    state.functions.add(fn);
    roots.push(fn);
  }
  for (const plan of input.plans) {
    preparePlan(state, plan);
  }

  for (const [position, plan] of input.plans.entries()) {
    const root = plan.root;
    if (root.size === 0 && root.children.length === 0) {
      continue;
    }
    const fn = roots[position];
    state.unitNames.clear();
    state.counter = 0;
    const cache = createName(state, '$');
    const header = `const ${cache} = ${getHelper(state, 'useCache')}(${getUseRef(state)}, ${root.size});`;
    emitNode(state, root, getBodyRegion(fn), header, cache);
  }

  // Anything still pending is lowered, then the imports go on top.
  lowerWithin(state, index.root);
  insertImports(state, options.runtime ?? 'forgetti/runtime');

  return {
    code: state.ms.toString(),
    map: options.sourceMap
      ? state.ms.generateMap({
          source: options.filename,
          includeContent: true,
          hires: true,
        })
      : null,
  };
}
