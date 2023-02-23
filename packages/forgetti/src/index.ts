import * as babel from '@babel/core';
import * as t from '@babel/types';
import { forEach } from './core/arrays';
import {
  isValidImportSpecifier,
  isComponent,
  isComponentNameValid,
  isComponentishName,
} from './core/checks';
import Optimizer from './core/optimizer';
import { StateContext, State } from './core/types';
import unwrapNode from './core/unwrap-node';
import unwrapPath from './core/unwrap-path';

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
          if (
            registration.kind === 'named'
            && isValidImportSpecifier(specifier, registration.name)
          ) {
            ctx.registrations.hooks.set(specifier.local, registration);
          }
          if (
            registration.kind === 'default'
            && isValidImportSpecifier(specifier, 'default')
          ) {
            ctx.registrations.hooks.set(specifier.local, registration);
          }
        } else if (t.isImportDefaultSpecifier(specifier)) {
          if (registration.kind === 'default' && specifier.local.name === registration.name) {
            ctx.registrations.hooks.set(specifier.local, registration);
          }
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          let current = ctx.registrations.hooksNamespaces.get(specifier.local);
          if (!current) {
            current = [];
          }
          current.push(registration);
          ctx.registrations.hooksNamespaces.set(specifier.local, current);
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
          if (registration.kind === 'default' && specifier.local.name === registration.name) {
            ctx.registrations.hocs.set(specifier.local, registration);
          }
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          let current = ctx.registrations.hocsNamespaces.get(specifier.local);
          if (!current) {
            current = [];
          }
          current.push(registration);
          ctx.registrations.hocsNamespaces.set(specifier.local, current);
        }
      });
    }
  });
}

type Argument =
  | t.Expression
  | t.ArgumentPlaceholder
  | t.JSXNamespacedName
  | t.SpreadElement
  | t.FunctionDeclaration;

function transformFunction(
  ctx: StateContext,
  path: babel.NodePath<Argument>,
  checkName = false,
) {
  const unwrapped = unwrapPath(path, isComponent);
  if (unwrapped && isComponentNameValid(ctx, unwrapped.node, checkName)) {
    new Optimizer(ctx, unwrapped).optimize();
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
  const trueID = unwrapNode(path.node.callee, t.isIdentifier);
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
  const trueMember = unwrapNode(path.node.callee, t.isMemberExpression);
  if (
    trueMember
    && !trueMember.computed
    && t.isIdentifier(trueMember.property)
  ) {
    const obj = unwrapNode(trueMember.object, t.isIdentifier);
    if (obj) {
      const binding = path.scope.getBindingIdentifier(obj.name);
      if (binding) {
        const registrations = ctx.registrations.hocsNamespaces.get(binding);
        if (registrations) {
          const propName = trueMember.property.name;
          forEach(registrations, (registration) => {
            if (registration && registration.name === propName) {
              transformFunction(ctx, path.get('arguments')[0]);
            }
          });
        }
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
    transformFunction(ctx, path.get('init') as babel.NodePath<Argument>, false);
  }
}

export default function forgettiPlugin(): babel.PluginObj<State> {
  return {
    name: 'forgetti',
    visitor: {
      Program(programPath, { opts }) {
        const ctx: StateContext = {
          hooks: new Map(),
          registrations: {
            hooks: new Map(),
            hocs: new Map(),
            hooksNamespaces: new Map(),
            hocsNamespaces: new Map(),
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
