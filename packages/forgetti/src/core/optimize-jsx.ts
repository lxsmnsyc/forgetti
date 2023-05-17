import type * as babel from '@babel/core';
import * as t from '@babel/types';
import type { ComponentNode, StateContext } from './types';
import getImportIdentifier from './get-import-identifier';
import { RUNTIME_MEMO } from './imports';
import { isNodeShouldBeSkipped } from './checks';

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

function extractJSXExpressions(
  path: babel.NodePath<t.JSXElement | t.JSXFragment>,
  state: State,
  top: boolean,
): void {
  // Iterate attributes
  if (path.isJSXElement()) {
    const openingElement = path.get('openingElement');
    let name = openingElement.get('name');
    while (name.isJSXMemberExpression()) {
      name = name.get('object');
    }
    if (name.isJSXIdentifier()) {
      if (/^[A-Z_]/.test(name.node.name)) {
        const id = path.scope.generateUidIdentifier('Component');
        state.jsxs.push({
          id,
          value: t.identifier(name.node.name),
        });
        name.replaceWith(t.jsxIdentifier(id.name));
      }
    }
    const attrs = openingElement.get('attributes');
    for (let i = 0, len = attrs.length; i < len; i++) {
      const attr = attrs[i];

      if (attr.isJSXAttribute()) {
        const key = attr.get('name');
        if (top && key.isJSXIdentifier() && key.node.name === 'key') {
          const value = attr.get('value');
          if (value.isExpression()) {
            state.key = value.node;
          } else if (value.isJSXExpressionContainer()) {
            const expr = value.get('expression');
            if (expr.isExpression()) {
              state.key = expr.node;
              attr.remove();
            }
          }
        } else {
          const value = attr.get('value');
          if (value.isJSXElement() || value.isJSXFragment()) {
            extractJSXExpressions(value, state, false);
          }
          if (value.isJSXExpressionContainer()) {
            const expr = value.get('expression');
            if (expr.isJSXElement() || expr.isJSXFragment()) {
              extractJSXExpressions(expr, state, false);
            } else if (expr.isExpression()) {
              const id = state.expressions.length;
              state.expressions.push(expr.node);
              expr.replaceWith(
                t.memberExpression(
                  state.source,
                  t.numericLiteral(id),
                  true,
                ),
              );
            }
          }
        }
      }
      if (attr.isJSXSpreadAttribute()) {
        const arg = attr.get('argument');
        if (arg.isJSXElement() || arg.isJSXFragment()) {
          extractJSXExpressions(arg, state, false);
        } else {
          const id = state.expressions.length;
          state.expressions.push(arg.node);
          arg.replaceWith(
            t.memberExpression(
              state.source,
              t.numericLiteral(id),
              true,
            ),
          );
        }
      }
    }
  }

  const children = path.get('children');
  for (let i = 0, len = children.length; i < len; i++) {
    const child = children[i];

    if (child.isJSXElement() || child.isJSXFragment()) {
      extractJSXExpressions(child, state, false);
    } else if (child.isJSXExpressionContainer()) {
      const expr = child.get('expression');
      if (expr.isJSXElement() || expr.isJSXFragment()) {
        extractJSXExpressions(expr, state, false);
      } else if (expr.isExpression()) {
        const id = state.expressions.length;
        state.expressions.push(expr.node);
        expr.replaceWith(
          t.memberExpression(
            state.source,
            t.numericLiteral(id),
            true,
          ),
        );
      }
    } else if (child.isJSXSpreadChild()) {
      const arg = child.get('expression');
      if (arg.isJSXElement() || arg.isJSXFragment()) {
        extractJSXExpressions(arg, state, false);
      } else {
        const id = state.expressions.length;
        state.expressions.push(arg.node);
        arg.replaceWith(
          t.memberExpression(
            state.source,
            t.numericLiteral(id),
            true,
          ),
        );
      }
    }
  }
}

function transformJSX(
  ctx: StateContext,
  path: babel.NodePath<t.JSXElement | t.JSXFragment>,
): void {
  if (isNodeShouldBeSkipped(path.node)) {
    return;
  }
  const state: State = {
    source: path.scope.generateUidIdentifier('values'),
    expressions: [],
    jsxs: [],
  };
  extractJSXExpressions(path, state, true);

  const memoComponent = path.scope.generateUidIdentifier('Memo');

  let body: t.Expression | t.BlockStatement;
  if (state.jsxs.length) {
    const declarations: t.VariableDeclarator[] = [];
    for (let i = 0, len = state.jsxs.length; i < len; i++) {
      declarations.push(t.variableDeclarator(
        state.jsxs[i].id,
        state.jsxs[i].value,
      ));
    }
    body = t.blockStatement([
      t.variableDeclaration('const', declarations),
      t.returnStatement(path.node),
    ]);
  } else {
    body = path.node;
  }
  path.scope.getProgramParent().push({
    kind: 'const',
    id: memoComponent,
    init: t.callExpression(
      getImportIdentifier(
        ctx,
        path,
        RUNTIME_MEMO,
      ),
      [
        getImportIdentifier(
          ctx,
          path,
          ctx.preset.runtime.memo,
        ),
        t.arrowFunctionExpression(
          [state.source],
          body,
        ),
      ],
    ),
  });

  const attrs = [];

  if (state.key) {
    attrs.push(
      t.jsxAttribute(
        t.jsxIdentifier('key'),
        t.jsxExpressionContainer(
          state.key,
        ),
      ),
    );
  }

  attrs.push(
    t.jsxAttribute(
      t.jsxIdentifier('v'),
      t.jsxExpressionContainer(
        t.arrayExpression(state.expressions),
      ),
    ),
  );

  path.replaceWith(
    t.addComment(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier(memoComponent.name),
          attrs,
          true,
        ),
        t.jsxClosingElement(
          t.jsxIdentifier(memoComponent.name),
        ),
        [],
        true,
      ),
      'leading',
      '@forgetti skip',
      false,
    ),
  );
}

export default function optimizeJSX(
  ctx: StateContext,
  path: babel.NodePath<ComponentNode>,
): void {
  path.traverse({
    JSXElement(p) {
      transformJSX(ctx, p);
    },
    JSXFragment(p) {
      transformJSX(ctx, p);
    },
  });
  path.scope.crawl();
}
