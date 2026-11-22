import type { Range } from '../ir';

/** Any ESTree node from oxc-parser, read by key. Emit only needs types, ranges and children. */
export interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export interface AstIndex {
  root: AstNode;
  parents: Map<AstNode, AstNode>;
  /** Every identifier and JSX identifier name in the module, so emitted names never shadow one. */
  names: Set<string>;
}

export function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    'start' in value &&
    typeof value.start === 'number' &&
    'end' in value &&
    typeof value.end === 'number'
  );
}

/** Returns the child node stored at `key`, if there is one. */
export function getChild(node: AstNode, key: string): AstNode | undefined {
  const value = node[key];
  return isNode(value) ? value : undefined;
}

/** Returns the child nodes stored in the array at `key`, skipping holes. */
export function getChildren(node: AstNode, key: string): AstNode[] {
  const value = node[key];
  const result: AstNode[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isNode(item)) {
        result.push(item);
      }
    }
  }
  return result;
}

function listChildren(node: AstNode): AstNode[] {
  const result: AstNode[] = [];
  for (const key of Object.keys(node)) {
    if (key === 'parent') {
      continue;
    }
    const value = node[key];
    if (isNode(value)) {
      result.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          result.push(item);
        }
      }
    }
  }
  return result;
}

/** Walks the program once and records each node's parent and every identifier name. */
export function indexProgram(program: unknown): AstIndex {
  if (!isNode(program)) {
    throw new Error('emit: the program is not an ESTree node');
  }
  const parents = new Map<AstNode, AstNode>();
  const names = new Set<string>();
  const stack: AstNode[] = [program];

  for (let node = stack.pop(); node; node = stack.pop()) {
    if (
      (node.type === 'Identifier' || node.type === 'JSXIdentifier') &&
      typeof node.name === 'string'
    ) {
      names.add(node.name);
    }
    for (const child of listChildren(node)) {
      parents.set(child, node);
      stack.push(child);
    }
  }
  return { root: program, parents, names };
}

function containsRange(node: AstNode, range: Range): boolean {
  return node.start <= range.start && range.end <= node.end;
}

/** Returns the deepest node whose range holds `range`. */
export function findInnermost(index: AstIndex, range: Range): AstNode {
  let current = index.root;
  for (;;) {
    let next: AstNode | undefined;
    for (const child of listChildren(current)) {
      if (containsRange(child, range)) {
        next = child;
        break;
      }
    }
    if (!next) {
      return current;
    }
    current = next;
  }
}

/** Returns the outermost node whose range is exactly `range`. Throws when none is. */
export function findExact(index: AstIndex, range: Range): AstNode {
  let current = index.root;
  for (;;) {
    if (current.start === range.start && current.end === range.end) {
      return current;
    }
    let next: AstNode | undefined;
    for (const child of listChildren(current)) {
      if (containsRange(child, range)) {
        next = child;
        break;
      }
    }
    if (!next) {
      throw new Error(`emit: no node spans ${range.start}..${range.end}`);
    }
    current = next;
  }
}

/** Returns the outermost function whose range lies inside `range`. Throws when none does. */
export function findFunction(index: AstIndex, range: Range): AstNode {
  const queue: AstNode[] = [index.root];
  // A for-of loop visits the items pushed during the loop, so this is a breadth-first walk.
  for (const node of queue) {
    if (isFunction(node) && range.start <= node.start && node.end <= range.end) {
      return node;
    }
    for (const child of listChildren(node)) {
      if (child.end > range.start && child.start < range.end) {
        queue.push(child);
      }
    }
  }
  throw new Error(`emit: no function inside ${range.start}..${range.end}`);
}

export function isFunction(node: AstNode): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

export function isLoop(node: AstNode): boolean {
  return (
    node.type === 'ForStatement' ||
    node.type === 'ForInStatement' ||
    node.type === 'ForOfStatement' ||
    node.type === 'WhileStatement' ||
    node.type === 'DoWhileStatement'
  );
}
