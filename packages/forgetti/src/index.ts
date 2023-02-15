import * as babel from '@babel/core';
import { addNamed } from '@babel/helper-module-imports';
import * as t from '@babel/types';
import { forEach } from './arrays';

export type HookIdentity =
  | 'memo'
  | 'callback'
  | 'effect';

export interface ImportRegistration {
  name: string;
  source: string;
  kind: 'named' | 'default';
}

export interface HookRegistration extends ImportRegistration {
  type: HookIdentity;
}

export interface Options {
  memo: ImportRegistration;
  hooks: HookRegistration[];
  hocs: ImportRegistration[];
  shouldCheckComponentName: boolean;
}

interface State extends babel.PluginPass {
  opts: Options;
}

interface StateContext {
  hooks: Map<string, t.Identifier>;
  registrations: {
    hooks: Map<t.Identifier, HookRegistration>;
    hocs: Map<t.Identifier, ImportRegistration>;
  };
  opts: Options;
}

function isComponentishName(name: string) {
  return name[0] >= 'A' && name[0] <= 'Z';
}

function isHookishName(name: string) {
  return name.startsWith('use');
}

function getImportIdentifier(
  ctx: StateContext,
  path: babel.NodePath,
  mod: string,
  name: string,
) {
  const target = `${mod}[${name}]`;
  const current = ctx.hooks.get(target);
  if (current) {
    return current;
  }
  const newID = addNamed(path, name, mod);
  ctx.hooks.set(target, newID);
  return newID;
}

function isValidImportSpecifier(
  specifier: t.ImportSpecifier,
  name: string,
): boolean {
  return (
    (t.isIdentifier(specifier.imported) && specifier.imported.name === name)
    || (t.isStringLiteral(specifier.imported) && specifier.imported.value === name)
  );
}

function extractImportIdentifiers(
  ctx: StateContext,
  path: babel.NodePath<t.ImportDeclaration>,
) {
  const mod = path.node.source.value;

  // Identify hooks
  forEach(ctx.opts.hooks, (registration) => {
    if (mod === registration.source) {
      forEach(path.node.specifiers, (specifier) => {
        if (t.isImportSpecifier(specifier)) {
          if (registration.kind === 'named') {
            ctx.registrations.hooks.set(specifier.local, registration);
          }
        } else if (t.isImportDefaultSpecifier(specifier)) {
          if (registration.kind === 'default') {
            ctx.registrations.hooks.set(specifier.local, registration);
          }
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          ctx.registrations.hooks.set(specifier.local, registration);
        }
      });
    }
  });
  // Identify hocs
  forEach(ctx.opts.hocs, (registration) => {
    if (mod === registration.source) {
      forEach(path.node.specifiers, (specifier) => {
        if (t.isImportSpecifier(specifier)) {
          if (
            registration.kind === 'named'
            && isValidImportSpecifier(specifier, registration.name)
          ) {
            ctx.registrations.hocs.set(specifier.local, registration);
          }
          // For `import { default as x }`
          if (
            registration.kind === 'default'
            && isValidImportSpecifier(specifier, 'default')
          ) {
            ctx.registrations.hocs.set(specifier.local, registration);
          }
        } else if (t.isImportDefaultSpecifier(specifier)) {
          if (registration.kind === 'default') {
            ctx.registrations.hocs.set(specifier.local, registration);
          }
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          ctx.registrations.hocs.set(specifier.local, registration);
        }
      });
    }
  });
}

type ComponentNode = t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration;

function isComponent(node: t.Node): node is ComponentNode {
  return (
    t.isArrowFunctionExpression(node)
    || t.isFunctionExpression(node)
    || t.isFunctionDeclaration(node)
  );
}

type TypeCheck<K> =
  K extends (node: t.Node) => node is (infer U extends t.Node)
    ? U
    : never;

type TypeFilter = (node: t.Node) => boolean;

