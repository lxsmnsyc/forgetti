import * as babel from '@babel/core';
import type { ComponentInfo, Edit, FunctionInfo, Node, Probe, SourceFile } from './types.ts';

const SKIP_KEYS = new Set([
  'type',
  'start',
  'end',
  'loc',
  'range',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
]);

// Intrinsic elements that take no text child: void elements, and form fields whose children mean their value.
const NO_CHILDREN = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
  'textarea',
  'select',
  'option',
  'svg',
  'path',
]);

export function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

export function isFunction(node: Node): boolean {
  return FUNCTION_TYPES.has(node.type);
}

/** The child nodes of a node, in source order. */
export function getChildren(node: Node): Node[] {
  const children: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          children.push(item);
        }
      }
    } else if (isNode(value)) {
      children.push(value);
    }
  }
  children.sort((a, b) => a.start - b.start);
  return children;
}

/**
 * Visits a node and its descendants depth first, in source order. The visitor returns
 * false to skip a node's children. Nested functions are entered unless `functions` is false.
 */
export function walk(
  node: Node,
  visit: (node: Node, parent: Node | null) => boolean | void,
  functions = true,
  parent: Node | null = null,
): void {
  if (visit(node, parent) === false) {
    return;
  }
  for (const child of getChildren(node)) {
    if (!functions && isFunction(child)) {
      continue;
    }
    walk(child, visit, functions, node);
  }
}

export function insert(at: number, text: string, bias = 5): Edit {
  return { start: at, end: at, text, bias };
}

export function replace(start: number, end: number, text: string): Edit {
  return { start, end, text, bias: 5 };
}

/** Applies edits to the source. Edits must not overlap, except insertions at a shared position. */
export function applyEdits(code: string, edits: Edit[]): string {
  // Stable sort by position, then by bias. Equal bias keeps the order the operator gave.
  // An edit whose key was seen already is dropped.
  const ordered: [Edit, number][] = [];
  const keys = new Set<string>();
  for (const [index, edit] of edits.entries()) {
    if (edit.key !== undefined) {
      if (keys.has(edit.key)) {
        continue;
      }
      keys.add(edit.key);
    }
    ordered.push([edit, index]);
  }
  ordered.sort((a, b) => a[0].start - b[0].start || a[0].bias - b[0].bias || a[1] - b[1]);

  let output = '';
  let cursor = 0;
  for (const [edit] of ordered) {
    if (edit.start < cursor) {
      throw new Error(`Overlapping edits at ${edit.start}`);
    }
    output += code.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return output + code.slice(cursor);
}

export function containsJsx(node: Node): boolean {
  let found = false;
  walk(
    node,
    (child) => {
      if (found) {
        return false;
      }
      if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
        found = true;
        return false;
      }
      return undefined;
    },
    false,
  );
  return found;
}

function getElementName(element: Node): string | null {
  const opening = element.openingElement as Node;
  const name = opening.name as Node;
  if (name.type !== 'JSXIdentifier') {
    return null;
  }
  return name.name as string;
}

function isHostElement(element: Node): boolean {
  const name = getElementName(element);
  if (name === null || !/^[a-z]/.test(name) || name.includes('-') || NO_CHILDREN.has(name)) {
    return false;
  }
  // A spread or `dangerouslySetInnerHTML` may set the children, so a text child would clash.
  const opening = element.openingElement as Node;
  for (const attribute of opening.attributes as Node[]) {
    if (attribute.type === 'JSXSpreadAttribute') {
      return false;
    }
    const attributeName = attribute.name as Node;
    if (attributeName.name === 'dangerouslySetInnerHTML') {
      return false;
    }
  }
  return true;
}

/** Finds the outermost host element or fragment of a returned expression, breadth first. */
function findHost(argument: Node): Node | null {
  const queue: Node[] = [argument];
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index] as Node;
    if (node.type === 'JSXFragment') {
      return node;
    }
    if (node.type === 'JSXElement') {
      if (isHostElement(node)) {
        return node;
      }
      queue.push(...(node.children as Node[]));
      continue;
    }
    for (const child of getChildren(node)) {
      if (!isFunction(child)) {
        queue.push(child);
      }
    }
  }
  return null;
}

