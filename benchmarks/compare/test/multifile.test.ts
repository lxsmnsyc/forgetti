import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { collect } from '../src/collect.ts';
import { compileCase } from '../src/compilers.ts';
import { readCase, readSiblings } from '../src/corpus.ts';
import { OUT_DIR } from '../src/loader.ts';
import { findDifferences, getCell, sumWork } from '../src/metrics.ts';
import type { CaseResult, Cell, Compiler, Target } from '../src/types.ts';

const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/multifile/pair');
const testCase = readCase('fixture', 'pair', FIXTURE);
const COMPILED: Compiler[] = ['forgetti-0.8', 'react-compiler', 'next'];
const TARGETS: Target[] = ['react', 'preact'];

let results: CaseResult[] = [];

beforeAll(async () => {
  results = await collect({ sets: [], extraCases: [testCase] });
});

function getResult(): CaseResult {
  const result = results[0];
  if (result === undefined) {
    throw new Error('The fixture did not run');
  }
  return result;
}

function readOutput(compiler: Compiler, target: Target, file: string): string {
  return fs.readFileSync(path.join(OUT_DIR, compiler, target, 'fixture', 'pair', file), 'utf8');
}

function getFileNames(modules: { file: string }[]): string[] {
  const names: string[] = [];
  for (const module of modules) {
    names.push(module.file);
  }
  return names;
}

function makeFolder(name: string, files: string[]): string {
  const dir = path.join(OUT_DIR, 'collision', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const file of files) {
    fs.writeFileSync(path.join(dir, file), '');
  }
  return dir;
}

describe('sibling modules', () => {
  it('reads the siblings next to the input and skips the reserved files', () => {
    expect(getFileNames(testCase.siblings)).toEqual(['math.js', 'panel.jsx']);
  });

  it('rejects two siblings that compile to the same file', () => {
    const dir = makeFolder('same', ['a.js', 'a.jsx']);
    expect(() => readSiblings(dir)).toThrow('two modules compile to a.js');
  });

  it('rejects a sibling that would overwrite the input or the counter', () => {
    const input = makeFolder('input', ['input.jsx', 'input.ts']);
    expect(() => readSiblings(input)).toThrow('two modules compile to input.js');
    const counter = makeFolder('counter', ['counter.jsx']);
    expect(() => readSiblings(counter)).toThrow('two modules compile to counter.js');
  });

  it('loads every cell and matches the uncompiled output on both targets', () => {
    const result = getResult();
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

  it('compiles the sibling with the same compiler as the input', () => {
    const patterns: Record<string, RegExp> = {
      'forgetti-0.8': /\$\$cache\(/,
      'react-compiler': /\b_c\(\d+\)/,
      next: /useCache\(/,
    };
    for (const target of TARGETS) {
      const plainPanel = readOutput('plain', target, 'panel.js');
      expect(plainPanel).not.toMatch(/\$\$cache\(|\b_c\(|useCache\(/);
      for (const compiler of COMPILED) {
        if (compiler === 'react-compiler' && target === 'preact') {
          continue;
        }
        const pattern = patterns[compiler] as RegExp;
        expect(readOutput(compiler, target, 'input.js'), `${compiler} input`).toMatch(pattern);
        expect(readOutput(compiler, target, 'panel.js'), `${compiler} panel`).toMatch(pattern);
      }
    }
  });

  it('shares one counter between the input and its siblings', () => {
    const result = getResult();
    const plain = getCell(result, 'plain', 'react');
    let counts: Record<string, number> | undefined;
    for (const step of plain?.steps ?? []) {
      if (step.step === '(mount)') {
        counts = step.counts;
        break;
      }
    }
    // `math.js` and `panel.jsx` both count into the counter the input uses.
    expect(counts).toEqual({ double: 1, Child: 1 });
  });
});

describe('compile numbers over several files', () => {
  it('counts the bytes and the gzip of every compiled file', () => {
    const result = getResult();
    for (const compiler of COMPILED) {
      const info = getCell(result, compiler, 'react')?.compile;
      if (info === undefined) {
        throw new Error(`${compiler}: missing cell`);
      }
      expect(getFileNames(info.siblings), compiler).toEqual(['math.js', 'panel.jsx']);

      // Raw is the sum of the files, gzip is one stream over input then siblings.
      const codes = [info.code];
      for (const sibling of info.siblings) {
        codes.push(sibling.code);
      }
      let bytes = 0;
      for (const code of codes) {
        bytes += Buffer.byteLength(code);
      }
      expect(info.raw, `${compiler} raw`).toBe(bytes);
      expect(info.gz, `${compiler} gz`).toBe(zlib.gzipSync(codes.join('\n')).length);
      expect(info.gz, `${compiler} gz above the input alone`).toBeGreaterThan(
        zlib.gzipSync(info.code).length,
      );
    }
  });

  it('counts the components of every file', () => {
    const result = getResult();
    for (const compiler of COMPILED) {
      const info = getCell(result, compiler, 'react')?.compile;
      // `Page` and `Panel` are components. `double` is not.
      expect(info?.compiled, `${compiler} compiled`).toBe(2);
    }
  });

  it('sums over the files for the babel compilers', () => {
    const alone = { ...testCase, siblings: [] };
    for (const compiler of ['forgetti-0.8', 'react-compiler'] as const) {
      const whole = compileCase(compiler, testCase, 'react', null);
      const input = compileCase(compiler, alone, 'react', null);
      expect(whole.compiled, compiler).toBe(input.compiled + 1);
      expect(whole.slots, compiler).toBeGreaterThan(input.slots);
      expect(whole.raw, compiler).toBeGreaterThan(input.raw);
    }
  });
});

describe('sumWork', () => {
  it('throws when the uncompiled cell failed to load', () => {
    const failed: Cell = {
      compile: {
        code: '',
        siblings: [],
        raw: 0,
        gz: 0,
        slots: 0,
        ms: 0,
        units: 0,
        compiled: 0,
        bailouts: [],
      },
      steps: [],
      failure: 'compile: boom',
    };
    expect(() => sumWork(failed, failed)).toThrow('failed to load');
  });
});
