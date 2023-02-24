import * as t from '@babel/types';
import { addDefault, addNamed } from '@babel/helper-module-imports';
import { StateContext } from './types';

export default class OptimizerScope {
  memo: t.Identifier | undefined;

  indeces = 0;

  ctx: StateContext;

  path: babel.NodePath;

  parent?: OptimizerScope;

  constructor(
    ctx: StateContext,
    path: babel.NodePath,
    parent?: OptimizerScope,
  ) {
    this.ctx = ctx;
    this.path = path;
    this.parent = parent;
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

  getMemoDeclaration() {
    if (!this.memo) {
      return undefined;
    }
    return t.variableDeclaration('let', [
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
    ]);
  }

  loop: t.Identifier | undefined;

  loopIndex: t.Identifier | undefined;

  createLoopHeader() {
    if (!this.loop) {
      this.loop = this.path.scope.generateUidIdentifier('l');
    }
    return this.loop;
  }

  createLoopIndex() {
    if (!this.loopIndex) {
      this.loopIndex = this.path.scope.generateUidIdentifier('id');
    }
    return this.loopIndex;
  }

  getLoopMemoDeclaration() {
    if (!this.parent) {
      return undefined;
    }
    const header = this.parent.createHeader();
    const index = this.parent.createIndex();
    const id = this.createLoopIndex();
    const pos = t.memberExpression(header, index, true);
    const condition = t.binaryExpression('in', index, header);

    return t.variableDeclaration('let', [
      t.variableDeclarator(
        this.createHeader(),
        t.conditionalExpression(
          condition,
          pos,
          t.assignmentExpression('=', pos, t.arrayExpression()),
        ),
      ),
      t.variableDeclarator(id, t.numericLiteral(0)),
    ]);
  }

  getLoopDeclaration() {
    const header = this.createHeader();
    const index = this.createLoopIndex();
    const localIndex = this.path.scope.generateUidIdentifier('lid');
    const pos = t.memberExpression(header, localIndex, true);
    return t.variableDeclaration('let', [
      t.variableDeclarator(localIndex, t.updateExpression('++', index)),
      t.variableDeclarator(
        this.createLoopHeader(),
        t.conditionalExpression(
          t.binaryExpression('in', localIndex, header),
          pos,
          t.assignmentExpression(
            '=',
            pos,
            t.newExpression(
              t.identifier('Array'),
              [t.numericLiteral(this.indeces)],
            ),
          ),
        ),
      ),
    ]);
  }
}
