/** Methods that read their receiver and never change it. Any other method is a mutation. */
export const READ_METHODS = new Set([
  'at',
  'concat',
  'entries',
  'every',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flat',
  'flatMap',
  'forEach',
  'get',
  'has',
  'includes',
  'indexOf',
  'join',
  'keys',
  'lastIndexOf',
  'map',
  'reduce',
  'reduceRight',
  'slice',
  'some',
  'toLocaleString',
  'toReversed',
  'toSorted',
  'toSpliced',
  'toString',
  'values',
  'with',
]);

/** Built-in methods that change their receiver. On a non-fresh local they make it opaque. */
export const MUTATING_METHODS = new Set([
  'add',
  'clear',
  'copyWithin',
  'delete',
  'fill',
  'pop',
  'push',
  'reverse',
  'set',
  'shift',
  'sort',
  'splice',
  'unshift',
]);

/** Methods that call their callback arguments before they return, and never keep them. */
export const CALLBACK_METHODS = new Set([
  'every',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flatMap',
  'forEach',
  'map',
  'reduce',
  'reduceRight',
  'some',
  'sort',
  'toSorted',
]);

/** Read methods whose result is a primitive, so it never aliases the receiver. */
export const PRIMITIVE_METHODS = new Set([
  'every',
  'findIndex',
  'findLastIndex',
  'has',
  'includes',
  'indexOf',
  'join',
  'lastIndexOf',
  'some',
  'toLocaleString',
  'toString',
]);

/** Properties whose value is a primitive, so reading them never aliases the object. */
export const PRIMITIVE_PROPERTIES = new Set(['length', 'size']);

/** Global functions that only read their arguments and return a primitive. */
export const PURE_FUNCTIONS = new Set([
  'Boolean',
  'Number',
  'String',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
]);

/** Global objects with methods that only read their arguments. `null` allows every method. */
export const PURE_MEMBERS = new Map<string, Set<string> | null>([
  ['Math', null],
  ['Number', null],
  ['JSON', new Set(['stringify'])],
  ['Array', new Set(['isArray'])],
  ['Object', new Set(['is', 'keys', 'hasOwn'])],
  ['console', null],
]);

/** Global constructors that never change their arguments. */
export const KNOWN_CONSTRUCTORS = new Set([
  'Array',
  'Date',
  'Error',
  'Map',
  'RegExp',
  'Set',
  'URL',
  'URLSearchParams',
  'WeakMap',
  'WeakSet',
]);