function createProbe(code: string, argument: Node, returnStart: number): Probe | null {
  const host = findHost(argument);
  if (host === null) {
    // No host element: wrap the whole returned expression in a fragment, once per mutant.
    if (!containsJsx(argument)) {
      return null;
    }
    return {
      attributeAt: null,
      returnStart,
      render(text, element = false) {
        const child = element ? text : `{${text}}`;
        return [
          { ...insert(argument.start, '<>', 3), key: `fragment-open@${argument.start}` },
          insert(argument.start, child, 5),
          { ...insert(argument.start, '{', 7), key: `fragment-brace@${argument.start}` },
          { ...insert(argument.end, '}</>', 5), key: `fragment-close@${argument.end}` },
        ];
      },
    };
  }

  if (host.type === 'JSXFragment') {
    const opening = host.openingFragment as Node;
    return {
      attributeAt: null,
      returnStart,
      render(text, element = false) {
        return [insert(opening.end, element ? text : `{${text}}`)];
      },
    };
  }

  const opening = host.openingElement as Node;
  const name = getElementName(host) as string;
  const nameNode = opening.name as Node;
  // A host with its own `ref` takes no second one.
  let attributeAt: number | null = nameNode.end;
  for (const attribute of opening.attributes as Node[]) {
    if ((attribute.name as Node).name === 'ref') {
      attributeAt = null;
    }
  }
  return {
    attributeAt,
    returnStart,
    render(text, element = false) {
      const child = element ? text : `{${text}}`;
      if (opening.selfClosing !== true) {
        return [insert(opening.end, child)];
      }
      // A self-closing host gets a closing tag.
      const slash = code.lastIndexOf('/', opening.end);
      return [
        { ...replace(slash, opening.end, '>'), key: `self-closing@${slash}` },
        insert(opening.end, child),
        { ...insert(opening.end, `</${name}>`, 9), key: `closing-tag@${opening.end}` },
      ];
    },
  };
}

/** Builds the edit helpers of a function: body prepends and the probes of its JSX returns. */
export function describeFunction(code: string, fn: Node): FunctionInfo {
  const body = fn.body as Node;
  const params = fn.params as Node[];

  // Probes: every return with JSX, not counting nested functions. An expression body is one return.
  const probes: Probe[] = [];
  const returns: Node[] = [];
  if (body.type === 'BlockStatement') {
    walk(
      body,
      (node) => {
        if (node.type === 'ReturnStatement' && isNode(node.argument)) {
          returns.push(node.argument);
          const probe = createProbe(code, node.argument, node.start);
          if (probe !== null) {
            probes.push(probe);
          }
          return false;
        }
        return undefined;
      },
      false,
    );
  } else {
    returns.push(body);
    const probe = createProbe(code, body, body.start);
    if (probe !== null) {
      probes.push(probe);
    }
  }

  return {
    node: fn,
    params,
    body,
    probes,
    probe: probes.at(-1) ?? null,
    returns,
    wrapReturns(open, close, outer = false) {
      // An outer wrapper opens before and closes after an inner one at the same place.
      const edits: Edit[] = [];
      for (const argument of returns) {
        edits.push(
          insert(argument.start, open, outer ? 1.8 : 2),
          insert(argument.end, close, outer ? 8.2 : 8),
        );
      }
      return edits;
    },
    prepend(text) {
      if (body.type === 'BlockStatement') {
        return [insert(body.start + 1, ` ${text}`)];
      }
      // An expression body becomes a block, once however many statements go in. A
      // parenthesized body loses its parentheses into the return.
      const extra = body.extra as { parenthesized?: boolean; parenStart?: number } | undefined;
      let start = body.start;
      let end = body.end;
      if (extra?.parenthesized === true && extra.parenStart !== undefined) {
        start = extra.parenStart;
        end = code.indexOf(')', body.end) + 1;
      }
      return [
        { ...insert(start, '{', 0), key: `block-open@${start}` },
        insert(start, ` ${text}`, 1),
        { ...insert(start, ' return (', 1.5), key: `block-return@${start}` },
        { ...insert(end, '); }', 10), key: `block-close@${end}` },
      ];
    },
  };
}

function getCalleeName(callee: Node): string | null {
  if (callee.type === 'Identifier') {
    return callee.name as string;
  }
  if (callee.type === 'MemberExpression' && (callee.property as Node).type === 'Identifier') {
    return (callee.property as Node).name as string;
  }
  return null;
}

