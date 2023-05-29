/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { isNestedExpression, shouldSkipNode, isPathValid } from './checks';
import getForeignBindings, { isForeignBinding } from './get-foreign-bindings';
import getImportIdentifier from './get-import-identifier';
import { RUNTIME_EQUALS } from './imports';
import OptimizerScope from './optimizer-scope';
import type { ComponentNode, OptimizedExpression, StateContext } from './types';
import isConstant from './is-constant';
import { getHookCallType } from './get-hook-call-type';

function optimizedExpr(
  expr: t.Expression,
  deps?: t.Expression | t.Expression[],
  constant?: boolean,
): OptimizedExpression {
  return { expr, deps, constant };
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
): void {
  if (dependencies) {
    if (Array.isArray(dependencies)) {
      target.push(...dependencies);
    } else {
      target.push(dependencies);
    }
  }
}

export default class Optimizer {
  ctx: StateContext;

  path: babel.NodePath<ComponentNode>;

  scope: OptimizerScope;

  nodeConstantCheckCache = new WeakMap<babel.NodePath<t.Expression>, boolean>();

  constructor(ctx: StateContext, path: babel.NodePath<ComponentNode>) {
    this.ctx = ctx;
    this.path = path;
    this.scope = new OptimizerScope(ctx, path);
  }

  /**
   * This method declares the memoized value
   * - if the dependencies is an expression, the expression is used
   *   as the memoization condition
   * - if the dependencies is an array, the array is combined with
   *   logical AND into a single expression
   * - if the dependencies is `true`, then this expression is to be
   *   memoized as a "constant" (aka one-time generation)
   * - if the dependencies is `false`, then it means that it is being
   *   used as a dependency and so it must be compared to its memoized
   *   version.
   */
  createMemo(
    current: t.Expression,
    dependencies?: t.Expression | (t.Expression | undefined)[] | boolean,
  ): OptimizedExpression {
    // Check if the identifier is an already optimized
    // identifier so that we can skip it.
    if (current.type === 'Identifier') {
      const optimized = this.scope.getOptimized(current);
      if (optimized) {
        return optimized;
      }
    }
    // Creates the cache header
    const header = (
      this.scope.isInLoop
        ? this.scope.createLoopHeader()
        : this.scope.createHeader()
    );
    // Get the memo index
    const index = this.scope.createIndex();
    // Generate the access expression
    const pos = t.memberExpression(header, index, true);
    // Generate the `v` identifier
    const vid = this.path.scope.generateUidIdentifier('value');

    let condition: t.Expression | undefined;

    // Dependencies is an array of conditions
    if (Array.isArray(dependencies)) {
      // Makes sure to dedupe
      const newSet = new Set<t.Identifier>();
      let dependency: t.Expression | undefined;
      for (let i = 0, len = dependencies.length; i < len; i++) {
        dependency = dependencies[i];
        if (condition && dependency) {
          if (dependency.type === 'Identifier') {
            // dependency is already part of the condition, skip
            if (!newSet.has(dependency)) {
              condition = t.logicalExpression('&&', condition, dependency);
              newSet.add(dependency);
            }
          } else {
            condition = t.logicalExpression('&&', condition, dependency);
          }
        } else if (dependency) {
          condition = dependency;
          if (dependency.type === 'Identifier') {
            newSet.add(dependency);
          }
        }
      }
    } else if (dependencies === true) {
      // Do nothing
    } else if (dependencies) {
      // just reuse the dependency
      condition = dependencies;
    } else {
      // Compare memoized version to incoming version
      condition = t.callExpression(
        getImportIdentifier(this.ctx, this.path, RUNTIME_EQUALS),
        [header, index, current],
      );
    }

    let eqid: t.Expression;

    // Generates the condition expression
    if (condition == null) {
      // Specifies that this memoization mode
      // is a "constant"
      // so we don't need to generate an extra
      // declaration
      eqid = pos;
    } else if (condition.type === 'Identifier') {
      // Reuse the identifier
      eqid = condition;
    } else {
      // Generate a new identifier for the condition
      eqid = this.path.scope.generateUidIdentifier('equals');
    }

    // Generates the variable declaration
    const declaration: t.VariableDeclarator[] = [];
    if (condition && condition.type !== 'Identifier') {
      declaration.push(t.variableDeclarator(eqid, condition));
    }

    const optimized = optimizedExpr(
      vid,
      condition == null ? [] : eqid,
    );
    // Register as a constant
    if (condition == null) {
      this.scope.addConstant(vid);
    }

    // Mark the identifier as optimized
    if (current.type === 'Identifier') {
      this.scope.setOptimized(current, optimized);
      this.scope.setOptimized(vid, optimized);
    }

    const init = t.conditionalExpression(
      condition ? eqid : t.binaryExpression('in', index, header),
      pos,
      t.assignmentExpression('=', pos, current),
    );

    declaration.push(t.variableDeclarator(vid, init));

    this.scope.push(t.variableDeclaration('let', declaration));

    return optimized;
  }

