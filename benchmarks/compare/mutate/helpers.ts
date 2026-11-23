// Code snippets that operators insert. Every name starts with `__mut` or `Mutant`, and
// `generate.ts` drops a file whose own code already uses such a name.

/**
 * A key unique to each loaded module. The harness loads one module per compiler and
 * target, so marks on shared scenario objects never leak from one cell into another.
 */
export const KEY_HELPER = "const __mutKey = Symbol('mutant');";

/** A same-module function that changes the object it is given. */
export const ALIAS_HELPER = `function __mutAlias(value) {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    value[__mutKey] = (value[__mutKey] | 0) + 1;
  }
}`;

/** A changing global the runner installs: each read returns the next number. */
export const GLOBAL_READ = 'globalThis.__mutG';

/** Statement that counts one change on `expr`, an object or nothing. */
export function writeMark(expr: string): string {
  return `if (${expr} !== null && typeof ${expr} === 'object') { ${expr}[__mutKey] = (${expr}[__mutKey] | 0) + 1; }`;
}

/**
 * Expression that reads the change count of `expr`. It is empty when `expr` is not an
 * object, so a mutant on a string prop renders nothing new and counts as inert.
 */
export function readMark(expr: string): string {
  return `(${expr} !== null && (typeof ${expr} === 'object' || typeof ${expr} === 'function') ? ${expr}[__mutKey] | 0 : '')`;
}
