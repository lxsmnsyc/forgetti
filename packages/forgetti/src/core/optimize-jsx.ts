import type * as babel from '@babel/core';
import * as t from '@babel/types';
import type { ComponentNode, StateContext } from './types';
import getImportIdentifier from './get-import-identifier';
import { RUNTIME_MEMO } from './imports';
import { isNodeShouldBeSkipped, isPathValid } from './checks';
import type { ImportRegistration } from './presets';

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
  if (isPathValid(path, t.isJSXElement)) {
    const openingElement = path.get('openingElement');
    let name = openingElement.get('name');
    while (isPathValid(name, t.isJSXMemberExpression)) {
      name = name.get('object');
    }
    if (isPathValid(name, t.isJSXIdentifier)) {
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

      if (isPathValid(attr, t.isJSXAttribute)) {
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
          const value = attr.get('value');
          if (isPathValid(value, t.isJSXElement) || isPathValid(value, t.isJSXFragment)) {
            extractJSXExpressions(value, state, false);
          }
          if (isPathValid(value, t.isJSXExpressionContainer)) {
            const expr = value.get('expression');
            if (isPathValid(expr, t.isJSXElement) || isPathValid(expr, t.isJSXFragment)) {
              extractJSXExpressions(expr, state, false);
            } else if (isPathValid(expr, t.isExpression)) {
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
      if (isPathValid(attr, t.isJSXSpreadAttribute)) {
        const arg = attr.get('argument');
        if (isPathValid(arg, t.isJSXElement) || isPathValid(arg, t.isJSXFragment)) {
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

    if (isPathValid(child, t.isJSXElement) || isPathValid(child, t.isJSXFragment)) {
      extractJSXExpressions(child, state, false);
    } else if (isPathValid(child, t.isJSXExpressionContainer)) {
      const expr = child.get('expression');
      if (isPathValid(expr, t.isJSXElement) || isPathValid(expr, t.isJSXFragment)) {
        extractJSXExpressions(expr, state, false);
      } else if (isPathValid(expr, t.isExpression)) {
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
    } else if (isPathValid(child, t.isJSXSpreadChild)) {
      const arg = child.get('expression');
      if (isPathValid(arg, t.isJSXElement) || isPathValid(arg, t.isJSXFragment)) {
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
  memoDefinition: ImportRegistration,
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
          memoDefinition,
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
    path.scope.crawl();
  }
}