function unwrapExpression<K extends TypeFilter>(
  node: t.Node,
  key: K,
): TypeCheck<K> | undefined {
  if (key(node)) {
    return node as TypeCheck<K>;
  }
  if (
    t.isParenthesizedExpression(node)
    || t.isTypeCastExpression(node)
    || t.isTSAsExpression(node)
    || t.isTSSatisfiesExpression(node)
    || t.isTSNonNullExpression(node)
    || t.isTSTypeAssertion(node)
    || t.isTSInstantiationExpression(node)
  ) {
    return unwrapExpression(node.expression, key);
  }
  return undefined;
}

function isComponentNameValid(
  ctx: StateContext,
  node: ComponentNode,
  checkName = false,
) {
  if (checkName) {
    if (ctx.opts.shouldCheckComponentName) {
      return false;
    }
    if (t.isFunctionExpression(node) || t.isFunctionDeclaration(node)) {
      return (node.id && isComponentishName(node.id.name));
    }
    return false;
  }
  return true;
}

function traverseFunction(
  ctx: StateContext,
  path: babel.NodePath,
  node: t.Node,
) {
  if (t.isBlock(node)) {

  }
}

function transformFunction(
  ctx: StateContext,
  path: babel.NodePath,
  checkName = false,
) {
  const node = unwrapExpression(path.node, isComponent);
  if (node && isComponentNameValid(ctx, node, checkName)) {
    traverseFunction(ctx, path, node);
  }
}

function transformHOC(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression>,
) {
  if (path.node.arguments.length === 0) {
    return;
  }
  // Check if callee is potentially a named or default import
  const trueID = unwrapExpression(path.node.callee, t.isIdentifier);
  if (t.isIdentifier(trueID)) {
    const binding = path.scope.getBindingIdentifier(trueID.name);
    if (binding) {
      const registration = ctx.registrations.hocs.get(binding);
      if (registration) {
        transformFunction(ctx, path.get('arguments')[0]);
      }
    }
  // Check if callee is potentially a namespace import
  }
  const trueMember = unwrapExpression(path.node.callee, t.isMemberExpression);
  if (
    trueMember
    && !trueMember.computed
    && t.isIdentifier(trueMember.property)
  ) {
    const obj = unwrapExpression(trueMember.object, t.isIdentifier);
    if (!t.isIdentifier(obj)) {
      return;
    }
    const binding = path.scope.getBindingIdentifier(obj.name);
    if (binding) {
      const registration = ctx.registrations.hocs.get(binding);
      if (registration && registration.name === trueMember.property.name) {
        transformFunction(ctx, path.get('arguments')[0]);
      }
    }
  }
}

function transformVariableDeclarator(
  ctx: StateContext,
  path: babel.NodePath<t.VariableDeclarator>,
) {
  if (!path.node.init) {
    return;
  }
  if (!t.isIdentifier(path.node.id)) {
    return;
  }
  if (isComponentishName(path.node.id.name)) {
    transformFunction(ctx, path, false);
  }
}

export function forgettiPlugin(): babel.PluginObj<State> {
  return {
    name: 'forgetti',
    visitor: {
      Program(programPath, { opts }) {
        const ctx: StateContext = {
          hooks: new Map(),
          registrations: {
            hooks: new Map(),
            hocs: new Map(),
          },
          opts,
        };

        // Register all import specifiers
        programPath.traverse({
          ImportDeclaration(path) {
            extractImportIdentifiers(ctx, path);
          },
        });

        programPath.traverse({
          // Check for HOCs
          CallExpression(path) {
            transformHOC(ctx, path);
          },
          ArrowFunctionExpression(path) {
            transformFunction(ctx, path);
          },
          FunctionDeclaration(path) {
            transformFunction(ctx, path);
          },
          FunctionExpression(path) {
            transformFunction(ctx, path);
          },
          VariableDeclarator(path) {
            transformVariableDeclarator(ctx, path);
          },
        });
      },
    },
  };
}
