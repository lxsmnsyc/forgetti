import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { collect } from '../src/collect.ts';
import { compileCase, compileSource } from '../src/compilers.ts';
import { readCase } from '../src/corpus.ts';
import { findDifferences, getCell } from '../src/metrics.ts';
import type { CaseResult, Cell, Compiler, Target } from '../src/types.ts';

const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/multifile/typed');
const testCase = readCase('fixture', 'typed', FIXTURE);
const COMPILED: Compiler[] = ['forgetti-0.8', 'react-compiler', 'next'];
const TARGETS: Target[] = ['react', 'preact'];

let results: CaseResult[] = [];

beforeAll(async () => {
  results = await collect({ sets: [], extraCases: [testCase] });
});

describe('React Compiler under Babel 7', () => {
  it('compiles a default in object destructuring', () => {
    const source = 'export function A({ a = 1, b }) { return <p>{a}{b}</p>; }\n';
    const info = compileSource('react-compiler', source, 'input.jsx', 'react', null);
    expect(info.bailouts).toEqual([]);
    expect(info.compiled).toBe(1);
    expect(info.code).toMatch(/\b_c\(\d+\)/);
  });

  it('keeps the other compilers on the same source', () => {
    const source = 'export function A({ a = 1, b }) { return <p>{a}{b}</p>; }\n';
    const info = compileSource('forgetti-0.8', source, 'input.jsx', 'react', null);
    expect(info.compiled).toBe(1);
  });
});

describe('typed siblings', () => {
  it('reads a .tsx and a .ts sibling', () => {
    const files: string[] = [];
    for (const sibling of testCase.siblings) {
      files.push(sibling.file);
    }
    expect(files).toEqual(['chip.tsx', 'scale.ts']);
  });

  it('compiles the typed siblings with React Compiler', () => {
    const info = compileCase('react-compiler', testCase, 'react', null);
    expect(info.bailouts).toEqual([]);
    expect(info.compiled).toBe(2);
  });

  it('loads every cell and matches the uncompiled output', () => {
    const result = results[0];
    if (result === undefined) {
      throw new Error('The fixture did not run');
    }
    for (const target of TARGETS) {
      const plain = getCell(result, 'plain', target);
      expect(plain?.failure, `plain on ${target}`).toBeUndefined();
      expect(plain?.steps.length).toBeGreaterThan(0);
      for (const compiler of COMPILED) {
        const cell = getCell(result, compiler, target);
        if (cell === undefined) {
          expect(compiler === 'react-compiler' && target === 'preact').toBe(true);
          continue;
        }
        expect(cell.failure, `${compiler} on ${target}`).toBeUndefined();
        expect(findDifferences(cell, plain as Cell), `${compiler} on ${target}`).toEqual([]);
      }
    }
  });
});
