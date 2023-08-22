import * as t from '@babel/types';
import type { Scope, Visitor } from '@babel/traverse';
import type { StateContext } from './types';

interface VisitorState {
  isImmutable: boolean;
  jsxScope: Scope;
  targetScope: Scope;
}

function declares(node: t.Identifier | t.JSXIdentifier, scope: Scope): boolean {
  if (
    t.isJSXIdentifier(node, { name: 'this' })
    || t.isJSXIdentifier(node, { name: 'arguments' })
    || t.isJSXIdentifier(node, { name: 'super' })
    || t.isJSXIdentifier(node, { name: 'new' })
  ) {
    const { path } = scope;
    return path.isFunctionParent() && !path.isArrowFunctionExpression();
  }

  return scope.hasOwnBinding(node.name);
}

function isHoistingScope({ path }: Scope): boolean {
  return path.isFunctionParent() || path.isLoop() || path.isProgram();
}

function getHoistingScope(scope: Scope): Scope {
  while (!isHoistingScope(scope)) scope = scope.parent;
  return scope;
}

const hoistingVisitor = {
  enter(path: babel.NodePath, state: VisitorState): void {
    const stop = (): void => {
      state.isImmutable = false;
      path.stop();
    };

    const skip = (): void => {
      path.skip();
    };

    if (path.isJSXClosingElement()) {
      skip();
      return;
    }

    // Elements with refs are not safe to hoist.
    if (
      path.isJSXIdentifier({ name: 'ref' })
      && path.parentPath.isJSXAttribute({ name: path.node })
    ) {
      stop();
      return;
    }

    // Ignore JSX expressions and immutable values.
    if (
      path.isJSXIdentifier()
      || path.isJSXMemberExpression()
      || path.isJSXNamespacedName()
      || path.isImmutable()
    ) {
      return;
    }

    // Ignore constant bindings.
    if (path.isIdentifier()) {
      const binding = path.scope.getBinding(path.node.name);
      if (binding && binding.constant) return;
    }

    if (!path.isPure()) {
      stop();
      return;
    }

    // If it's not immutable, it may still be a pure expression, such as string concatenation.
    // It is still safe to hoist that, so long as its result is immutable.
    // If not, it is not safe to replace as mutable values (e.g. objects), as it could be
    // mutated after render.
    // https://github.com/facebook/react/issues/3226
    const expressionResult = path.evaluate();
    if (expressionResult.confident) {
      // We know the result; check its mutability.
      if (
        expressionResult.value === null
        || (typeof expressionResult.value !== 'object' && typeof expressionResult.value !== 'function')
      ) {
        // It evaluated to an immutable value, so we can hoist it.
        skip();
        return;
      }
    } else if (expressionResult.deopt?.isIdentifier()) {
      // It's safe to hoist here if the deopt reason is an identifier (e.g. func param).
      // The hoister will take care of how high up it can be hoisted.
      return;
    }

    stop();
  },
  ReferencedIdentifier(path: babel.NodePath<t.Identifier>, state: VisitorState): void {
    const { node } = path;
    let { scope } = path;

    while (scope !== state.jsxScope) {
      // If a binding is declared in an inner function, it doesn't affect hoisting.
      if (declares(node, scope)) return;

      scope = scope.parent;
    }

    // We are recursing up the scope chain, the parent may not be existed.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (scope) {
      // We cannot hoist outside of the previous hoisting target
      // scope, so we return early and we don't update it.
      if (scope === state.targetScope) return;

      // If the scope declares this identifier (or we're at the function
      // providing the lexical env binding), we can't hoist the var any
      // higher.
      if (declares(node, scope)) break;

      scope = scope.parent;
    }

    state.targetScope = getHoistingScope(scope);
  },
};

export default function hoistConstantJSX(
  ctx: StateContext,
  path: babel.NodePath<t.JSXElement>,
): void {
  if (ctx.hoist.jsxScopeMap.has(path.node)) return;

  const { name } = path.node.openingElement;

  // In order to avoid hoisting unnecessarily, we need to know which is
  // the scope containing the current JSX element. If a parent of the
  // current element has already been hoisted, we can consider its target
  // scope as the base scope for the current element.
  let jsxScope;
  let current: babel.NodePath<t.JSX> = path;
  while (!jsxScope && current.parentPath.isJSX()) {
    current = current.parentPath;
    jsxScope = ctx.hoist.jsxScopeMap.get(current.node);
  }
  jsxScope ??= path.scope;
  // The initial HOISTED is set to jsxScope, s.t.
  // if the element's JSX ancestor has been hoisted, it will be skipped
  ctx.hoist.jsxScopeMap.set(path.node, jsxScope);

  const visitorState: VisitorState = {
    isImmutable: true,
    jsxScope,
    targetScope: path.scope.getProgramParent(),
  };

  path.traverse(hoistingVisitor as Visitor<VisitorState>, visitorState);
  if (!visitorState.isImmutable) return;

  const { targetScope } = visitorState;
  // Only hoist if it would give us an advantage.
  for (let currentScope = jsxScope; ;) {
    if (targetScope === currentScope) return;
    if (isHoistingScope(currentScope)) break;

    currentScope = currentScope.parent;
  }

  const id = path.scope.generateUidIdentifierBasedOnNode(name);

  targetScope.push({ id });
  // If the element is to be hoisted, update HOISTED to be the target scope
  ctx.hoist.jsxScopeMap.set(path.node, targetScope);
  ctx.hoist.hoisted.add(path.node);

  let replacement: t.Expression | t.JSXExpressionContainer = t.addComment(
    t.logicalExpression(
      '||',
      id,
      t.assignmentExpression(
        '=',
        id,
        path.node,
      ),
    ),
    'leading',
    '@forgetti hoisted_jsx',
    false,
  );

  if (
    path.parentPath.isJSXElement()
    || path.parentPath.isJSXAttribute()
  ) {
    replacement = t.jsxExpressionContainer(replacement);
  }

  // console.log(path.node, replacement.type, replacement);

  path.replaceWith(replacement);
}