  dependency = new WeakMap<t.Expression, OptimizedExpression>();

  /**
   * Registers a dependency
   */
  createDependency<T extends t.Expression>(
    path: babel.NodePath<T>,
  ): OptimizedExpression | undefined {
    // Get optimized expression
    const optimized = this.optimizeExpression(path);
    // If the expression is a constant
    // ignore this dependency
    if (optimized.constant) {
      return undefined;
    }
    // If the expression is an identifier
    // and potentially optimized as a constant
    // then just return it
    if (optimized.expr.type === 'Identifier' && this.scope.hasConstant(optimized.expr)) {
      return optimized;
    }
    // If the node itself is a "dependency"
    // then this is basically redundant work, skipping
    const result = this.dependency.get(path.node);
    if (result) {
      return result;
    }
    // The value has been optimized but value isn't referentially
    // compared, so generate a referential-comparison memo
    const record = this.createMemo(optimized.expr, false);
    this.dependency.set(path.node, record);
    return record;
  }

  memoizeIdentifier(
    path: babel.NodePath,
    id: t.Identifier,
  ): OptimizedExpression {
    if (isForeignBinding(this.path, path, id.name)) {
      return optimizedExpr(id, [], true);
    }
    // Check if scope has the binding (no globals)
    // we only want to memoize identifiers
    // that are part of the render evaluation
    const binding = path.scope.getBindingIdentifier(id.name);
    if (binding) {
      // Memoize as a "dependency"
      return this.createMemo(binding, false);
    }
    // Identifier is marked as optimized
    // but we just basically "skip"
    return optimizedExpr(id, [], true);
  }

  optimizeIdentifier(
    path: babel.NodePath<t.Identifier>,
  ): OptimizedExpression {
    return this.memoizeIdentifier(path, path.node);
  }

  memoizeMemberExpression(
    path: babel.NodePath<t.MemberExpression>,
  ): { expr: t.MemberExpression; deps: t.Expression[] } {
    if (isConstant(this, path)) {
      return {
        expr: path.node,
        deps: [],
      };
    }
    // Create dependencies
    const condition = createDependencies();
    // Mark source as a dependency
    const source = this.createDependency(path.get('object'));
    if (source) {
      path.node.object = source.expr;
      mergeDependencies(condition, source.deps);
    }
    // Only memoize computed properties (obviously)
    if (path.node.computed) {
      const propertyPath = path.get('property');
      if (isPathValid(propertyPath, t.isExpression)) {
        const property = this.createDependency(propertyPath);
        if (property) {
          path.node.property = property.expr;
          mergeDependencies(condition, property.deps);
        }
      }
    }

    return {
      expr: path.node,
      deps: condition,
    };
  }

  optimizeMemberExpression(
    path: babel.NodePath<t.MemberExpression | t.OptionalMemberExpression>,
  ): OptimizedExpression {
    const result = this.memoizeMemberExpression(path as babel.NodePath<t.MemberExpression>);
    // Memoize the entire expression as a whole
    // The method above only memoized part of the expression
    // but it is also needed to get its dependencies
    return this.createMemo(result.expr, result.deps);
  }

  optimizeConditionalExpression(
    path: babel.NodePath<t.ConditionalExpression>,
  ): OptimizedExpression {
    const id = path.scope.generateUidIdentifier('value');
    const parent = this.scope;
    const optimizedTest = this.optimizeExpression(path.get('test'));
    const consequentPath = path.get('consequent');
    const consequent = new OptimizerScope(this.ctx, consequentPath, parent);
    this.scope = consequent;
    const optimizedConsequent = this.optimizeExpression(consequentPath);
    this.scope = parent;
    const alternatePath = path.get('alternate');
    const alternate = new OptimizerScope(this.ctx, alternatePath, parent);
    this.scope = alternate;
    const optimizedAlternate = this.optimizeExpression(alternatePath);
    this.scope = parent;

    consequent.push(
      t.expressionStatement(
        t.assignmentExpression('=', id, optimizedConsequent.expr),
      ),
    );
    alternate.push(
      t.expressionStatement(
        t.assignmentExpression('=', id, optimizedAlternate.expr),
      ),
    );
    this.scope.push(
      t.variableDeclaration(
        'let',
        [t.variableDeclarator(id)],
      ),
      t.ifStatement(
        optimizedTest.expr,
        t.blockStatement(consequent.getStatements()),
        t.blockStatement(alternate.getStatements()),
      ),
    );

    return optimizedExpr(id);
  }

