import * as babel from '@babel/core';
import * as t from '@babel/types';
import {
  isComponent,
  isComponentNameValid,
  getImportSpecifierName,
} from './core/checks';
import Optimizer from './core/optimizer';
import {
  PRESETS,
  Options,
  HookRegistration,
  ImportRegistration,
} from './core/presets';
import { StateContext, State } from './core/types';
import unwrapNode from './core/unwrap-node';
import unwrapPath from './core/unwrap-path';

export { Options };

function registerHookSpecifiers(
  ctx: StateContext,
  path: babel.NodePath<t.ImportDeclaration>,
  hook: HookRegistration,
) {
  let specifier: typeof path.node.specifiers[0];
  for (let i = 0, len = path.node.specifiers.length; i < len; i++) {
    specifier = path.node.specifiers[i];
    if (t.isImportSpecifier(specifier)) {
      if (
        hook.kind === 'named'
        && getImportSpecifierName(specifier) === hook.name
      ) {
        ctx.registrations.hooks.set(specifier.local, hook);
      }
      if (
        hook.kind === 'default'
        && getImportSpecifierName(specifier) === 'default'
      ) {
        ctx.registrations.hooks.set(specifier.local, hook);
      }
    } else if (t.isImportDefaultSpecifier(specifier)) {
      if (hook.kind === 'default' && specifier.local.name === hook.name) {
        ctx.registrations.hooks.set(specifier.local, hook);
      }
    } else if (t.isImportNamespaceSpecifier(specifier)) {
      let current = ctx.registrations.hooksNamespaces.get(specifier.local);
      if (!current) {
        current = [];
      }
      current.push(hook);
      ctx.registrations.hooksNamespaces.set(specifier.local, current);
    }
  }
}

function registerHOCSpecifiers(
  ctx: StateContext,
  path: babel.NodePath<t.ImportDeclaration>,
  hoc: ImportRegistration,
) {
  let specifier: typeof path.node.specifiers[0];
  for (let i = 0, len = path.node.specifiers.length; i < len; i++) {
    specifier = path.node.specifiers[i];
    if (t.isImportSpecifier(specifier)) {
      if (
        hoc.kind === 'named'
        && getImportSpecifierName(specifier) === hoc.name
      ) {
        ctx.registrations.hocs.set(specifier.local, hoc);
      }
      // For `import { default as x }`
      if (
        hoc.kind === 'default'
        && getImportSpecifierName(specifier) === 'default'
      ) {
        ctx.registrations.hocs.set(specifier.local, hoc);
      }
    } else if (t.isImportDefaultSpecifier(specifier)) {
      if (hoc.kind === 'default' && specifier.local.name === hoc.name) {
        ctx.registrations.hocs.set(specifier.local, hoc);
      }
    } else if (t.isImportNamespaceSpecifier(specifier)) {
      let current = ctx.registrations.hocsNamespaces.get(specifier.local);
      if (!current) {
        current = [];
      }
      current.push(hoc);
      ctx.registrations.hocsNamespaces.set(specifier.local, current);
    }
  }
}

function extractImportIdentifiers(
  ctx: StateContext,
  path: babel.NodePath<t.ImportDeclaration>,
) {
  const mod = path.node.source.value;

  // Identify hooks
  let hook: HookRegistration;
  for (let i = 0, len = ctx.preset.hooks.length; i < len; i++) {
    hook = ctx.preset.hooks[i];
    if (mod === hook.source) {
      registerHookSpecifiers(ctx, path, hook);
    }
  }
  // Identify hocs
  let hoc: ImportRegistration;
  for (let i = 0, len = ctx.preset.hocs.length; i < len; i++) {
    hoc = ctx.preset.hocs[i];
    if (mod === hoc.source) {
      registerHOCSpecifiers(ctx, path, hoc);
    }
  }
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
          let registration: typeof registrations[0];
          for (let i = 0, len = registrations.length; i < len; i++) {
            registration = registrations[i];
            if (registration && registration.name === propName) {
              transformFunction(ctx, path.get('arguments')[0]);
            }
          }
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
  if (
    ctx.filters.component.test(path.node.id.name)
    || (ctx.filters.hook && ctx.filters.hook.test(path.node.id.name))
  ) {
    transformFunction(ctx, path.get('init') as babel.NodePath<Argument>, false);
  }
}

export default function forgettiPlugin(): babel.PluginObj<State> {
  return {
    name: 'forgetti',
    visitor: {
      Program(programPath, { opts }) {
        const preset = typeof opts.preset === 'string' ? PRESETS[opts.preset] : opts.preset;
        const ctx: StateContext = {
          hooks: new Map(),
          registrations: {
            hooks: new Map(),
            hocs: new Map(),
            hooksNamespaces: new Map(),
            hocsNamespaces: new Map(),
          },
          preset,
          filters: {
            component: new RegExp(preset.componentFilter.source, preset.componentFilter.flags),
            hook: preset.hookFilter
              ? new RegExp(preset.hookFilter.source, preset.hookFilter.flags)
              : undefined,
          },
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
