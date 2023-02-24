import * as babel from '@babel/core';
import { addDefault, addNamed } from '@babel/helper-module-imports';
import * as t from '@babel/types';
import { forEach } from './arrays';
import { isPathValid } from './checks';
import getForeignBindings from './get-foreign-bindings';
import isGuaranteedLiteral from './is-guaranteed-literal';
import { ComponentNode, StateContext } from './types';
import unwrapNode from './unwrap-node';

interface OptimizedExpression {
  expr: t.Expression;
  deps?: t.Expression | t.Expression[];
}

function optimizedExpr(
  expr: t.Expression,
  deps?: t.Expression | t.Expression[],
): OptimizedExpression {
  return { expr, deps };
}

function createDependencies(
  dependencies?: t.Expression | t.Expression[],
): t.Expression[] {
  if (dependencies) {
    if (Array.isArray(dependencies)) {
      return dependencies;
    }
    return [dependencies];
  }
  return [];
}

function mergeDependencies(
  target: t.Expression[],
  dependencies?: t.Expression | t.Expression[],
) {
  if (dependencies) {
    if (Array.isArray(dependencies)) {
      return target.push(...dependencies);
    }
    return target.push(dependencies);
  }
  return target;
}

export default class Optimizer {
  memo: t.Identifier | undefined;

  indeces = 0;

  ctx: StateContext;

  path: babel.NodePath<ComponentNode>;

  optimizedID = new WeakMap<t.Identifier, OptimizedExpression>();

  constructor(ctx: StateContext, path: babel.NodePath<ComponentNode>) {
    this.ctx = ctx;
    this.path = path;
  }

  getMemoIdentifier() {
    const { name, source, kind } = this.ctx.opts.memo;
    const target = `memo/${source}[${name}]`;
    const current = this.ctx.hooks.get(target);
    if (current) {
      return current;
    }
    const newID = (kind === 'named')
      ? addNamed(this.path, name, source)
      : addDefault(this.path, source);
    this.ctx.hooks.set(target, newID);
    return newID;
  }

  createHeader() {
    if (!this.memo) {
      this.memo = this.path.scope.generateUidIdentifier('c');
    }
    return this.memo;
  }

  createIndex() {
    const current = this.indeces;
    this.indeces += 1;
    return t.numericLiteral(current);
  }

  createMemo(
    statements: t.Statement[],
    current: t.Expression,
    dependencies?: t.Expression | t.Expression[] | boolean,
  ): OptimizedExpression {
    if (t.isIdentifier(current)) {
      const optimized = this.optimizedID.get(current);
      if (optimized) {
        return optimized;
      }
    }
    const header = this.createHeader();
    const index = this.createIndex();
    const pos = t.memberExpression(header, index, true);
    const vid = this.path.scope.generateUidIdentifier('v');

    let condition: t.Expression | undefined;

    if (Array.isArray(dependencies)) {
      forEach(dependencies, (dependency) => {
        if (condition && dependency) {
          condition = t.logicalExpression('&&', condition, dependency);
        } else if (dependency) {
          condition = dependency;
        }
      });
    } else if (dependencies === true) {
      condition = t.binaryExpression('in', index, header);
    } else if (dependencies) {
      condition = dependencies;
    } else {
      condition = t.callExpression(
        t.memberExpression(t.identifier('Object'), t.identifier('is')),
        [pos, current],
      );
    }

    const eqid = (
      t.isIdentifier(condition)
        ? condition
        : this.path.scope.generateUidIdentifier('eq')
    );

    const declaration = (
      t.isIdentifier(condition)
        ? []
        : [t.variableDeclarator(eqid, condition)]
    );

    const optimized = optimizedExpr(vid, eqid);

    if (t.isIdentifier(current)) {
      this.optimizedID.set(current, optimized);
      this.optimizedID.set(vid, optimized);
    }

    const init = t.conditionalExpression(
      eqid,
      pos,
      t.assignmentExpression('=', pos, current),
    );

    declaration.push(t.variableDeclarator(vid, init));

    statements.push(t.variableDeclaration('let', declaration));

    return optimized;
  }

