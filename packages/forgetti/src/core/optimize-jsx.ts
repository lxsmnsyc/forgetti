import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { isPathValid, shouldSkipJSX } from './utils/checks';
import { getDescriptiveName } from './utils/get-descriptive-name';
import { getImportIdentifier } from './utils/get-import-identifier';
import { getRootStatementPath } from './utils/get-root-statement-path';
import { RUNTIME_MEMO } from './imports';
import type { ImportDefinition } from './presets';
import type { ComponentNode, StateContext } from './types';

interface JSXReplacement {
  id: t.Identifier;
  value: t.Expression;
}

interface State {
  // Identifier of the value argument
  source: t.Identifier;
  // List of dependency expressions
  expressions: t.Expression[];
  // List of JSX replacements
  jsxs: JSXReplacement[];
  // key
  key?: t.Expression;
}

function getJSXIdentifier(
  el: babel.NodePath<
    t.JSXIdentifier | t.JSXNamespacedName | t.JSXMemberExpression
  >,
): babel.NodePath<t.JSXIdentifier | t.JSXNamespacedName> {
  if (isPathValid(el, t.isJSXMemberExpression)) {
    return getJSXIdentifier(el.get('object'));
  }
  return el as babel.NodePath<t.JSXIdentifier | t.JSXNamespacedName>;
}

function extractJSXExpressionFromNormalAttribute(
  state: State,
  attr: babel.NodePath<t.JSXAttribute>,
): void {
  const value = attr.get('value');
  if (
    isPathValid(value, t.isJSXElement) ||
    isPathValid(value, t.isJSXFragment)
  ) {
    extractJSXExpressions(value, state, false);
  }
  if (isPathValid(value, t.isJSXExpressionContainer)) {
    extractJSXExpressionsFromJSXExpressionContainer(state, value);
  }
}

function extractJSXExpressionFromAttribute(
  state: State,
  top: boolean,
  attr: babel.NodePath<t.JSXAttribute>,
): void {
  const key = attr.get('name');
  if (top && isPathValid(key, t.isJSXIdentifier) && key.node.name === 'key') {
    const value = attr.get('value');
    if (isPathValid(value, t.isExpression)) {
      state.key = value.node;
    } else if (isPathValid(value, t.isJSXExpressionContainer)) {
      const expr = value.get('expression');
      if (isPathValid(expr, t.isExpression)) {
        state.key = expr.node;
        attr.remove();
      }
    }
  } else {
    extractJSXExpressionFromNormalAttribute(state, attr);
  }
}

function extractJSXExpressionsFromAttributes(
  path: babel.NodePath<t.JSXElement>,
  state: State,
  top: boolean,
): void {
  const openingElement = path.get('openingElement');
  const attrs = openingElement.get('attributes');
  for (let i = 0, len = attrs.length; i < len; i++) {
    const attr = attrs[i];

    if (isPathValid(attr, t.isJSXAttribute)) {
      extractJSXExpressionFromAttribute(state, top, attr);
    }
    if (isPathValid(attr, t.isJSXSpreadAttribute)) {
      const arg = attr.get('argument');
      if (
        isPathValid(arg, t.isJSXElement) ||
        isPathValid(arg, t.isJSXFragment)
      ) {
        extractJSXExpressions(arg, state, false);
      } else {
        const id = state.expressions.length;
        state.expressions.push(arg.node);
        arg.replaceWith(
          t.memberExpression(state.source, t.numericLiteral(id), true),
        );
      }
    }
  }
}

function extractJSXExpressionsFromJSXElement(
  path: babel.NodePath<t.JSXElement>,
  state: State,
  top: boolean,
): void {
  const openingElement = path.get('openingElement');
  const openingName = openingElement.get('name');
  const trueOpeningName = getJSXIdentifier(openingName);
  const isJSXMember = isPathValid(openingName, t.isJSXMemberExpression);
  if (isPathValid(trueOpeningName, t.isJSXIdentifier)) {
    if (isJSXMember || /^[A-Z_]/.test(trueOpeningName.node.name)) {
      const descriptiveName = getDescriptiveName(path, 'Component');
      const id = path.scope.generateUidIdentifier(descriptiveName);
      const index = state.expressions.length;
      state.expressions.push(t.identifier(trueOpeningName.node.name));
      state.jsxs.push({
        id,
        value: t.memberExpression(state.source, t.numericLiteral(index), true),
      });
      const replacement = t.jsxIdentifier(id.name);
      trueOpeningName.replaceWith(replacement);

      const closingElement = path.get('closingElement');
      if (isPathValid(closingElement, t.isJSXClosingElement)) {
        const closingName = getJSXIdentifier(closingElement.get('name'));
        closingName.replaceWith(replacement);
      }
    }
  }
  extractJSXExpressionsFromAttributes(path, state, top);
}