/** Unwraps `memo(fn)`, `forwardRef(fn)` and their nesting down to the function. */
function unwrapComponent(init: Node): { fn: Node; wrapper: 'memo' | 'forwardRef' | null } | null {
  if (isFunction(init)) {
    return { fn: init, wrapper: null };
  }
  if (init.type !== 'CallExpression') {
    return null;
  }
  const name = getCalleeName(init.callee as Node);
  const first = (init.arguments as Node[])[0];
  if ((name !== 'memo' && name !== 'forwardRef') || first === undefined) {
    return null;
  }
  const inner = unwrapComponent(first);
  if (inner === null) {
    return null;
  }
  // `memo` wins at any depth: `memo(forwardRef(fn))` is a memo boundary.
  const wrapper = name === 'memo' || inner.wrapper === 'memo' ? 'memo' : (inner.wrapper ?? name);
  return { fn: inner.fn, wrapper };
}

function collectTopLevel(program: Node): {
  names: Set<string>;
  exported: Set<string>;
  react: Map<string, string>;
} {
  const names = new Set<string>();
  const exported = new Set<string>();
  const react = new Map<string, string>();
  for (const statement of program.body as Node[]) {
    let declaration = statement;
    if (
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration'
    ) {
      // `export { A, B }` and `export default A` name existing bindings.
      for (const specifier of (statement.specifiers as Node[] | undefined) ?? []) {
        exported.add((specifier.local as Node).name as string);
      }
      const inner = statement.declaration as Node | null | undefined;
      if (isNode(inner) && inner.type === 'Identifier') {
        exported.add(inner.name as string);
      }
      if (!isNode(inner)) {
        continue;
      }
      declaration = inner;
    }

    if (declaration.type === 'ImportDeclaration') {
      const from = (declaration.source as Node).value;
      for (const specifier of declaration.specifiers as Node[]) {
        const local = (specifier.local as Node).name as string;
        names.add(local);
        if (from === 'react' && specifier.type === 'ImportSpecifier') {
          react.set(local, (specifier.imported as Node).name as string);
        }
      }
    } else if (
      declaration.type === 'FunctionDeclaration' ||
      declaration.type === 'ClassDeclaration'
    ) {
      const id = declaration.id as Node | null;
      if (id !== null) {
        names.add(id.name as string);
        if (declaration !== statement) {
          exported.add(id.name as string);
        }
      }
    } else if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations as Node[]) {
        walk(declarator.id as Node, (node, parent) => {
          if (
            node.type === 'Identifier' &&
            !(
              parent?.type === 'ObjectProperty' &&
              parent.key === node &&
              parent.computed !== true
            ) &&
            !(parent?.type === 'AssignmentPattern' && parent.right === node)
          ) {
            names.add(node.name as string);
            if (declaration !== statement) {
              exported.add(node.name as string);
            }
          }
        });
      }
    }
  }
  return { names, exported, react };
}

function findComponents(code: string, program: Node, exported: Set<string>): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  for (const statement of program.body as Node[]) {
    let declaration = statement;
    if (
      (statement.type === 'ExportNamedDeclaration' ||
        statement.type === 'ExportDefaultDeclaration') &&
      isNode(statement.declaration)
    ) {
      declaration = statement.declaration;
    }

    // `function Name() {}` and `const Name = fn | memo(fn) | forwardRef(fn)`, with a capitalized name.
    const found: { name: string; fn: Node; wrapper: 'memo' | 'forwardRef' | null }[] = [];
    if (declaration.type === 'FunctionDeclaration' && isNode(declaration.id)) {
      found.push({ name: declaration.id.name as string, fn: declaration, wrapper: null });
    } else if (declaration.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations as Node[]) {
        const id = declarator.id as Node;
        if (id.type !== 'Identifier' || !isNode(declarator.init)) {
          continue;
        }
        const unwrapped = unwrapComponent(declarator.init);
        if (unwrapped !== null) {
          found.push({ name: id.name as string, ...unwrapped });
        }
      }
    }

    for (const item of found) {
      if (!/^[A-Z]/.test(item.name)) {
        continue;
      }
      components.push({
        ...describeFunction(code, item.fn),
        name: item.name,
        exported: exported.has(item.name),
        wrapper: item.wrapper,
        statementStart: statement.start,
      });
    }
  }

  // Exported components first: scenarios render them, so their mutants are less often inert.
  const ordered: ComponentInfo[] = [];
  for (const component of components) {
    if (component.exported) {
      ordered.push(component);
    }
  }
  for (const component of components) {
    if (!component.exported) {
      ordered.push(component);
    }
  }
  return ordered;
}