  memoizeIdentifier(
    statements: t.Statement[],
    path: babel.NodePath,
    id: t.Identifier,
  ) {
    if (path.scope.hasBinding(id.name, true)) {
      const binding = path.scope.getBindingIdentifier(id.name);
      if (binding) {
        return this.createMemo(statements, binding, false);
      }
    }
    return optimizedExpr(id);
  }

  optimizeIdentifier(
    statements: t.Statement[],
    path: babel.NodePath<t.Identifier>,
  ) {
    return this.memoizeIdentifier(statements, path, path.node);
  }

  optimizeMemberExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.MemberExpression | t.OptionalMemberExpression>,
  ) {
    const source = this.optimizeExpression(statements, path.get('object'));
    path.node.object = source.expr;
    const condition = createDependencies(source.deps);
    if (path.node.computed) {
      const propertyPath = path.get('property');
      if (isPathValid(propertyPath, t.isExpression)) {
        const property = this.optimizeExpression(statements, propertyPath);
        path.node.property = property.expr;
        mergeDependencies(condition, property.deps);
      }
    }
    return this.createMemo(statements, path.node, condition);
  }

  optimizeConditionalExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.ConditionalExpression>,
  ) {
    const id = path.scope.generateUidIdentifier('v');
    const optimizedTest = this.optimizeExpression(statements, path.get('test'));
    const consequentStatements: t.Statement[] = [];
    const alternateStatements: t.Statement[] = [];
    const optimizedConsequent = this.optimizeExpression(consequentStatements, path.get('consequent'));
    const optimizedAlternate = this.optimizeExpression(alternateStatements, path.get('alternate'));
    consequentStatements.push(
      t.expressionStatement(
        t.assignmentExpression('=', id, optimizedConsequent.expr),
      ),
    );
    alternateStatements.push(
      t.expressionStatement(
        t.assignmentExpression('=', id, optimizedAlternate.expr),
      ),
    );
    statements.push(
      t.variableDeclaration(
        'let',
        [t.variableDeclarator(id)],
      ),
      t.ifStatement(
        optimizedTest.expr,
        t.blockStatement(consequentStatements),
        t.blockStatement(alternateStatements),
      ),
    );
    return optimizedExpr(id);
  }

  optimizeBinaryExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.BinaryExpression>,
  ) {
    if (path.node.operator === '|>') {
      return optimizedExpr(path.node);
    }
    const leftPath = path.get('left');

    const dependencies: t.Expression[] = [];

    if (isPathValid(leftPath, t.isExpression)) {
      const optimizedLeft = this.optimizeExpression(statements, leftPath);

      path.node.left = optimizedLeft.expr;
      mergeDependencies(dependencies, optimizedLeft.deps);
    }
    const optimizedRight = this.optimizeExpression(statements, path.get('right'));

    path.node.right = optimizedRight.expr;
    mergeDependencies(dependencies, optimizedRight.deps);

    return optimizedExpr(path.node, dependencies);
  }

  optimizeLogicalExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.LogicalExpression>,
  ) {
    const id = path.scope.generateUidIdentifier('v');
    const optimizedTest = this.optimizeExpression(statements, path.get('left'));
    const alternateStatements: t.Statement[] = [];
    const optimizedAlternate = this.optimizeExpression(alternateStatements, path.get('right'));
    alternateStatements.push(
      t.expressionStatement(
        t.assignmentExpression('=', id, optimizedAlternate.expr),
      ),
    );
    const condition = path.node.operator === '??'
      ? t.binaryExpression('==', optimizedTest.expr, t.nullLiteral())
      : optimizedTest.expr;
    const first = t.blockStatement(alternateStatements);
    const last = t.expressionStatement(
      t.assignmentExpression('=', id, optimizedTest.expr),
    );
    const consequent = path.node.operator === '||'
      ? last
      : first;
    const alternate = path.node.operator === '||'
      ? first
      : last;
    statements.push(
      t.variableDeclaration(
        'let',
        [t.variableDeclarator(id)],
      ),
      t.ifStatement(
        condition,
        consequent,
        alternate,
      ),
    );
    return optimizedExpr(id);
  }

  optimizeUnaryExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.UnaryExpression>,
  ) {
    const optimized = this.optimizeExpression(statements, path.get('argument'));
    path.node.argument = optimized.expr;
    return optimizedExpr(path.node, optimized.deps);
  }

  optimizeEffect(
    statements: t.Statement[],
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) {
    const [, dependencies] = path.get('arguments');
    if (isPathValid(dependencies, t.isExpression)) {
      const optimizedArray = this.optimizeExpression(statements, dependencies);
      path.node.arguments[1] = t.arrayExpression([optimizedArray.expr]);
      return optimizedExpr(path.node, optimizedArray.deps);
    }
    return optimizedExpr(path.node);
  }

  optimizeCallback(
    statements: t.Statement[],
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) {
    const [callback, dependencies] = path.get('arguments');
    if (isPathValid(callback, t.isExpression)) {
      if (isPathValid(dependencies, t.isExpression)) {
        const optimizedArray = this.optimizeExpression(statements, dependencies);
        return this.createMemo(statements, callback.node, optimizedArray.expr);
      }
    }
    return optimizedExpr(path.node);
  }

  optimizeMemo(
    statements: t.Statement[],
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) {
    const [callback, dependencies] = path.get('arguments');
    if (isPathValid(callback, t.isExpression)) {
      if (isPathValid(dependencies, t.isExpression)) {
        const optimizedArray = this.optimizeExpression(statements, dependencies);
        return this.createMemo(
          statements,
          t.callExpression(callback.node, []),
          optimizedArray.expr,
        );
      }
    }
    return optimizedExpr(path.node);
  }

  optimizeCallExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) {
    const calleePath = path.get('callee');
    if (isPathValid(calleePath, t.isExpression)) {
      let isHook = false;
      const trueID = unwrapNode(calleePath.node, t.isIdentifier);
      if (trueID) {
        const binding = path.scope.getBindingIdentifier(trueID.name);
        if (binding) {
          const registration = this.ctx.registrations.hooks.get(binding);
          if (registration) {
            switch (registration.type) {
              case 'callback':
                return this.optimizeCallback(statements, path);
              case 'effect':
                return this.optimizeEffect(statements, path);
              case 'memo':
                return this.optimizeMemo(statements, path);
              default:
                isHook = true;
            }
          }
        }
        if (this.ctx.filters.hook?.test(trueID.name)) {
          isHook = true;
        }
      // Check if callee is potentially a namespace import
      }
      const trueMember = unwrapNode(calleePath.node, t.isMemberExpression);
      if (
        trueMember
        && !trueMember.computed
        && t.isIdentifier(trueMember.property)
      ) {
        const obj = unwrapNode(trueMember.object, t.isIdentifier);
        if (obj) {
          const binding = path.scope.getBindingIdentifier(obj.name);
          if (binding) {
            const registrations = this.ctx.registrations.hooksNamespaces.get(binding);
            if (registrations) {
              for (let i = 0, len = registrations.length; i < len; i += 1) {
                const registration = registrations[i];
                if (registration.name === trueMember.property.name) {
                  switch (registration.type) {
                    case 'callback':
                      return this.optimizeCallback(statements, path);
                    case 'effect':
                      return this.optimizeEffect(statements, path);
                    case 'memo':
                      return this.optimizeMemo(statements, path);
                    default:
                      break;
                  }
                }
              }
            }
          }
        }
        if (this.ctx.filters.hook?.test(trueMember.property.name)) {
          isHook = true;
        }
      }

      if (isHook) {
        const argumentsPath = path.get('arguments');
        const dependencies: t.Expression[] = [];
        forEach(argumentsPath, (argument, i) => {
          if (isPathValid(argument, t.isExpression)) {
            const optimized = this.optimizeExpression(statements, argument);
            mergeDependencies(dependencies, optimized.deps);
            path.node.arguments[i] = optimized.expr;
          } else if (isPathValid(argument, t.isSpreadElement)) {
            const optimized = this.optimizeExpression(statements, argument.get('argument'));
            mergeDependencies(dependencies, optimized.deps);
            argument.node.argument = optimized.expr;
          }
        });
        return optimizedExpr(path.node, dependencies);
      }
      const callee = this.optimizeExpression(statements, calleePath);
      // Build dependencies
      const condition: t.Expression[] = createDependencies(callee.deps);
      const argumentsPath = path.get('arguments');
      forEach(argumentsPath, (argument, i) => {
        if (isPathValid(argument, t.isExpression)) {
          const optimized = this.optimizeExpression(statements, argument);
          mergeDependencies(condition, optimized.deps);
          path.node.arguments[i] = optimized.expr;
        } else if (isPathValid(argument, t.isSpreadElement)) {
          const optimized = this.optimizeExpression(statements, argument.get('argument'));
          mergeDependencies(condition, optimized.deps);
          argument.node.argument = optimized.expr;
        }
      });
      path.node.callee = callee.expr;
      return this.createMemo(statements, path.node, condition);
    }
    return optimizedExpr(path.node);
  }

  optimizeAwaitYieldExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.AwaitExpression | t.YieldExpression>,
  ) {
    if (path.node.argument) {
      const optimized = this.optimizeExpression(statements, path.get('argument') as babel.NodePath<t.Expression>);
      path.node.argument = optimized.expr;
      return optimizedExpr(path.node, optimized.deps);
    }
    return optimizedExpr(path.node);
  }

  optimizeFunctionExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
  ) {
    const bindings = getForeignBindings(path);
    const dependencies: t.Expression[] = [];
    forEach(bindings, (binding) => {
      const optimized = this.memoizeIdentifier(statements, path, binding);
      mergeDependencies(dependencies, optimized.deps);
    });
    return this.createMemo(statements, path.node, dependencies);
  }

  optimizeAssignmentExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.AssignmentExpression>,
  ) {
    const optimizedRight = this.optimizeExpression(statements, path.get('right'));
    statements.push(
      t.expressionStatement(
        t.assignmentExpression(
          path.node.operator,
          path.node.left,
          optimizedRight.expr,
        ),
      ),
    );
    return optimizedRight;
  }

  optimizeArrayExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.ArrayExpression | t.TupleExpression>,
  ) {
    const condition: t.Expression[] = [];
    const elementsPath = path.get('elements');
    forEach(elementsPath, (element, i) => {
      if (isPathValid(element, t.isExpression)) {
        const optimized = this.optimizeExpression(statements, element);
        mergeDependencies(condition, optimized.deps);
        path.node.elements[i] = optimized.expr;
      } else if (isPathValid(element, t.isSpreadElement)) {
        const optimized = this.optimizeExpression(statements, element.get('argument'));
        mergeDependencies(condition, optimized.deps);
        element.node.argument = optimized.expr;
      }
    });

    return this.createMemo(statements, path.node, condition);
  }

  optimizeObjectExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.ObjectExpression | t.RecordExpression>,
  ) {
    const condition: t.Expression[] = [];
    const elementsPath = path.get('properties');
    forEach(elementsPath, (element) => {
      if (isPathValid(element, t.isObjectProperty)) {
        const valuePath = element.get('value');

        if (isPathValid(valuePath, t.isExpression)) {
          const optimized = this.optimizeExpression(statements, valuePath);
          mergeDependencies(condition, optimized.deps);
          element.node.value = optimized.expr;
        }

        if (element.node.computed) {
          const keyPath = element.get('key');
          if (isPathValid(keyPath, t.isExpression)) {
            const optimized = this.optimizeExpression(statements, keyPath);
            mergeDependencies(condition, optimized.deps);
            element.node.key = optimized.expr;
          }
        }
      } else if (isPathValid(element, t.isSpreadElement)) {
        const optimized = this.optimizeExpression(statements, element.get('argument'));
        mergeDependencies(condition, optimized.deps);
        element.node.argument = optimized.expr;
      } else if (isPathValid(element, t.isObjectMethod)) {
        const bindings = getForeignBindings(path);
        const dependencies: t.Expression[] = [];
        forEach(bindings, (binding) => {
          const optimized = this.memoizeIdentifier(statements, path, binding);
          mergeDependencies(dependencies, optimized.deps);
        });
        mergeDependencies(condition, dependencies);
      }
    });

    return this.createMemo(statements, path.node, condition);
  }

  optimizeExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.Expression>,
  ): OptimizedExpression {
    if (
      t.isParenthesizedExpression(path.node)
      || t.isTypeCastExpression(path.node)
      || t.isTSAsExpression(path.node)
      || t.isTSSatisfiesExpression(path.node)
      || t.isTSNonNullExpression(path.node)
      || t.isTSTypeAssertion(path.node)
      || t.isTSInstantiationExpression(path.node)
    ) {
      return this.optimizeExpression(
        statements,
        path.get('expression') as babel.NodePath<t.Expression>,
      );
    }
    // No need to optimize
    if (
      t.isNullLiteral(path.node)
      || t.isBooleanLiteral(path.node)
    ) {
      return optimizedExpr(path.node);
    }
    // Only optimize for complex values
    if (isPathValid(path, isGuaranteedLiteral)) {
      return this.createMemo(statements, path.node, true);
    }
    // if (t.isIdentifier(path.node)) {
    if (isPathValid(path, t.isIdentifier)) {
      return this.optimizeIdentifier(statements, path);
    }
    if (
      isPathValid(path, t.isMemberExpression)
      || isPathValid(path, t.isOptionalMemberExpression)
    ) {
      return this.optimizeMemberExpression(statements, path);
    }
    if (isPathValid(path, t.isConditionalExpression)) {
      return this.optimizeConditionalExpression(statements, path);
    }
    if (isPathValid(path, t.isBinaryExpression)) {
      return this.optimizeBinaryExpression(statements, path);
    }
    if (isPathValid(path, t.isLogicalExpression)) {
      return this.optimizeLogicalExpression(statements, path);
    }
    if (isPathValid(path, t.isUnaryExpression)) {
      return this.optimizeUnaryExpression(statements, path);
    }
    if (
      isPathValid(path, t.isCallExpression)
      || isPathValid(path, t.isOptionalCallExpression)
    ) {
      return this.optimizeCallExpression(statements, path);
    }
    if (isPathValid(path, t.isAwaitExpression) || isPathValid(path, t.isYieldExpression)) {
      return this.optimizeAwaitYieldExpression(statements, path);
    }
    if (
      isPathValid(path, t.isFunctionExpression)
      || isPathValid(path, t.isArrowFunctionExpression)
    ) {
      return this.optimizeFunctionExpression(statements, path);
    }
    if (isPathValid(path, t.isAssignmentExpression)) {
      return this.optimizeAssignmentExpression(statements, path);
    }
    if (isPathValid(path, t.isArrayExpression) || isPathValid(path, t.isTupleExpression)) {
      return this.optimizeArrayExpression(statements, path);
    }
    if (isPathValid(path, t.isObjectExpression) || isPathValid(path, t.isRecordExpression)) {
      return this.optimizeObjectExpression(statements, path);
    }
    if (isPathValid(path, t.isNewExpression)) {
      // TODO
    }
    if (isPathValid(path, t.isSequenceExpression)) {
      // TODO
    }
    if (isPathValid(path, t.isJSXElement)) {
      // TODO
    }
    if (isPathValid(path, t.isJSXFragment)) {
      // TODO
    }
    if (isPathValid(path, t.isTaggedTemplateExpression)) {
      // TODO
    }
    if (isPathValid(path, t.isTemplateLiteral)) {
      // TODO
    }
    return optimizedExpr(path.node);
  }

  optimizeExpressionStatement(
    statements: t.Statement[],
    path: babel.NodePath<t.ExpressionStatement>,
  ) {
    const optimized = this.optimizeExpression(statements, path.get('expression'));
    statements.push(t.expressionStatement(optimized.expr));
  }

  optimizeVariableDeclaration(
    statements: t.Statement[],
    path: babel.NodePath<t.VariableDeclaration>,
  ) {
    forEach(path.get('declarations'), (declaration) => {
      const init = declaration.node.init
        ? this.optimizeExpression(
          statements,
          declaration.get('init') as babel.NodePath<t.Expression>,
        ).expr
        : undefined;
      statements.push(
        t.variableDeclaration(
          path.node.kind,
          [
            t.variableDeclarator(
              declaration.node.id,
              init,
            ),
          ],
        ),
      );
    });
  }

  optimizeReturnStatement(
    statements: t.Statement[],
    path: babel.NodePath<t.ReturnStatement>,
  ) {
    if (path.node.argument) {
      const optimized = this.optimizeExpression(statements, path.get('argument') as babel.NodePath<t.Expression>);
      path.node.argument = optimized.expr;
    }
    statements.push(path.node);
  }

  private optimizeBlock(
    statements: t.Statement[],
    path: babel.NodePath<t.BlockStatement>,
  ) {
    forEach(path.get('body'), (statement) => {
      this.optimizeStatement(statements, statement);
    });
  }

  optimizeBlockStatement(
    statements: t.Statement[],
    path: babel.NodePath<t.BlockStatement>,
  ) {
    const newStatements: t.Statement[] = [];
    this.optimizeBlock(newStatements, path);
    statements.push(t.blockStatement(newStatements));
  }

  optimizeIfStatement(
    statements: t.Statement[],
    path: babel.NodePath<t.IfStatement>,
  ) {
    const optimized = this.optimizeExpression(statements, path.get('test'));
    const consequentStatements: t.Statement[] = [];
    this.optimizeStatement(consequentStatements, path.get('consequent'));
    const newNode = t.ifStatement(optimized.expr, t.blockStatement(consequentStatements));
    if (path.node.alternate) {
      const alternateStatements: t.Statement[] = [];
      this.optimizeStatement(consequentStatements, path.get('alternate') as babel.NodePath<t.Statement>);
      newNode.alternate = t.blockStatement(alternateStatements);
    }
    statements.push(newNode);
  }

  optimizeStatement(
    statements: t.Statement[],
    path: babel.NodePath<t.Statement>,
  ): void {
    if (isPathValid(path, t.isExpressionStatement)) {
      this.optimizeExpressionStatement(statements, path);
    } else if (isPathValid(path, t.isVariableDeclaration)) {
      this.optimizeVariableDeclaration(statements, path);
    } else if (isPathValid(path, t.isReturnStatement)) {
      this.optimizeReturnStatement(statements, path);
    } else if (isPathValid(path, t.isBlockStatement)) {
      this.optimizeBlockStatement(statements, path);
    } else if (isPathValid(path, t.isIfStatement)) {
      this.optimizeIfStatement(statements, path);
    } else {
      statements.push(path.node);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  optimizeArrowComponent(
    path: babel.NodePath<t.ArrowFunctionExpression>,
  ) {
    path.replaceWith(
      t.functionExpression(
        path.scope.generateUidIdentifier('Component'),
        path.node.params,
        t.isStatement(path.node.body) ? path.node.body : t.blockStatement([
          t.returnStatement(path.node.body),
        ]),
      ),
    );
  }

  optimizeFunctionComponent(
    path: babel.NodePath<t.FunctionExpression | t.FunctionDeclaration>,
  ) {
    let newStatements: t.Statement[] = [];

    this.optimizeBlock(newStatements, path.get('body'));

    if (this.memo) {
      newStatements = [
        t.variableDeclaration(
          'const',
          [
            t.variableDeclarator(
              this.memo,
              t.callExpression(
                this.getMemoIdentifier(),
                [
                  t.arrowFunctionExpression(
                    [],
                    t.newExpression(
                      t.identifier('Array'),
                      [t.numericLiteral(this.indeces)],
                    ),
                  ),
                  t.arrayExpression(),
                ],
              ),
            ),
          ],
        ),
        ...newStatements,
      ];
    }

    path.node.body = t.blockStatement(newStatements);
    path.skip();
  }

  optimize() {
    if (isPathValid(this.path, t.isArrowFunctionExpression)) {
      this.optimizeArrowComponent(this.path);
    } else if (
      isPathValid(this.path, t.isFunctionExpression)
      || isPathValid(this.path, t.isFunctionDeclaration)
    ) {
      this.optimizeFunctionComponent(this.path);
    }
  }
}
