import type { ArrowFunctionExpression, Comment, Function as OxcFunction } from 'oxc-parser';
import type { AstNode } from '../emit/ast';
import { getChild, getChildren, isNode } from '../emit/ast';
import type { Preset } from '../index';
import type { Binding, Unit } from '../ir';

interface Context {
  code: string;
  /** `@forgetti skip` comments, sorted by position. */
  skips: Comment[];
  /** All comments, sorted by position. */
  comments: Comment[];
  component: RegExp;
  hook: RegExp | null;
  hocs: Preset['imports']['hocs'];
  bindingOf: Map<object, Binding>;
  units: Unit[];
  seen: Set<object>;
}

const FORGETTI_SKIP = /^\s*@forgetti skip\s*$/;

// TS wrappers that 0.8 looks through to find a function or a callee.
const WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

function isUnitNode(value: unknown): value is OxcFunction | ArrowFunctionExpression {
  return (
    isNode(value) &&
    (value.type === 'FunctionDeclaration' ||
      value.type === 'FunctionExpression' ||
      value.type === 'ArrowFunctionExpression')
  );
}

function unwrap(node: AstNode): AstNode {
  let current = node;
  while (WRAPPERS.has(current.type)) {
    const expression = getChild(current, 'expression');
    if (!expression) {
      break;
    }
    current = expression;
  }
  return current;
}

function getName(node: AstNode | undefined): string | undefined {
  return node?.type === 'Identifier' && typeof node.name === 'string' ? node.name : undefined;
}

/** True when a `@forgetti skip` comment comes right before `start`, with only whitespace or comments between. */
function hasSkipComment(context: Context, start: number): boolean {
  let position = start;
  for (let index = context.comments.length - 1; index >= 0; index--) {
    const comment = context.comments[index];
    if (comment.end > position) {
      continue;
    }
    if (context.code.slice(comment.end, position).trim() !== '') {
      return false;
    }
    if (FORGETTI_SKIP.test(comment.value)) {
      return true;
    }
    position = comment.start;
  }
  return false;
}

/** True when any of `nodes` has a `@forgetti skip` comment right before it. */
function isSkipped(context: Context, nodes: (AstNode | undefined)[]): boolean {
  if (context.skips.length === 0) {
    return false;
  }
  for (const node of nodes) {
    if (node && hasSkipComment(context, node.start)) {
      return true;
    }
  }
  return false;
}

function getUnitKind(context: Context, name: string): Unit['kind'] | undefined {
  if (context.component.test(name)) {
    return 'component';
  }
  if (context.hook?.test(name)) {
    return 'hook';
  }
  return undefined;
}

function addUnit(
  context: Context,
  node: AstNode,
  kind: Unit['kind'],
  name: string,
  skip: boolean,
): void {
  // 0.8 leaves async and generator functions alone.
  if (!isUnitNode(node) || context.seen.has(node) || node.async || node.generator) {
    return;
  }
  context.seen.add(node);
  context.units.push({ id: context.units.length, kind, name, node, skip });
}

function matchesHOC(context: Context, imported: Binding['imported'], name: string): boolean {
  if (!imported) {
    return false;
  }
  for (const hoc of context.hocs) {
    const hocName = hoc.kind === 'named' ? hoc.name : 'default';
    if (hoc.source === imported.source && hocName === name) {
      return true;
    }
  }
  return false;
}

/** True when `callee` is an imported HOC, such as `memo` or `React.memo` from `import * as React`. */
function isHOC(context: Context, callee: AstNode): boolean {
  const target = unwrap(callee);
  if (target.type === 'Identifier') {
    const binding = context.bindingOf.get(target);
    return (
      binding?.kind === 'import' &&
      matchesHOC(context, binding.imported, binding.imported?.name ?? '')
    );
  }
  if (target.type !== 'MemberExpression' || target.computed === true) {
    return false;
  }
  const object = getChild(target, 'object');
  const property = getName(getChild(target, 'property'));
  if (!object || property === undefined) {
    return false;
  }
  const objectNode = unwrap(object);
  if (objectNode.type !== 'Identifier') {
    return false;
  }
  const binding = context.bindingOf.get(objectNode);
  return binding?.imported?.name === '*' && matchesHOC(context, binding.imported, property);
}

