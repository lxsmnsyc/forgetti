import { performance } from 'node:perf_hooks';
import zlib from 'node:zlib';
import * as babel from '@babel/core';
import reactCompiler from 'babel-plugin-react-compiler';
import forgetti from 'forgetti-0.8';
import type { CompileInfo, Compiler, Target } from './types.ts';

export type NextCompile = (
  code: string,
  options: { preset: 'react' | 'preact'; filename: string },
) => {
  code: string;
  diagnostics: { unit: string; reason: string }[];
  units: { name: string; compiled: boolean }[];
};

const IMPORT_FROM_REACT = /import\s*\{([^}]*)\}\s*from\s*(['"])react\2;?/g;

// Names that `preact/compat` exports and `preact/hooks` or `preact` do not.
const PREACT_COMPAT = new Set([
  'use',
  'memo',
  'forwardRef',
  'startTransition',
  'useTransition',
  'useDeferredValue',
  'useSyncExternalStore',
  'useInsertionEffect',
  'Suspense',
  'lazy',
  'PureComponent',
]);

function getPreactSource(name: string): string {
  if (PREACT_COMPAT.has(name)) {
    return 'preact/compat';
  }
  if (/^use[A-Z]/.test(name)) {
    return 'preact/hooks';
  }
  return 'preact';
}

/** Inputs import the counter from the shared folder. Compiled output imports it from its own folder. */
export function relinkCounter(source: string): string {
  return source.replace(/(['"])(?:\.\.\/)+shared\/counter\.js\1/g, "'./counter.js'");
}

/**
 * Rewrites the imports from `react` so the same source runs on Preact. Hooks come from
 * `preact/hooks`, and only the names without a Preact core equivalent come from `preact/compat`.
 */
export function retarget(source: string, target: Target): string {
  if (target === 'react') {
    return source;
  }
  return source.replace(IMPORT_FROM_REACT, (_match, specifiers: string) => {
    const bySource = new Map<string, string[]>();
    for (const specifier of specifiers.split(',')) {
      const text = specifier.trim();
      if (text === '') {
        continue;
      }
      const name = text.split(/\s+as\s+/)[0] ?? text;
      const from = getPreactSource(name);
      const list = bySource.get(from) ?? [];
      list.push(text);
      bySource.set(from, list);
    }
    const lines: string[] = [];
    for (const [from, list] of bySource) {
      lines.push(`import { ${list.join(', ')} } from '${from}';`);
    }
    return lines.join('\n');
  });
}

interface CompileOutput {
  code: string;
  units: number;
  compiled: number;
  bailouts: string[];
}

function sumSlots(code: string, pattern: RegExp): number {
  let total = 0;
  for (const match of code.matchAll(pattern)) {
    total += Number(match[1] ?? match[2]);
  }
  return total;
}

const SLOT_PATTERNS: Record<Compiler, RegExp | null> = {
  plain: null,
  'react-compiler': /\b_c\((\d+)\)/g,
  'forgetti-0.8': /\$\$cache\([\w$]+, (\d+)\)|\$\$branch\([\w$]+, [\w$]+, (\d+)\)/g,
  next: /useCache\([\w$]+, (\d+)\)|branch\([\w$]+, [^,()]+, (\d+)\)/g,
};

function runBabel(code: string, filename: string, plugin: babel.PluginItem | null): string {
  const isTs = filename.endsWith('.tsx');
  const result = babel.transformSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: plugin ? [plugin] : [],
    parserOpts: { plugins: isTs ? ['jsx', 'typescript'] : ['jsx'] },
    retainLines: false,
  });
  if (result?.code == null) {
    throw new Error(`Babel produced no code for ${filename}`);
  }
  return result.code;
}

function compileOnce(
  compiler: Compiler,
  code: string,
  filename: string,
  target: Target,
  events: { kind: string }[],
  compileNext: NextCompile | null,
): CompileOutput {
  if (compiler === 'plain') {
    return { code, units: 0, compiled: 0, bailouts: [] };
  }

  if (compiler === 'next') {
    if (compileNext === null) {
      throw new Error('The new compiler is not loaded');
    }
    const result = compileNext(code, { preset: target, filename });
    const bailouts: string[] = [];
    for (const diagnostic of result.diagnostics) {
      bailouts.push(`${diagnostic.unit}: ${diagnostic.reason}`);
    }
    let compiled = 0;
    for (const unit of result.units) {
      if (unit.compiled) {
        compiled += 1;
      }
    }
    return { code: result.code, units: result.units.length, compiled, bailouts };
  }

  if (compiler === 'forgetti-0.8') {
    // 0.8 has no bailout: it compiles every component its filter matches.
    const out = runBabel(code, filename, [forgetti, { preset: target }]);
    const count = [...out.matchAll(/\$\$cache\(/g)].length;
    return { code: out, units: count, compiled: count, bailouts: [] };
  }

  // React Compiler runs through a logger that reports one event per function.
  events.length = 0;
  const logger = {
    logEvent(_file: string | null, event: { kind: string }) {
      events.push(event);
    },
  };
  const out = runBabel(code, filename, [
    reactCompiler,
    { logger, panicThreshold: 'none', compilationMode: 'infer' },
  ]);
  let compiled = 0;
  const bailouts: string[] = [];
  for (const event of events) {
    if (event.kind === 'CompileSuccess') {
      compiled += 1;
    } else if (event.kind === 'CompileError' || event.kind === 'PipelineError') {
      bailouts.push(event.kind);
    }
  }
  return { code: out, units: compiled + bailouts.length, compiled, bailouts };
}

/**
 * Compiles a source with one compiler. Times 20 more runs and keeps the median,
 * as the debate's `compile.mjs` did.
 */
export function compileSource(
  compiler: Compiler,
  source: string,
  filename: string,
  target: Target,
  compileNext: NextCompile | null,
): CompileInfo {
  const events: { kind: string }[] = [];
  const first = compileOnce(compiler, source, filename, target, events, compileNext);

  // Timing runs, sorted so the median is the 11th value.
  const times: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    compileOnce(compiler, source, filename, target, [], compileNext);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);

  const pattern = SLOT_PATTERNS[compiler];
  return {
    code: first.code,
    raw: Buffer.byteLength(first.code),
    gz: zlib.gzipSync(first.code).length,
    slots: pattern ? sumSlots(first.code, pattern) : 0,
    ms: Number((times[10] ?? 0).toFixed(2)),
    units: first.units,
    compiled: first.compiled,
    bailouts: first.bailouts,
  };
}

/** Turns JSX and types in compiled output into plain `.js` for the target's JSX runtime. */
export function lowerJsx(code: string, filename: string, target: Target): string {
  const presets: babel.PresetItem[] = [
    [
      '@babel/preset-react',
      { runtime: 'automatic', importSource: target === 'preact' ? 'preact' : 'react' },
    ],
  ];
  if (filename.endsWith('.tsx')) {
    presets.push(['@babel/preset-typescript', { isTSX: true, allExtensions: true }]);
  }
  const result = babel.transformSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    presets,
  });
  if (result?.code == null) {
    throw new Error(`Babel produced no code for ${filename}`);
  }
  return result.code;
}
