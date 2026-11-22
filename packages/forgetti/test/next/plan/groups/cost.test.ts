import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import type { AstNode } from '../../../../src/next/emit/ast';
import { getChild } from '../../../../src/next/emit/ast';
import { isCheap } from '../../../../src/next/plan/cost';

function check(expression: string): boolean {
  const { program } = parseSync('a.jsx', `x = ${expression};`);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const statement = program.body[0] as unknown as AstNode;
  const assignment = getChild(statement, 'expression');
  const value = assignment && getChild(assignment, 'right');
  if (!value) {
    throw new Error('no expression');
  }
  return isCheap(value);
}

describe('isCheap', () => {
  it.each([
    '1',
    '"s"',
    'a',
    'a + 1',
    'a * b - 2',
    '!a',
    'a.b.c',
    'a["k"]',
    '`${a}-${b.c}`',
    'a ? b : 1',
    'a && b',
  ])('accepts %s', (source) => {
    expect(check(source)).toBe(true);
  });

  it.each([
    'f(a)',
    'a.f()',
    'new F(a)',
    '<p />',
    '{ a }',
    '[a]',
    '() => a',
    'a + f()',
    '`${f(a)}`',
    'a[f()]',
    'a in b',
  ])('rejects %s', (source) => {
    expect(check(source)).toBe(false);
  });
});