/** Names a HOC argument after the variable or export that holds the call. */
function getHOCName(ancestors: AstNode[]): string {
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const node = ancestors[index];
    if (node.type === 'CallExpression' || WRAPPERS.has(node.type)) {
      continue;
    }
    if (node.type === 'VariableDeclarator') {
      return getName(getChild(node, 'id')) ?? 'anonymous';
    }
    if (node.type === 'AssignmentExpression') {
      return getName(getChild(node, 'left')) ?? 'anonymous';
    }
    if (node.type === 'ExportDefaultDeclaration') {
      return 'default';
    }
    return 'anonymous';
  }
  return 'anonymous';
}

/** Returns the statement nodes whose leading comments apply to `node`: itself and an `export` around it. */
function getCommentTargets(node: AstNode, ancestors: AstNode[]): (AstNode | undefined)[] {
  const parent = ancestors.at(-1);
  if (
    parent &&
    (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration')
  ) {
    return [node, parent];
  }
  return [node];
}

function visitCall(context: Context, node: AstNode, ancestors: AstNode[]): void {
  const callee = getChild(node, 'callee');
  const args = getChildren(node, 'arguments');
  if (!callee || args.length === 0 || !isHOC(context, callee)) {
    return;
  }
  const fn = unwrap(args[0]);
  if (!isUnitNode(fn)) {
    return;
  }

  // The statement holding the call carries the skip comment.
  let statement: AstNode | undefined;
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const ancestor = ancestors[index];
    if (ancestor.type === 'VariableDeclaration' || ancestor.type === 'ExpressionStatement') {
      statement = ancestor;
      break;
    }
    // A comment on a statement outside the enclosing function does not apply.
    if (isUnitNode(ancestor)) {
      break;
    }
  }
  const skip = isSkipped(context, [statement, ancestors.at(-1), node, fn]);
  addUnit(
    context,
    fn,
    'component',
    getName(getChild(fn, 'id')) ?? getHOCName([...ancestors, node]),
    skip,
  );
}

function visitDeclarator(context: Context, node: AstNode, ancestors: AstNode[]): void {
  const name = getName(getChild(node, 'id'));
  const init = getChild(node, 'init');
  if (name === undefined || !init) {
    return;
  }
  const kind = getUnitKind(context, name);
  if (!kind) {
    return;
  }
  const declaration = ancestors.at(-1);
  const targets = declaration ? getCommentTargets(declaration, ancestors.slice(0, -1)) : [];
  addUnit(context, unwrap(init), kind, name, isSkipped(context, [node, ...targets]));
}

function visitFunction(context: Context, node: AstNode, ancestors: AstNode[]): void {
  const name = getName(getChild(node, 'id'));
  if (name === undefined) {
    return;
  }
  const kind = getUnitKind(context, name);
  if (kind) {
    addUnit(context, node, kind, name, isSkipped(context, getCommentTargets(node, ancestors)));
  }
}

function visit(context: Context, node: AstNode, ancestors: AstNode[]): void {
  // Same order as 0.8: a call or declarator claims its function before the function's own name does.
  switch (node.type) {
    case 'CallExpression':
      visitCall(context, node, ancestors);
      break;
    case 'VariableDeclarator':
      visitDeclarator(context, node, ancestors);
      break;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
      visitFunction(context, node, ancestors);
      break;
    default:
      break;
  }

  ancestors.push(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (isNode(value)) {
      visit(context, value, ancestors);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          visit(context, item, ancestors);
        }
      }
    }
  }
  ancestors.pop();
}

export interface FindUnitsInput {
  code: string;
  program: AstNode;
  comments: Comment[];
  preset: Preset;
  bindingOf: Map<object, Binding>;
}

/**
 * Finds components and hooks with the 0.8 rules. A unit is a function or arrow that is
 * a named function matching a filter, the value of a matching variable, or the first
 * argument of an imported HOC. Async and generator functions are never units.
 */
export function findUnits(input: FindUnitsInput): Unit[] {
  const comments = [...input.comments].sort((a, b) => a.start - b.start);
  const skips: Comment[] = [];
  for (const comment of comments) {
    if (FORGETTI_SKIP.test(comment.value)) {
      skips.push(comment);
    }
  }
  const { filters } = input.preset;
  const context: Context = {
    code: input.code,
    skips,
    comments,
    component: new RegExp(filters.component.source, filters.component.flags),
    hook: filters.hook ? new RegExp(filters.hook.source, filters.hook.flags) : null,
    hocs: input.preset.imports.hocs,
    bindingOf: input.bindingOf,
    units: [],
    seen: new Set(),
  };
  visit(context, input.program, []);
  return context.units;
}
