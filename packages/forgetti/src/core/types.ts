import * as t from '@babel/types';
import {
  HookRegistration,
  ImportRegistration,
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
  hooks: Map<string, t.Identifier>;
  registrations: {
    hooks: Map<t.Identifier, HookRegistration>;
    hocs: Map<t.Identifier, ImportRegistration>;
    hooksNamespaces: Map<t.Identifier, HookRegistration[]>;
    hocsNamespaces: Map<t.Identifier, ImportRegistration[]>;
  };
  preset: Preset;
  filters: {
    component: RegExp;
    hook?: RegExp;
  }
}

export interface OptimizedExpression {
  expr: t.Expression;
  deps?: t.Expression | t.Expression[];
  constant?: boolean,
}