  optimizeBinaryExpression(
    path: babel.NodePath<t.BinaryExpression>,
  ): OptimizedExpression {
    if (path.node.operator === '|>') {
      return optimizedExpr(path.node);
    }
    const leftPath = path.get('left');

    const dependencies = createDependencies();

    if (isPathValid(leftPath, t.isExpression)) {
      const left = this.createDependency(leftPath);
      if (left) {
        path.node.left = left.expr;
        mergeDependencies(dependencies, left.deps);
      }
    }
    const right = this.createDependency(path.get('right'));
    if (right) {
      path.node.right = right.expr;
      mergeDependencies(dependencies, right.deps);
    }

    return this.createMemo(path.node, dependencies);
  }

  optimizeLogicalExpression(
    path: babel.NodePath<t.LogicalExpression>,
  ): OptimizedExpression {
    const id = path.scope.generateUidIdentifier('condition');
    const parent = this.scope;
    const left = this.optimizeExpression(path.get('left'));
    const rightScope = new OptimizerScope(this.ctx, path, parent);
    this.scope = rightScope;
    const right = this.optimizeExpression(path.get('right'));
    this.scope = parent;

    let test: t.Expression = id;
    switch (path.node.operator) {
      case '??':
        test = t.binaryExpression('==', id, t.nullLiteral());
        break;
      case '||':
        test = t.unaryExpression('!', id);
        break;
      default:
        break;
    }

    rightScope.push(
      t.expressionStatement(
        t.assignmentExpression('=', id, right.expr),
      ),
    );

    this.scope.push(
      t.variableDeclaration(
        'let',
        [t.variableDeclarator(id, left.expr)],
      ),
      t.ifStatement(
        test,
        t.blockStatement(rightScope.getStatements()),
      ),
    );
    return optimizedExpr(id);
  }

  optimizeUnaryExpression(
    path: babel.NodePath<t.UnaryExpression>,
  ): OptimizedExpression {
    const optimized = this.createDependency(path.get('argument'));
    if (optimized) {
      path.node.argument = optimized.expr;
      return this.createMemo(path.node, optimized.deps);
    }
    return optimizedExpr(path.node);
  }

  optimizeEffect(
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ): OptimizedExpression {
    const [callback, dependencies] = path.get('arguments');
    if (isPathValid(callback, t.isExpression)) {
      if (dependencies && isPathValid(dependencies, t.isExpression)) {
        const optimizedArray = this.optimizeExpression(dependencies);
        path.node.arguments[1] = t.arrayExpression([optimizedArray.expr]);
        return optimizedExpr(path.node, optimizedArray.deps);
      }
      const optimized = this.optimizeExpression(callback);
      path.node.arguments = [
        optimized.expr,
        t.arrayExpression([optimized.expr]),
      ];
      return optimizedExpr(path.node, optimized.deps);
    }
    return optimizedExpr(path.node);
  }

  optimizeCallback(
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ): OptimizedExpression {
    const [callback, dependencies] = path.get('arguments');
    if (isPathValid(callback, t.isExpression)) {
      if (dependencies && isPathValid(dependencies, t.isExpression)) {
        const dependency = this.optimizeExpression(dependencies);
        return this.createMemo(callback.node, dependency.deps);
      }
      return this.optimizeExpression(callback);
    }
    return optimizedExpr(path.node);
  }

  optimizeMemo(
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ): OptimizedExpression {
    const [callback, dependencies] = path.get('arguments');
    if (isPathValid(callback, t.isExpression)) {
      if (dependencies && isPathValid(dependencies, t.isExpression)) {
        const dependency = this.optimizeExpression(dependencies);
        return this.createMemo(t.callExpression(callback.node, []), dependency.deps);
      }
      const optimized = this.optimizeExpression(callback);
      return this.createMemo(t.callExpression(optimized.expr, []), optimized.deps);
    }
    return optimizedExpr(path.node);
  }

  optimizeRef(
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ): OptimizedExpression {
    const arg = path.node.arguments[0];
    let init: t.Expression | undefined;
    if (arg) {
      switch (arg.type) {
        case 'SpreadElement':
          init = t.memberExpression(arg.argument, t.numericLiteral(0), true);
          break;
        case 'ArgumentPlaceholder':
        case 'JSXNamespacedName':
          break;
        default:
          init = arg;
          break;
      }
    }
    const expr = t.objectExpression([
      t.objectProperty(
        t.identifier('current'),
        init || t.identifier('undefined'),
      ),
    ]);
    return this.createMemo(expr, true);
  }

