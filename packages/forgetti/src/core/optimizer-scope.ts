import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { RUNTIME_BRANCH, RUNTIME_CACHE, RUNTIME_REF } from './imports';
import type { OptimizedExpression, StateContext } from './types';
import { getImportIdentifier } from './utils/get-import-identifier';

const ArrayPrototypePush = Array.prototype.push;

function mergeVariableDeclaration(statements: t.Statement[]): t.Statement[] {
  let stack: t.VariableDeclarator[] = [];
  const newStatements: t.Statement[] = [];
  let value: t.Statement;
  for (let i = 0, len = statements.length; i < len; i++) {
    value = statements[i];
    if (t.isVariableDeclaration(value) && value.kind === 'let') {
      ArrayPrototypePush.apply(stack, value.declarations);
    } else {
      if (stack.length) {
        newStatements.push(t.variableDeclaration('let', stack));
        stack = [];
      }
      newStatements.push(value);
    }
  }
  return newStatements;
}

export default class OptimizerScope {
  // Reference to the root memo
  memo: t.Identifier | undefined;

  // Reference to the root ref
  ref: t.Identifier | undefined;

  // Size of memo
  indecesMemo = 0;

  // Size of ref
  indecesRef = 0;

  ctx: StateContext;

  path: babel.NodePath;

  parent?: OptimizerScope;

  isInLoop?: boolean;

  statements: t.Statement[] = [];

  constructor(
    ctx: StateContext,
    path: babel.NodePath,
    parent?: OptimizerScope,
    isInLoop?: boolean,
  ) {
    this.ctx = ctx;
    this.path = path;
    this.parent = parent;
    this.isInLoop = isInLoop;
  }

  createHeader(type: 'memo' | 'ref' = 'memo'): t.Identifier {
    if (type === 'ref') {
      if (!this.ref) {
        this.ref = this.path.scope.generateUidIdentifier('ref');
      }
      return this.ref;
    }

    if (!this.memo) {
      this.memo = this.path.scope.generateUidIdentifier('cache');
    }
    return this.memo;
  }

  createIndex(type: 'memo' | 'ref'): t.NumericLiteral {
    const current = type === 'memo' ? this.indecesMemo : this.indecesRef;
    if (type === 'memo') {
      this.indecesMemo += 1;
    } else {
      this.indecesRef += 1;
    }

    return t.numericLiteral(current);
  }

  getMemoDeclarations(): t.VariableDeclaration[] | undefined {
    if (this.memo || this.ref) {
      // This is for generating branched caching.
      // Parent means that we want to create the cache
      // from the parent (or root)
      if (this.parent) {
        const header = this.parent.createHeader();
        const index = this.parent.createIndex('memo');

        return [
          t.variableDeclaration('let', [
            t.variableDeclarator(
              this.createHeader(),
              t.callExpression(
                getImportIdentifier(this.ctx, this.path, RUNTIME_BRANCH),
                [header, index, t.numericLiteral(this.indecesMemo)],
              ),
            ),
          ]),
        ];
      }

      const outputDeclarations = [];

      if (this.memo) {
        outputDeclarations.push(
          t.variableDeclaration('let', [
            t.variableDeclarator(
              this.memo,
              t.callExpression(
                getImportIdentifier(this.ctx, this.path, RUNTIME_CACHE),
                [
                  getImportIdentifier(
                    this.ctx,
                    this.path,
                    this.ctx.preset.runtime.useMemo,
                  ),
                  t.numericLiteral(this.indecesMemo),
                ],
              ),
            ),
          ]),
        );
      }
      if (this.ref) {
        outputDeclarations.push(
          t.variableDeclaration('let', [
            t.variableDeclarator(
              this.ref,
              t.callExpression(
                getImportIdentifier(this.ctx, this.path, RUNTIME_REF),
                [
                  getImportIdentifier(
                    this.ctx,
                    this.path,
                    this.ctx.preset.runtime.useRef,
                  ),
                  t.numericLiteral(this.indecesRef),
                ],
              ),
            ),
          ]),
        );
      }

      return outputDeclarations;
    }
    return undefined;
  }

  loop: t.Identifier | undefined;

  loopIndex: t.Identifier | undefined;

  createLoopHeader(): t.Identifier {
    if (!this.loop) {
      this.loop = this.path.scope.generateUidIdentifier('loop');
    }
    return this.loop;
  }

  createLoopIndex(): t.Identifier {
    if (!this.loopIndex) {
      this.loopIndex = this.path.scope.generateUidIdentifier('id');
    }
    return this.loopIndex;
  }

  getLoopMemoDeclaration(): t.VariableDeclaration | undefined {
    if (!this.parent) {
      return undefined;
    }
    const header = this.parent.createHeader();
    const index = this.parent.createIndex('memo');
    const id = this.createLoopIndex();

    return t.variableDeclaration('let', [
      t.variableDeclarator(
        this.createHeader(),
        t.callExpression(
          getImportIdentifier(this.ctx, this.path, RUNTIME_BRANCH),
          // Looped branches cannot be statically analyzed
          [header, index, t.numericLiteral(0)],
        ),
      ),
      // This is for tracking the dynamic size
      t.variableDeclarator(id, t.numericLiteral(0)),
    ]);
  }

  getLoopDeclaration(): t.VariableDeclaration {
    const header = this.createHeader();
    const index = this.createLoopIndex();
    const localIndex = this.path.scope.generateUidIdentifier('loopId');
    return t.variableDeclaration('let', [
      t.variableDeclarator(localIndex, t.updateExpression('++', index)),
      t.variableDeclarator(
        this.createLoopHeader(),
        t.callExpression(
          getImportIdentifier(this.ctx, this.path, RUNTIME_BRANCH),
          [header, localIndex, t.numericLiteral(this.indecesMemo)],
        ),
      ),
    ]);
  }

  getStatements(): t.Statement[] {
    const result = [...this.statements];
    const header = this.isInLoop
      ? [this.getLoopDeclaration()]
      : this.getMemoDeclarations();
    if (header) {
      return mergeVariableDeclaration([...header, ...result]);
    }
    return mergeVariableDeclaration(result);
  }

  push(...statements: t.Statement[]): void {
    this.statements = this.statements.concat(statements);
  }

  optimizedID = new WeakMap<t.Identifier, OptimizedExpression>();

  setOptimized(key: t.Identifier, value: OptimizedExpression): void {
    this.optimizedID.set(key, value);
  }

  getOptimized(key: t.Identifier): OptimizedExpression | undefined {
    return this.optimizedID.get(key);
  }

  deleteOptimized(key: t.Identifier): void {
    let current: OptimizerScope | undefined = this;
    while (current) {
      if (current.optimizedID.has(key)) {
        current.optimizedID.delete(key);
        return;
      }
      current = current.parent;
    }
  }

  constants = new WeakSet<t.Identifier>();

  addConstant(value: t.Identifier): void {
    this.constants.add(value);
  }

  hasConstant(value: t.Identifier): boolean {
    return this.constants.has(value);
  }
}