/** Parses a corpus file and finds its components and top-level names. */
export function parseFile(id: string, code: string, filename: string): SourceFile {
  const plugins: ('jsx' | 'typescript')[] = filename.endsWith('.tsx')
    ? ['jsx', 'typescript']
    : ['jsx'];
  const file = babel.parseSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins },
  }) as unknown as Node | null;
  if (file === null) {
    throw new Error(`${id}: Babel parsed nothing`);
  }
  const program = file.program as Node;
  const { names, exported, react } = collectTopLevel(program);
  const components = findComponents(code, program, exported);
  const memoBodies = new Set<string>();
  const behindMemo = findBehindMemo(program, components, exported, memoBodies);
  return {
    id,
    code,
    program,
    components,
    topLevel: names,
    reactImports: react,
    behindMemo,
    memoBodies,
    slice: (node) => code.slice(node.start, node.end),
  };
}

/** The capitalized names a node renders as tags or passes as JSX attribute values (`view={Inner}`). */
function findRendered(root: Node): Set<string> {
  const names = new Set<string>();
  walk(root, (node, parent) => {
    if (node.type === 'JSXOpeningElement' && (node.name as Node).type === 'JSXIdentifier') {
      names.add((node.name as Node).name as string);
    }
    if (
      node.type === 'Identifier' &&
      parent?.type === 'JSXExpressionContainer' &&
      /^[A-Z]/.test(node.name as string)
    ) {
      names.add(node.name as string);
    }
  });
  return names;
}

/**
 * Components that may render behind `memo`. The render graph has an edge from each
 * component to the components it renders, and from `const A = memo(B)` to `B`. React
 * may skip a `memo` node and everything under it when props are equal.
 */
function findBehindMemo(
  program: Node,
  components: ComponentInfo[],
  exported: Set<string>,
  memoBodies: Set<string>,
): Set<string> {
  const edges = new Map<string, Set<string>>();
  const memoized = new Set<string>();
  for (const component of components) {
    edges.set(component.name, findRendered(component.body));
    if (component.wrapper === 'memo') {
      memoized.add(component.name);
    }
  }

  // `const A = memo(B)` and `const A = forwardRef(B)` with `B` a name.
  for (const statement of program.body as Node[]) {
    const declaration = isNode(statement.declaration) ? statement.declaration : statement;
    if (declaration.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of declaration.declarations as Node[]) {
      const init = declarator.init as Node | null;
      const id = declarator.id as Node;
      if (init?.type !== 'CallExpression' || id.type !== 'Identifier') {
        continue;
      }
      const name = getCalleeName(init.callee as Node);
      const first = (init.arguments as Node[])[0];
      if ((name === 'memo' || name === 'forwardRef') && first?.type === 'Identifier') {
        edges.set(id.name as string, new Set([first.name as string]));
        if (name === 'memo') {
          memoized.add(id.name as string);
        }
      }
    }
  }

  // A component reached from an export through a `memo` node, on any path, may render
  // behind `memo`. Which instances do is decided at run time (see `generate.ts`).
  const all = reachFrom(edges, exported, new Set());
  const memoRoots = new Set<string>();
  for (const name of memoized) {
    if (all.has(name)) {
      memoRoots.add(name);
    }
  }
  const behind = new Set<string>();
  const underMemo = reachFrom(edges, memoRoots, new Set());
  for (const component of components) {
    if (underMemo.has(component.name)) {
      behind.add(component.name);
    }
  }

  // The components whose own render function is the body of a `memo` node.
  const componentNames = new Set<string>();
  for (const component of components) {
    componentNames.add(component.name);
  }
  for (const name of memoized) {
    if (componentNames.has(name)) {
      memoBodies.add(name);
    }
    for (const target of edges.get(name) ?? []) {
      if (!componentNames.has(name) && componentNames.has(target)) {
        memoBodies.add(target);
      }
    }
  }
  return behind;
}

function reachFrom(
  edges: Map<string, Set<string>>,
  roots: Set<string>,
  blocked: Set<string>,
): Set<string> {
  const reached = new Set<string>();
  const queue: string[] = [];
  for (const name of edges.keys()) {
    if (roots.has(name) && !blocked.has(name)) {
      queue.push(name);
    }
  }
  while (queue.length > 0) {
    const name = queue.pop() as string;
    if (reached.has(name)) {
      continue;
    }
    reached.add(name);
    for (const next of edges.get(name) ?? []) {
      if (!blocked.has(next)) {
        queue.push(next);
      }
    }
  }
  return reached;
}