  optimizeCallExpression(
    path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  ): OptimizedExpression {
    const hookType = getHookCallType(this.ctx, path);
    switch (hookType) {
      case 'callback':
        return this.optimizeCallback(path);
      case 'effect':
        return this.optimizeEffect(path);
      case 'memo':
        return this.optimizeMemo(path);
      case 'ref':
        return this.optimizeRef(path);
      case 'custom':
      case 'none': {
        // Build dependencies
        const condition = createDependencies();
        if (hookType === 'none') {
          const callee = path.get('callee');
          if (isPathValid(callee, t.isExpression)) {
            const optimizedCallee = (
              (isPathValid(callee, t.isMemberExpression)
                || isPathValid(callee, t.isOptionalMemberExpression))
                ? this.memoizeMemberExpression(callee as babel.NodePath<t.MemberExpression>)
                : this.createDependency(callee)
            );
            if (optimizedCallee) {
              path.node.callee = optimizedCallee.expr;
              mergeDependencies(condition, optimizedCallee.deps);
            }
          }
        }
        const argumentsPath = path.get('arguments');
        let argument: typeof argumentsPath[0];
        for (let i = 0, len = argumentsPath.length; i < len; i++) {
          argument = argumentsPath[i];
          if (isPathValid(argument, t.isExpression)) {
            const optimized = this.createDependency(argument);
            if (optimized) {
              mergeDependencies(condition, optimized.deps);
              path.node.arguments[i] = optimized.expr;
            }
          } else if (isPathValid(argument, t.isSpreadElement)) {
            const optimized = this.createDependency(argument.get('argument'));
            if (optimized) {
              mergeDependencies(condition, optimized.deps);
              argument.node.argument = optimized.expr;
            }
          }
        }
        if (hookType === 'custom') {
          return optimizedExpr(path.node, condition);
        }
        return this.createMemo(path.node, condition);
      }
      default:
        return optimizedExpr(path.node);
    }
  }

  optimizeFunctionExpression(
    path: babel.NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
  ): OptimizedExpression {
    const bindings = getForeignBindings(path);
    const dependencies = createDependencies();
    let binding: t.Identifier;
    for (let i = 0, len = bindings.length; i < len; i++) {
      binding = bindings[i];
      const optimized = this.memoizeIdentifier(path, binding);
      mergeDependencies(dependencies, optimized.deps);
    }
    return this.createMemo(path.node, dependencies);
  }

  optimizeLVal(
    path: babel.NodePath<t.LVal>,
    dirty = false,
  ): { expr: t.LVal; deps?: t.Expression | t.Expression[] } {
    if (isPathValid(path, t.isIdentifier)) {
      if (dirty) {
        const binding = path.scope.getBindingIdentifier(path.node.name);
        if (binding) {
          // Variable has been modified, marked as dirty
          this.scope.deleteOptimized(binding);
        }
      }
    }
    if (isPathValid(path, t.isMemberExpression)) {
      return this.memoizeMemberExpression(path);
    }
    // TODO Destructuring
    return {
      expr: path.node,
      deps: [],
    };
  }

  optimizeAssignmentExpression(
    path: babel.NodePath<t.AssignmentExpression>,
  ): OptimizedExpression {
    const dependencies = createDependencies();
    const left = this.optimizeLVal(path.get('left'), true);
    path.node.left = left.expr;
    mergeDependencies(dependencies, left.deps);

    const right = this.createDependency(path.get('right'));
    if (right) {
      path.node.right = right.expr;
      mergeDependencies(dependencies, right.deps);
    }
    return optimizedExpr(path.node, dependencies);
  }

  optimizeArrayExpression(
    path: babel.NodePath<t.ArrayExpression | t.TupleExpression>,
  ): OptimizedExpression {
    const condition = createDependencies();
    const elementsPath = path.get('elements');

    for (let i = 0, len = elementsPath.length; i < len; i++) {
      const element = elementsPath[i];

      if (isPathValid(element, t.isExpression)) {
        const optimized = this.createDependency(element);
        if (optimized) {
          mergeDependencies(condition, optimized.deps);
          path.node.elements[i] = optimized.expr;
        }
      } else if (isPathValid(element, t.isSpreadElement)) {
        const optimized = this.createDependency(element.get('argument'));
        if (optimized) {
          mergeDependencies(condition, optimized.deps);
          element.node.argument = optimized.expr;
        }
      }
    }
    return this.createMemo(path.node, condition);
  }

  optimizeObjectExpression(
    path: babel.NodePath<t.ObjectExpression | t.RecordExpression>,
  ): OptimizedExpression {
    const condition = createDependencies();
    const elementsPath = path.get('properties');

    for (let i = 0, len = elementsPath.length; i < len; i++) {
      const element = elementsPath[i];
      if (isPathValid(element, t.isObjectProperty)) {
        if (element.node.computed) {
          const keyPath = element.get('key');

          if (isPathValid(keyPath, t.isExpression)) {
            const optimized = this.createDependency(keyPath);
            if (optimized) {
              mergeDependencies(condition, optimized.deps);
              element.node.key = optimized.expr;
            }
          }
        }
        const valuePath = element.get('value');

        if (isPathValid(valuePath, t.isExpression)) {
          const optimized = this.optimizeExpression(valuePath);
          if (optimized) {
            mergeDependencies(condition, optimized.deps);
            element.node.value = optimized.expr;
          }
        }
      } else if (isPathValid(element, t.isSpreadElement)) {
        const optimized = this.createDependency(element.get('argument'));
        if (optimized) {
          mergeDependencies(condition, optimized.deps);
          element.node.argument = optimized.expr;
        }
      } else if (isPathValid(element, t.isObjectMethod)) {
        const bindings = getForeignBindings(path);
        const dependencies = createDependencies();
        let binding: t.Identifier;
        for (let k = 0, klen = bindings.length; k < klen; k++) {
          binding = bindings[k];
          const optimized = this.memoizeIdentifier(path, binding);
          mergeDependencies(dependencies, optimized.deps);
        }
        mergeDependencies(condition, dependencies);
      }
    }

    return this.createMemo(path.node, condition);
  }

