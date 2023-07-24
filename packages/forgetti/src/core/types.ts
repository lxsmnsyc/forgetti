import type * as t from '@babel/types';
import type * as babel from '@babel/core';
import type { Scope } from '@babel/traverse';
import type {
  HookRegistration,
  ImportDefinition,
  Options,
  Preset,
} from './presets';

export type ComponentNode =
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.FunctionDeclaration;

export interface State extends babel.PluginPass {
  opts: Options;
}

export interface StateContext {
  preset: Preset;
  imports: Map<string, t.Identifier>;
  registrations: {
    hooks: {
      identifiers: Map<t.Identifier, HookRegistration>;
      namespaces: Map<t.Identifier, HookRegistration[]>;
    };
    hocs: {
      identifiers: Map<t.Identifier, ImportDefinition>;
      namespaces: Map<t.Identifier, ImportDefinition[]>;
    };
  };
  filters: {
    component: RegExp;
    hook?: RegExp;
  };
  hoist: {
    jsxScopeMap: WeakMap<t.JSX, Scope>;
    hoisted: WeakSet<t.JSX>;
  };
}

export interface OptimizedExpression {
  expr: t.Expression;
  deps?: t.Expression | t.Expression[];
  constant?: boolean;
}