function extractJSXExpressionsFromJSXExpressionContainer(
  state: State,
  child: babel.NodePath<t.JSXExpressionContainer>,
): void {
  const expr = child.get('expression');
  if (isPathValid(expr, t.isJSXElement) || isPathValid(expr, t.isJSXFragment)) {
    extractJSXExpressions(expr, state, false);
  } else if (isPathValid(expr, t.isExpression)) {
    const id = state.expressions.length;
    state.expressions.push(expr.node);
    expr.replaceWith(
      t.memberExpression(state.source, t.numericLiteral(id), true),
    );
  }
}

function extractJSXExpressionsFromJSXSpreadChild(
  state: State,
  child: babel.NodePath<t.JSXSpreadChild>,
): void {
  const arg = child.get('expression');
  if (isPathValid(arg, t.isJSXElement) || isPathValid(arg, t.isJSXFragment)) {
    extractJSXExpressions(arg, state, false);
  } else {
    const id = state.expressions.length;
    state.expressions.push(arg.node);
    arg.replaceWith(
      t.memberExpression(state.source, t.numericLiteral(id), true),
    );
  }
}

function extractJSXExpressions(
  path: babel.NodePath<t.JSXElement | t.JSXFragment>,
  state: State,
  top: boolean,
): void {
  // Iterate attributes
  if (isPathValid(path, t.isJSXElement)) {
    extractJSXExpressionsFromJSXElement(path, state, top);
  }

  const children = path.get('children');
  for (let i = 0, len = children.length; i < len; i++) {
    const child = children[i];

    if (
      isPathValid(child, t.isJSXElement) ||
      isPathValid(child, t.isJSXFragment)
    ) {
      extractJSXExpressions(child, state, false);
    } else if (isPathValid(child, t.isJSXExpressionContainer)) {
      extractJSXExpressionsFromJSXExpressionContainer(state, child);
    } else if (isPathValid(child, t.isJSXSpreadChild)) {
      extractJSXExpressionsFromJSXSpreadChild(state, child);
    }
  }
}

function transformJSX(
  ctx: StateContext,
  path: babel.NodePath<t.JSXElement | t.JSXFragment>,
  memoDefinition: ImportDefinition,
): void {
  if (shouldSkipJSX(path.node)) {
    return;
  }
  const state: State = {
    source: path.scope.generateUidIdentifier('values'),
    expressions: [],
    jsxs: [],
  };
  extractJSXExpressions(path, state, true);

  const memoComponent = path.scope.generateUidIdentifier(
    getDescriptiveName(path, 'Memo'),
  );

  let body: t.Expression | t.BlockStatement;
  if (state.jsxs.length) {
    const declarations: t.VariableDeclarator[] = [];
    for (let i = 0, len = state.jsxs.length; i < len; i++) {
      declarations.push(
        t.variableDeclarator(state.jsxs[i].id, state.jsxs[i].value),
      );
    }
    body = t.blockStatement([
      t.variableDeclaration('const', declarations),
      t.returnStatement(path.node),
    ]);
  } else {
    body = path.node;
  }

  const root = getRootStatementPath(path);

  root.scope.registerDeclaration(
    root.insertBefore(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          memoComponent,
          t.callExpression(getImportIdentifier(ctx, path, RUNTIME_MEMO), [
            getImportIdentifier(ctx, path, memoDefinition),
            t.stringLiteral(memoComponent.name),
            t.arrowFunctionExpression([state.source], body),
          ]),
        ),
      ]),
    )[0],
  );

  const attrs = [];

  if (state.key) {
    attrs.push(
      t.jsxAttribute(
        t.jsxIdentifier('key'),
        t.jsxExpressionContainer(state.key),
      ),
    );
  }

  attrs.push(
    t.jsxAttribute(
      t.jsxIdentifier('v'),
      t.jsxExpressionContainer(t.arrayExpression(state.expressions)),
    ),
  );

  path.replaceWith(
    t.addComment(
      t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier(memoComponent.name), attrs, true),
        t.jsxClosingElement(t.jsxIdentifier(memoComponent.name)),
        [],
        true,
      ),
      'leading',
      '@forgetti jsx',
      false,
    ),
  );
}

export default function optimizeJSX(
  ctx: StateContext,
  path: babel.NodePath<ComponentNode>,
): void {
  const memoDefinition = ctx.preset.runtime.memo;
  if (memoDefinition) {
    path.traverse({
      JSXElement(p) {
        transformJSX(ctx, p, memoDefinition);
      },
      JSXFragment(p) {
        transformJSX(ctx, p, memoDefinition);
      },
    });
  }
}