  optimizeNewExpression(
    path: babel.NodePath<t.NewExpression>,
  ): OptimizedExpression {
    const calleePath = path.get('callee');
    if (isPathValid(calleePath, t.isExpression)) {
      // Build dependencies
      const condition = createDependencies();
      const callee = this.createDependency(calleePath);
      if (callee) {
        path.node.callee = callee.expr;
        mergeDependencies(condition, callee.deps);
      }
      const argumentsPath = path.get('arguments');
      let argument: typeof argumentsPath[0];
      for (let i = 0, len = argumentsPath.length; i < len; i++) {
        argument = argumentsPath[i];
        if (isPathValid(argument, t.isExpression)) {
          const optimized = this.createDependency(argument);
          if (optimized) {
            mergeDependencies(condition, optimized.deps);
            path.node.arguments[i] = optimized.expr;
          }
        } else if (isPathValid(argument, t.isSpreadElement)) {
          const optimized = this.createDependency(argument.get('argument'));
          if (optimized) {
            mergeDependencies(condition, optimized.deps);
            argument.node.argument = optimized.expr;
          }
        }
      }
      return this.createMemo(path.node, condition);
    }
    return optimizedExpr(path.node);
  }

  optimizeSequenceExpression(
    path: babel.NodePath<t.SequenceExpression>,
  ): OptimizedExpression {
    const expressions = path.get('expressions');
    let expr: typeof expressions[0];
    for (let i = 0, len = expressions.length; i < len; i++) {
      expr = expressions[i];
      const result = this.optimizeExpression(expr);
      path.node.expressions[i] = result.expr;
    }
    return optimizedExpr(path.node);
  }

  memoizeTemplateLiteral(
    path: babel.NodePath<t.TemplateLiteral>,
  ): { expr: t.TemplateLiteral; deps: t.Expression[] } {
    const conditions = createDependencies();
    const expressions = path.get('expressions');
    let expr: typeof expressions[0];
    for (let i = 0, len = expressions.length; i < len; i++) {
      expr = expressions[i];
      if (isPathValid(expr, t.isExpression)) {
        const dependency = this.createDependency(expr);
        if (dependency) {
          path.node.expressions[i] = dependency.expr;
          mergeDependencies(conditions, dependency.deps);
        }
      }
    }
    return {
      expr: path.node,
      deps: conditions,
    };
  }

  optimizeTemplateLiteral(
    path: babel.NodePath<t.TemplateLiteral>,
  ): OptimizedExpression {
    const result = this.memoizeTemplateLiteral(path);
    return this.createMemo(result.expr, result.deps);
  }

  optimizedTaggedTemplateExpression(
    path: babel.NodePath<t.TaggedTemplateExpression>,
  ): OptimizedExpression {
    const conditions = createDependencies();
    const tag = this.createDependency(path.get('tag'));
    if (tag) {
      mergeDependencies(conditions, tag.deps);
      path.node.tag = tag.expr;
    }
    const quasi = this.memoizeTemplateLiteral(path.get('quasi'));
    mergeDependencies(conditions, quasi.deps);
    path.node.quasi = quasi.expr;

    return this.createMemo(path.node, conditions);
  }

  memoizeJSXChildren(
    path: babel.NodePath<t.JSXFragment | t.JSXElement>,
  ): t.Expression[] {
    const conditions = createDependencies();
    const children = path.get('children');
    let child: typeof children[0];
    for (let i = 0, len = children.length; i < len; i++) {
      child = children[i];
      if (isPathValid(child, t.isJSXFragment)) {
        const optimized = this.createDependency(child);
        if (optimized) {
          path.node.children[i] = t.jsxExpressionContainer(optimized.expr);
          mergeDependencies(conditions, optimized.deps);
        }
      } else if (isPathValid(child, t.isJSXElement)) {
        const optimized = this.createDependency(child);
        if (optimized) {
          path.node.children[i] = t.jsxExpressionContainer(optimized.expr);
          mergeDependencies(conditions, optimized.deps);
        }
      } else if (isPathValid(child, t.isJSXExpressionContainer)) {
        const expr = child.get('expression');
        if (isPathValid(expr, t.isExpression)) {
          const optimized = this.createDependency(expr);
          if (optimized) {
            child.node.expression = optimized.expr;
            mergeDependencies(conditions, optimized.deps);
          }
        }
      } else if (isPathValid(child, t.isJSXSpreadChild)) {
        const optimized = this.createDependency(child.get('expression'));
        if (optimized) {
          child.node.expression = optimized.expr;
          mergeDependencies(conditions, optimized.deps);
        }
      }
    }

    return conditions;
  }

