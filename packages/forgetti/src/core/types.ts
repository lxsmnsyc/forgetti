import * as t from '@babel/types';

export type ComponentNode =
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.FunctionDeclaration;

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
  opts: Options;
}
