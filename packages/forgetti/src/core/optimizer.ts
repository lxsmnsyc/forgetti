import * as babel from '@babel/core';
import { addDefault, addNamed } from '@babel/helper-module-imports';
import * as t from '@babel/types';
import { forEach } from './arrays';
import { isHookishName, isPathValid } from './checks';
import getForeignBindings from './get-foreign-bindings';
import isGuaranteedLiteral from './is-guaranteed-literal';
import { ComponentNode, StateContext } from './types';
import unwrapNode from './unwrap-node';

export default class Optimizer {
  memo: t.Identifier | undefined;

  indeces = 0;

  ctx: StateContext;

  path: babel.NodePath<ComponentNode>;

  comparisons = new WeakMap<t.Identifier, t.Identifier>();

  optimizedID = new WeakMap<t.Identifier, t.Identifier>();

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
    dependencies?: t.Expression | (t.Expression | undefined)[] | boolean,
  ): t.Identifier {
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
    const eqid = this.path.scope.generateUidIdentifier('eq');

    if (t.isIdentifier(current)) {
      this.comparisons.set(vid, eqid);
      this.comparisons.set(current, eqid);
      this.optimizedID.set(current, vid);
      this.optimizedID.set(vid, vid);
    }

    let condition: t.Expression;

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

    const init = t.conditionalExpression(
      eqid,
      pos,
      t.assignmentExpression('=', pos, current),
    );

    statements.push(
      t.variableDeclaration(
        'let',
        [
          t.variableDeclarator(eqid, condition!),
          t.variableDeclarator(vid, init),
        ],
      ),
    );

    return vid;
  }

  getDependency(
    path: babel.NodePath,
    statements: t.Statement[],
    current: t.PrivateName | t.Expression,
  ) {
    if (!t.isIdentifier(current)) {
      return undefined;
    }
    // Only memoize for local binding
    if (path.scope.hasBinding(current.name, true)) {
      const binding = path.scope.getBindingIdentifier(current.name);
      if (binding) {
        const result = this.comparisons.get(binding);
        if (result) {
          return result;
        }
        const newResult = this.createMemo(statements, binding, false);
        return this.comparisons.get(newResult);
      }
      const result = this.comparisons.get(current);
      if (result) {
        return result;
      }
      const newResult = this.createMemo(statements, current, false);
      return this.comparisons.get(newResult);
    }
    return undefined;
  }

  memoizeIdentifier(
    statements: t.Statement[],
    path: babel.NodePath<t.Identifier>,
    id: t.Identifier,
  ) {
    if (path.scope.hasBinding(id.name, true)) {
      const binding = path.scope.getBindingIdentifier(id.name);
      if (binding) {
        return this.createMemo(statements, binding, false);
      }
    }
    return id;
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
    const sourceDep = this.getDependency(path, statements, source);
    path.node.object = source;
    const condition: (t.Expression | undefined)[] = [sourceDep];
    if (path.node.computed) {
      const propertyPath = path.get('property');
      if (isPathValid(propertyPath, t.isExpression)) {
        const property = this.optimizeExpression(statements, propertyPath);
        const propertyDep = this.getDependency(path, statements, property);
        condition.push(propertyDep);
        path.node.property = property;
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
        t.assignmentExpression('=', id, optimizedConsequent),
      ),
    );
    alternateStatements.push(
      t.expressionStatement(
        t.assignmentExpression('=', id, optimizedAlternate),
      ),
    );
    statements.push(
      t.variableDeclaration(
        'let',
        [t.variableDeclarator(id)],
      ),
      t.ifStatement(
        optimizedTest,
        t.blockStatement(consequentStatements),
        t.blockStatement(alternateStatements),
      ),
    );
    return id;
  }

  optimizeBinaryExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.BinaryExpression>,
  ) {
    if (path.node.operator === '|>') {
      return path.node;
    }
    const leftPath = path.get('left');
    const optimizedLeft = isPathValid(leftPath, t.isExpression)
      ? this.optimizeExpression(statements, leftPath)
      : path.node.left;
    const optimizedRight = this.optimizeExpression(statements, path.get('right'));

    path.node.left = optimizedLeft;
    path.node.right = optimizedRight;

    return path.node;
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
        t.assignmentExpression('=', id, optimizedAlternate),
      ),
    );
    const condition = path.node.operator === '??'
      ? t.binaryExpression('==', optimizedTest, t.nullLiteral())
      : optimizedTest;
    const first = t.blockStatement(alternateStatements);
    const last = t.expressionStatement(
      t.assignmentExpression('=', id, optimizedTest),
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
    return id;
  }

  optimizeUnaryExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.UnaryExpression>,
  ) {
    const optimized = this.optimizeExpression(statements, path.get('argument'));
    path.node.argument = optimized;
    return path.node;
  }

  optimizeEffect(
    statements: t.Statement[],
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) {
    const [, dependencies] = path.get('arguments');
    if (isPathValid(dependencies, t.isExpression)) {
      const optimizedArray = this.optimizeExpression(statements, dependencies);
      path.node.arguments[1] = t.arrayExpression([optimizedArray]);
    }
    return path.node;
  }

  optimizeCallback(
    statements: t.Statement[],
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) {
    const [callback, dependencies] = path.get('arguments');
    if (isPathValid(callback, t.isExpression)) {
      if (isPathValid(dependencies, t.isExpression)) {
        const optimizedArray = this.optimizeExpression(statements, dependencies);
        return this.createMemo(statements, callback.node, optimizedArray);
      }
    }
    throw new Error('Unsupported');
  }

  optimizeMemo(
    statements: t.Statement[],
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) {
    const [callback, dependencies] = path.get('arguments');
    if (isPathValid(callback, t.isExpression)) {
      if (isPathValid(dependencies, t.isExpression)) {
        const optimizedArray = this.optimizeExpression(statements, dependencies);
        return this.createMemo(statements, t.callExpression(callback.node, []), optimizedArray);
      }
    }
    throw new Error('Unsupported');
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
        if (isHookishName(trueID.name)) {
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
        if (isHookishName(trueMember.property.name)) {
          isHook = true;
        }
      }

      if (isHook) {
        const argumentsPath = path.get('arguments');
        forEach(argumentsPath, (argument, i) => {
          if (isPathValid(argument, t.isExpression)) {
            path.node.arguments[i] = this.optimizeExpression(statements, argument);
          } else if (isPathValid(argument, t.isSpreadElement)) {
            argument.node.argument = this.optimizeExpression(statements, argument.get('argument'));
          }
        });
        return path.node;
      }
      const callee = this.optimizeExpression(statements, calleePath);
      const calleeDep = this.getDependency(path, statements, callee);
      // Build dependencies
      const condition: (t.Expression | undefined)[] = [calleeDep];
      const argumentsPath = path.get('arguments');
      forEach(argumentsPath, (argument, i) => {
        if (isPathValid(argument, t.isExpression)) {
          const optimized = this.optimizeExpression(statements, argument);
          const dependency = this.getDependency(path, statements, optimized);
          if (dependency) {
            condition.push(dependency);
          }
          path.node.arguments[i] = optimized;
        } else if (isPathValid(argument, t.isSpreadElement)) {
          const optimized = this.optimizeExpression(statements, argument.get('argument'));
          const dependency = this.getDependency(path, statements, optimized);
          if (dependency) {
            condition.push(dependency);
          }
          argument.node.argument = optimized;
        }
      });
      path.node.callee = callee;
      return this.createMemo(statements, path.node, condition);
    }
    return path.node;
  }

  optimizeAwaitYieldExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.AwaitExpression | t.YieldExpression>,
  ) {
    if (path.node.argument) {
      const optimized = this.optimizeExpression(statements, path.get('argument') as babel.NodePath<t.Expression>);
      path.node.argument = optimized;
    }
    return path.node;
  }

  optimizeFunctionExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
  ) {
    const bindings = getForeignBindings(path);
    const dependencies: (t.Expression | undefined)[] = [];
    forEach(bindings, (binding) => {
      dependencies.push(this.getDependency(path, statements, binding));
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
          optimizedRight,
        ),
      ),
    );
    return optimizedRight;
  }

  optimizeArrayExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.ArrayExpression>,
  ) {
    const condition: (t.Expression | undefined)[] = [];
    const elementsPath = path.get('elements');
    forEach(elementsPath, (element, i) => {
      if (isPathValid(element, t.isExpression)) {
        const optimized = this.optimizeExpression(statements, element);
        const dependency = this.getDependency(path, statements, optimized);
        if (dependency) {
          condition.push(dependency);
        }
        path.node.elements[i] = optimized;
      } else if (isPathValid(element, t.isSpreadElement)) {
        const optimized = this.optimizeExpression(statements, element.get('argument'));
        const dependency = this.getDependency(path, statements, optimized);
        if (dependency) {
          condition.push(dependency);
        }
        element.node.argument = optimized;
      }
    });

    return this.createMemo(statements, path.node, condition);
  }

  optimizeExpression(
    statements: t.Statement[],
    path: babel.NodePath<t.Expression>,
  ): t.Expression {
    if (t.isPrivateName(path.node)) {
      return path.node;
    }
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
      || t.isThisExpression(path.node)
      || t.isUpdateExpression(path.node)
    ) {
      return path.node;
    }
    // Only optimize for complex values
    if (isPathValid(path, isGuaranteedLiteral)) {
      return this.createMemo(statements, path.node, true);
    }
    // if (t.isIdentifier(path.node)) {
    if (isPathValid(path, t.isIdentifier)) {
      return this.optimizeIdentifier(statements, path);
    }
    if (isPathValid(path, t.isMemberExpression)) {
      return this.optimizeMemberExpression(statements, path);
    }
    if (isPathValid(path, t.isOptionalMemberExpression)) {
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
    if (isPathValid(path, t.isCallExpression) || isPathValid(path, t.isOptionalCallExpression)) {
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
    if (isPathValid(path, t.isArrayExpression)) {
      return this.optimizeArrayExpression(statements, path);
    }
    throw new Error(`unsupported ${path.node.type}`);
  }

  optimizeExpressionStatement(
    statements: t.Statement[],
    path: babel.NodePath<t.ExpressionStatement>,
  ) {
    const optimized = this.optimizeExpression(statements, path.get('expression'));
    statements.push(t.expressionStatement(optimized));
  }

  optimizeVariableDeclaration(
    statements: t.Statement[],
    path: babel.NodePath<t.VariableDeclaration>,
  ) {
    forEach(path.get('declarations'), (declaration) => {
      statements.push(
        t.variableDeclaration(
          path.node.kind,
          [
            t.variableDeclarator(
              declaration.node.id,
              declaration.node.init
                ? this.optimizeExpression(statements, declaration.get('init') as babel.NodePath<t.Expression>)
                : undefined,
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
      path.node.argument = optimized;
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
    const newNode = t.ifStatement(optimized, t.blockStatement(consequentStatements));
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