  optimizeJSXFragment(
    path: babel.NodePath<t.JSXFragment>,
  ): OptimizedExpression {
    if (this.ctx.preset.runtime.memo) {
      const dependencies = this.memoizeJSXChildren(path);
      return this.createMemo(path.node, dependencies);
    }
    return optimizedExpr(path.node);
  }

  optimizeJSXElement(
    path: babel.NodePath<t.JSXElement>,
  ): OptimizedExpression {
    if (this.ctx.preset.runtime.memo) {
      const dependencies = createDependencies();
      const attributes = path.get('openingElement').get('attributes');
      let attribute: typeof attributes[0];
      for (let i = 0, len = attributes.length; i < len; i++) {
        attribute = attributes[i];
        if (isPathValid(attribute, t.isJSXAttribute)) {
          const value = attribute.get('value');
          if (value) {
            if (isPathValid(value, t.isJSXFragment)) {
              const optimized = this.createDependency(value);
              if (optimized) {
                attribute.node.value = t.jsxExpressionContainer(optimized.expr);
                mergeDependencies(dependencies, optimized.deps);
              }
            } else if (isPathValid(value, t.isJSXElement)) {
              const optimized = this.createDependency(value);
              if (optimized) {
                attribute.node.value = t.jsxExpressionContainer(optimized.expr);
                mergeDependencies(dependencies, optimized.deps);
              }
            } else if (isPathValid(value, t.isJSXExpressionContainer)) {
              const expr = value.get('expression');
              if (isPathValid(expr, t.isExpression)) {
                const optimized = this.createDependency(expr);
                if (optimized) {
                  value.node.expression = optimized.expr;
                  mergeDependencies(dependencies, optimized.deps);
                }
              }
            }
          }
        } else if (isPathValid(attribute, t.isJSXSpreadAttribute)) {
          const optimized = this.createDependency(attribute.get('argument'));
          if (optimized) {
            attribute.node.argument = optimized.expr;
            mergeDependencies(dependencies, optimized.deps);
          }
        }
      }
      if (path.node.children.length) {
        mergeDependencies(dependencies, this.memoizeJSXChildren(path));
      }
      return this.createMemo(path.node, dependencies);
    }
    return optimizedExpr(path.node);
  }

  optimizeExpression(
    path: babel.NodePath<t.Expression>,
  ): OptimizedExpression {
    if (shouldSkipNode(path.node)) {
      return optimizedExpr(path.node, undefined, true);
    }
    if (isPathValid(path, isNestedExpression)) {
      return this.optimizeExpression(path.get('expression'));
    }
    // No need to optimize
    if (t.isLiteral(path.node) && path.node.type !== 'TemplateLiteral') {
      return optimizedExpr(path.node, undefined, true);
    }
    // Only optimize for complex values
    if (isConstant(this, path)) {
      return this.createMemo(path.node, true);
    }
    if (isPathValid(path, t.isIdentifier)) {
      return this.optimizeIdentifier(path);
    }
    if (
      isPathValid(path, t.isMemberExpression)
      || isPathValid(path, t.isOptionalMemberExpression)
    ) {
      return this.optimizeMemberExpression(path);
    }
    if (isPathValid(path, t.isConditionalExpression)) {
      return this.optimizeConditionalExpression(path);
    }
    if (isPathValid(path, t.isBinaryExpression)) {
      return this.optimizeBinaryExpression(path);
    }
    if (isPathValid(path, t.isLogicalExpression)) {
      return this.optimizeLogicalExpression(path);
    }
    if (isPathValid(path, t.isUnaryExpression)) {
      return this.optimizeUnaryExpression(path);
    }
    if (
      isPathValid(path, t.isCallExpression)
      || isPathValid(path, t.isOptionalCallExpression)
    ) {
      return this.optimizeCallExpression(path);
    }
    if (
      isPathValid(path, t.isFunctionExpression)
      || isPathValid(path, t.isArrowFunctionExpression)
    ) {
      return this.optimizeFunctionExpression(path);
    }
    if (isPathValid(path, t.isAssignmentExpression)) {
      return this.optimizeAssignmentExpression(path);
    }
    if (isPathValid(path, t.isArrayExpression) || isPathValid(path, t.isTupleExpression)) {
      return this.optimizeArrayExpression(path);
    }
    if (isPathValid(path, t.isObjectExpression) || isPathValid(path, t.isRecordExpression)) {
      return this.optimizeObjectExpression(path);
    }
    if (isPathValid(path, t.isNewExpression)) {
      return this.optimizeNewExpression(path);
    }
    if (isPathValid(path, t.isSequenceExpression)) {
      return this.optimizeSequenceExpression(path);
    }
    if (isPathValid(path, t.isTaggedTemplateExpression)) {
      return this.optimizedTaggedTemplateExpression(path);
    }
    if (isPathValid(path, t.isTemplateLiteral)) {
      return this.optimizeTemplateLiteral(path);
    }
    if (isPathValid(path, t.isJSXFragment)) {
      return this.optimizeJSXFragment(path);
    }
    if (isPathValid(path, t.isJSXElement)) {
      return this.optimizeJSXElement(path);
    }
    return optimizedExpr(path.node, undefined, true);
  }