/** The component whose function holds an offset, or null. */
export function findComponentAt(file: SourceFile, offset: number): ComponentInfo | null {
  for (const component of file.components) {
    if (component.node.start <= offset && offset < component.node.end) {
      return component;
    }
  }
  return null;
}

/**
 * Names a mutant can read from the first parameter: the identifiers a destructuring
 * pattern binds, or the first `props.x` members read in the body.
 */
export function getPropReads(info: FunctionInfo): string[] {
  const first = info.params[0];
  const reads: string[] = [];
  if (first === undefined) {
    return reads;
  }
  if (first.type === 'ObjectPattern') {
    for (const property of first.properties as Node[]) {
      if (property.type !== 'ObjectProperty') {
        continue;
      }
      let value = property.value as Node;
      if (value.type === 'AssignmentPattern') {
        value = value.left as Node;
      }
      if (value.type === 'Identifier') {
        reads.push(value.name as string);
      }
    }
    return reads;
  }
  if (first.type === 'Identifier') {
    const name = first.name as string;
    walk(info.body, (node) => {
      if (
        node.type === 'MemberExpression' &&
        node.computed !== true &&
        (node.object as Node).type === 'Identifier' &&
        (node.object as Node).name === name
      ) {
        const text = `${name}.${(node.property as Node).name as string}`;
        if (!reads.includes(text)) {
          reads.push(text);
        }
      }
    });
  }
  return reads;
}

/**
 * The names through which a component reaches its props: every name its first
 * parameter binds (destructured names, a rest element, or the parameter itself).
 */
export function getPropRoots(info: FunctionInfo): Set<string> {
  const roots = new Set<string>();
  const first = info.params[0];
  if (first === undefined) {
    return roots;
  }
  walk(first, (node, parent) => {
    const isKey =
      parent?.type === 'ObjectProperty' && parent.key === node && parent.computed !== true;
    const isDefault = parent?.type === 'AssignmentPattern' && parent.right === node;
    if (node.type === 'Identifier' && !isKey && !isDefault) {
      roots.add(node.name as string);
    }
    // A default value is not read through props.
    return isDefault ? false : undefined;
  });
  return roots;
}

/** The identifier a member or call chain starts from (`a` in `a?.b.c(x).d`), or null. */
export function getRootName(node: Node): string | null {
  let current = node;
  for (;;) {
    if (current.type === 'Identifier') {
      return current.name as string;
    }
    if (current.type === 'MemberExpression' || current.type === 'OptionalMemberExpression') {
      current = current.object as Node;
    } else if (current.type === 'CallExpression' || current.type === 'OptionalCallExpression') {
      current = current.callee as Node;
    } else {
      return null;
    }
  }
}

/** The 1-based line of an offset, for report sites. */
export function getLine(code: string, offset: number): number {
  let line = 1;
  for (
    let index = code.indexOf('\n');
    index !== -1 && index < offset;
    index = code.indexOf('\n', index + 1)
  ) {
    line += 1;
  }
  return line;
}

/** Calls `<receiver>.<method>(...)` with one of the given method names, inside a node. */
export function findMethodCalls(root: Node, methods: Set<string>): Node[] {
  const calls: Node[] = [];
  walk(root, (node) => {
    if (node.type !== 'CallExpression' && node.type !== 'OptionalCallExpression') {
      return;
    }
    const callee = node.callee as Node;
    if (
      (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') &&
      callee.computed !== true &&
      methods.has((callee.property as Node).name as string) &&
      (node.arguments as Node[]).length > 0
    ) {
      calls.push(node);
    }
  });
  return calls;
}

/** True when a node reads the identifier `name` (not as a property key). */
export function readsName(root: Node, name: string): boolean {
  let found = false;
  walk(root, (node, parent) => {
    if (found) {
      return false;
    }
    if ((node.type === 'Identifier' || node.type === 'JSXIdentifier') && node.name === name) {
      const isKey =
        (parent?.type === 'MemberExpression' &&
          parent.property === node &&
          parent.computed !== true) ||
        (parent?.type === 'JSXMemberExpression' && parent.property === node) ||
        (parent?.type === 'ObjectProperty' && parent.key === node && parent.computed !== true) ||
        parent?.type === 'JSXAttribute';
      if (!isKey) {
        found = true;
      }
    }
    return undefined;
  });
  return found;
}
