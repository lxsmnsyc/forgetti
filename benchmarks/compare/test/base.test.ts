import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { collect } from '../src/collect.ts';
import { findDifferences, getCell, getStepKey, MOUNT } from '../src/metrics.ts';
import type { CaseResult } from '../src/types.ts';

function readBaseline<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(new URL(`../baseline/${name}.json`, import.meta.url), 'utf8'),
  ) as T;
}

let results: CaseResult[] = [];

beforeAll(async () => {
  results = await collect({ sets: ['base'] });
});

describe('uncompiled output on base', () => {
  it('loads and runs every case on both targets without errors', () => {
    expect(results).toHaveLength(15);
    for (const result of results) {
      for (const target of ['react', 'preact'] as const) {
        const cell = getCell(result, 'plain', target);
        expect(cell?.failure, `${result.name} on ${target}`).toBeUndefined();
        expect(cell?.steps.length).toBeGreaterThan(0);
        for (const step of cell?.steps ?? []) {
          expect(step.error, `${result.name} ${getStepKey(step)} on ${target}`).toBeUndefined();
        }
      }
    }
  });

  it('has 0 differences between React and Preact', () => {
    for (const result of results) {
      const react = getCell(result, 'plain', 'react');
      const preact = getCell(result, 'plain', 'preact');
      if (react === undefined || preact === undefined) {
        throw new Error(`${result.name}: missing uncompiled cell`);
      }
      expect(findDifferences(preact, react), result.name).toEqual([]);
    }
  });
});

describe('baseline numbers on base', () => {
  const compile =
    readBaseline<Record<string, { raw: number; gz: number; slots: number; bailed: boolean }>>(
      'compile',
    );
  const runtime = readBaseline<Record<string, Record<string, Record<string, number>>>>('runtime');

  it('matches the recorded bytes, slots and bailouts', () => {
    for (const [key, expected] of Object.entries(compile)) {
      const [compiler, name] = key.split('/');
      const result = results.find((candidate) => candidate.name === name);
      const cell = result && getCell(result, compiler as 'react-compiler', 'react');
      expect(cell, key).toBeDefined();
      expect(
        { raw: cell?.compile.raw, gz: cell?.compile.gz, slots: cell?.compile.slots },
        key,
      ).toEqual({
        raw: expected.raw,
        gz: expected.gz,
        slots: expected.slots,
      });
      if (compiler === 'react-compiler') {
        expect(cell?.compile.compiled === 0, key).toBe(expected.bailed);
      }
    }
  });

  it('matches the recorded renders and recomputes on React', () => {
    for (const compiler of ['plain', 'forgetti-0.8', 'react-compiler'] as const) {
      for (const [key, expected] of Object.entries(runtime[compiler] ?? {})) {
        const [name, scenario] = key.split('/');
        const result = results.find((candidate) => candidate.name === name);
        const cell = result && getCell(result, compiler, 'react');
        const step = cell?.steps.find(
          (candidate) => candidate.scenario === scenario && candidate.step !== MOUNT,
        );
        expect(step?.counts, `${compiler} ${key}`).toEqual(expected);
      }
    }
  });

  it('finds the three files where forgetti 0.8 differs from uncompiled output', () => {
    const files: string[] = [];
    for (const result of results) {
      const cell = getCell(result, 'forgetti-0.8', 'react');
      const plain = getCell(result, 'plain', 'react');
      if (cell && plain && findDifferences(cell, plain).length > 0) {
        files.push(result.name);
      }
    }
    expect(files).toEqual(['bailout', 'forloop', 'usectx']);
  });

  it('finds 0 differences for React Compiler and compiles 14 of 15 files', () => {
    let compiledFiles = 0;
    for (const result of results) {
      const cell = getCell(result, 'react-compiler', 'react');
      const plain = getCell(result, 'plain', 'react');
      if (cell === undefined || plain === undefined) {
        throw new Error(`${result.name}: missing cell`);
      }
      expect(findDifferences(cell, plain), result.name).toEqual([]);
      compiledFiles += cell.compile.compiled > 0 ? 1 : 0;
    }
    expect(compiledFiles).toBe(14);
  });
});