  optimizeExpressionStatement(
    path: babel.NodePath<t.ExpressionStatement>,
  ): void {
    const optimized = this.optimizeExpression(path.get('expression'));
    this.scope.push(t.expressionStatement(optimized.expr));
  }

  optimizeVariableDeclaration(
    path: babel.NodePath<t.VariableDeclaration>,
  ): void {
    const declarations = path.get('declarations');
    let declaration: typeof declarations[0];
    for (let i = 0, len = declarations.length; i < len; i++) {
      declaration = declarations[i];
      const init = declaration.node.init
        ? this.optimizeExpression(
          declaration.get('init') as babel.NodePath<t.Expression>,
        ).expr
        : undefined;
      this.scope.push(
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
    }
  }

  optimizeReturnStatement(
    path: babel.NodePath<t.ReturnStatement>,
  ): void {
    if (path.node.argument) {
      const optimized = this.optimizeExpression(path.get('argument') as babel.NodePath<t.Expression>);
      path.node.argument = optimized.expr;
    }
    this.scope.push(path.node);
  }

  optimizeThrowStatement(
    path: babel.NodePath<t.ThrowStatement>,
  ): void {
    const optimized = this.optimizeExpression(path.get('argument'));
    path.node.argument = optimized.expr;
    this.scope.push(path.node);
  }

  private optimizeBlock(
    path: babel.NodePath<t.BlockStatement>,
  ): void {
    if (shouldSkipNode(path.node)) {
      return;
    }
    const statements = path.get('body');
    for (let i = 0, len = statements.length; i < len; i++) {
      this.optimizeStatement(statements[i]);
    }
  }

  optimizeBlockStatement(
    path: babel.NodePath<t.BlockStatement>,
    topBlock = false,
  ): void {
    if (topBlock) {
      this.optimizeBlock(path);
    } else {
      const parent = this.scope;
      const block = new OptimizerScope(this.ctx, path, parent);
      this.scope = block;
      this.optimizeBlock(path);
      this.scope = parent;
      this.scope.push(t.blockStatement(block.getStatements()));
    }
  }

  optimizeIfStatement(
    path: babel.NodePath<t.IfStatement>,
  ): void {
    const optimized = this.optimizeExpression(path.get('test'));
    const parent = this.scope;
    const consequentPath = path.get('consequent');
    const consequent = new OptimizerScope(this.ctx, consequentPath, parent);
    this.scope = consequent;
    this.optimizeStatement(consequentPath, true);
    this.scope = parent;
    const newNode = t.ifStatement(optimized.expr, t.blockStatement(consequent.getStatements()));
    if (path.node.alternate) {
      const alternatePath = path.get('alternate') as babel.NodePath<t.Statement>;
      const alternate = new OptimizerScope(this.ctx, alternatePath, parent);
      this.scope = alternate;
      this.optimizeStatement(alternatePath, true);
      this.scope = parent;
      newNode.alternate = t.blockStatement(alternate.getStatements());
    }
    this.scope.push(newNode);
  }

  optimizeLoopStatement(
    path: babel.NodePath<t.Loop>,
  ): void {
    const parent = this.scope;
    const loop = new OptimizerScope(this.ctx, path, parent, true);
    this.scope = loop;
    this.optimizeStatement(path.get('body'), true);
    this.scope = parent;

    const statements = loop.getStatements();

    const memoDeclaration = loop.getLoopMemoDeclaration();
    if (memoDeclaration) {
      this.scope.push(memoDeclaration);
    }

    path.node.body = t.blockStatement(statements);
    this.scope.push(path.node);
  }

  optimizeForXStatement(
    path: babel.NodePath<t.ForXStatement>,
  ): void {
    const optimized = this.optimizeExpression(path.get('right'));
    path.node.right = optimized.expr;
    this.optimizeLoopStatement(path);
  }

  optimizeSwitchStatement(
    path: babel.NodePath<t.SwitchStatement>,
  ): void {
    const discriminant = this.optimizeExpression(path.get('discriminant'));
    path.node.discriminant = discriminant.expr;

    const parent = this.scope;
    const cases = path.get('cases');
    let current: typeof cases[0];
    for (let i = 0, len = cases.length; i < len; i++) {
      current = cases[i];
      const scope = new OptimizerScope(parent.ctx, current, parent);
      this.scope = scope;
      const consequents = current.get('consequent');
      for (let k = 0, klen = consequents.length; k < klen; k++) {
        this.optimizeStatement(consequents[k]);
      }
      this.scope = parent;
      current.node.consequent = scope.getStatements();
    }
    this.scope = parent;

    this.scope.push(path.node);
  }

  optimizeTryStatement(
    path: babel.NodePath<t.TryStatement>,
  ): void {
    const parent = this.scope;
    const tryBlock = new OptimizerScope(this.ctx, path, parent);
    this.scope = tryBlock;
    this.optimizeBlock(path.get('block'));
    this.scope = parent;
    path.node.block = t.blockStatement(tryBlock.getStatements());

    if (path.node.handler) {
      const handler = path.get('handler') as babel.NodePath<t.CatchClause>;
      const catchClause = new OptimizerScope(this.ctx, handler, parent);
      this.scope = catchClause;
      this.optimizeBlock(handler.get('body'));
      this.scope = parent;
      handler.node.body = t.blockStatement(catchClause.getStatements());
    }
    if (path.node.finalizer) {
      const handler = path.get('finalizer') as babel.NodePath<t.BlockStatement>;
      const finalizerBlock = new OptimizerScope(this.ctx, handler, parent);
      this.scope = finalizerBlock;
      this.optimizeBlock(handler);
      this.scope = parent;
      path.node.finalizer = t.blockStatement(finalizerBlock.getStatements());
    }

    this.scope.push(path.node);
  }

  optimizeLabeledStatement(
    path: babel.NodePath<t.LabeledStatement>,
  ): void {
    const parent = this.scope;
    const block = new OptimizerScope(this.ctx, path, parent);
    this.scope = block;
    this.optimizeStatement(path.get('body'));
    this.scope = parent;
    path.node.body = t.blockStatement(block.getStatements());
    this.scope.push(path.node);
  }

  optimizeStatement(
    path: babel.NodePath<t.Statement>,
    topBlock = false,
  ): void {
    if (shouldSkipNode(path.node)) {
      return;
    }
    switch (path.type) {
      case 'ExpressionStatement':
        this.optimizeExpressionStatement(path as babel.NodePath<t.ExpressionStatement>);
        break;
      case 'VariableDeclaration':
        this.optimizeVariableDeclaration(path as babel.NodePath<t.VariableDeclaration>);
        break;
      case 'ReturnStatement':
        this.optimizeReturnStatement(path as babel.NodePath<t.ReturnStatement>);
        break;
      case 'ThrowStatement':
        this.optimizeThrowStatement(path as babel.NodePath<t.ThrowStatement>);
        break;
      case 'BlockStatement':
        this.optimizeBlockStatement(path as babel.NodePath<t.BlockStatement>, topBlock);
        break;
      case 'IfStatement':
        this.optimizeIfStatement(path as babel.NodePath<t.IfStatement>);
        break;
      case 'ForInStatement':
      case 'ForOfStatement':
        this.optimizeForXStatement(path as babel.NodePath<t.ForXStatement>);
        break;
      case 'ForStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        this.optimizeLoopStatement(path as babel.NodePath<t.Loop>);
        break;
      case 'SwitchStatement':
        this.optimizeSwitchStatement(path as babel.NodePath<t.SwitchStatement>);
        break;
      case 'TryStatement':
        this.optimizeTryStatement(path as babel.NodePath<t.TryStatement>);
        break;
      case 'LabeledStatement':
        this.optimizeLabeledStatement(path as babel.NodePath<t.LabeledStatement>);
        break;
      default:
        this.scope.push(path.node);
        break;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  optimizeArrowComponent(
    path: babel.NodePath<t.ArrowFunctionExpression>,
  ): void {
    path.node.body = t.isStatement(path.node.body)
      ? path.node.body
      : t.blockStatement([
        t.returnStatement(path.node.body),
      ]);
    this.optimizeBlock(path.get('body') as babel.NodePath<t.BlockStatement>);
    path.node.body = t.blockStatement(this.scope.getStatements());
    path.scope.crawl();
  }

  optimizeFunctionComponent(
    path: babel.NodePath<t.FunctionExpression | t.FunctionDeclaration>,
  ): void {
    this.optimizeBlock(path.get('body'));
    path.node.body = t.blockStatement(this.scope.getStatements());
    path.scope.crawl();
  }

  optimize(): void {
    switch (this.path.type) {
      case 'ArrowFunctionExpression':
        this.optimizeArrowComponent(this.path as babel.NodePath<t.ArrowFunctionExpression>);
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
        this.optimizeFunctionComponent(
          this.path as babel.NodePath<t.FunctionExpression | t.FunctionDeclaration>,
        );
        break;
      default:
        break;
    }
  }
}
