declare module '@babel/helper-module-imports' {
  import { NodePath } from '@babel/traverse';
  import * as t from '@babel/types';

  interface ImportOptions {
    importedSource: string | null;
    importedType: 'es6' | 'commonjs';
    importedInterop: 'babel' | 'node' | 'compiled' | 'uncompiled';
    importingInterop: 'babel' | 'node';
    ensureLiveReference: boolean;
    ensureNoContext: boolean;
    importPosition: 'before' | 'after';
    nameHint: string;
    blockHoist: number;
  }

  export function addDefault(
    path: NodePath,
    importedSource: string,
    opts?: Partial<ImportOptions>
  ): t.Identifier;
  export function addNamed(
    path: NodePath,
    name: string,
    importedSource: string,
    opts?: Partial<ImportOptions>
  ): t.Identifier;
  export function addNamespace(
    path: NodePath,
    importedSource: string,
    opts?: Partial<ImportOptions>
  ): t.Identifier;
  export function addSideEffect(
    path: NodePath,
    importedSource: string,
    opts?: Partial<ImportOptions>
  ): t.Identifier;
}
