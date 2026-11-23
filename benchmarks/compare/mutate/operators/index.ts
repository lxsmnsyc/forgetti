import type { Operator } from '../types.ts';
import { aliasPropCall } from './alias-prop-call.ts';
import { callbackMutate } from './callback-mutate.ts';
import { childImpure } from './child-impure.ts';
import { closureChild } from './closure-child.ts';
import { dateArg } from './date-arg.ts';
import { defaultParam } from './default-param.ts';
import { freshLiteral } from './fresh-literal.ts';
import { globalRead } from './global-read.ts';
import { identityWrite } from './identity-write.ts';
import { mapMethod } from './map-method.ts';
import { resultMutate } from './result-mutate.ts';

/** Every operator, in report order. A new operator adds one entry here. */
export const OPERATORS: Operator[] = [
  aliasPropCall,
  globalRead,
  closureChild,
  mapMethod,
  childImpure,
  callbackMutate,
  resultMutate,
  identityWrite,
  freshLiteral,
  dateArg,
  defaultParam,
];
