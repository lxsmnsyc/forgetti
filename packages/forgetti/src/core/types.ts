import type * as t from '@babel/types';
import type * as babel from '@babel/core';
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
}

export interface OptimizedExpression {
  expr: t.Expression;
  deps?: t.Expression | t.Expression[];
  constant?: boolean;
}
