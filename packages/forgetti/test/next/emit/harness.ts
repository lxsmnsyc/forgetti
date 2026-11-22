// The package's tsconfig has no DOM types. These tests render into happy-dom.
/// <reference lib="dom" />
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import type { ComponentType, ReactNode } from 'react';
import { Component, act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import { emit } from '../../../src/next/emit';
import type { CachePlan } from '../../../src/next/ir';

// React warns about `act()` unless the environment says it is a test.
Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../../..');

/**
 * Emitted modules are written here, so Vite transforms their JSX and resolves `react`.
 * Each test file gets its own folder, because test files run at the same time.
 */
const OUT_DIR = path.join(HERE, '.out', `${process.pid}-${Math.random().toString(36).slice(2)}`);
export const RUNTIME = path.resolve(HERE, '../../../runtime/next.ts');
export const PROOF_T2 = path.join(REPO, 'docs/roadmaps/compiler-rewrite/debate/evidence/proof-t2');

/** Writes the counted helpers and proof T2's runtime next to the emitted modules. */
export function prepareOutDir(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  copyFileSync(
    path.join(REPO, 'benchmarks/corpus/shared/counter.js'),
    path.join(OUT_DIR, 'counter.js'),
  );
  copyFileSync(path.join(PROOF_T2, 'rt.js'), path.join(OUT_DIR, 'rt.js'));
}

export function removeOutDir(): void {
  rmSync(OUT_DIR, { recursive: true, force: true });
  // The shared parent goes once the last test file has removed its own folder.
  if (readdirSync(path.dirname(OUT_DIR)).length === 0) {
    rmSync(path.dirname(OUT_DIR), { recursive: true, force: true });
  }
}

/** Emits `plan` for `source`. Binding ids are the positions of `names`. */
export function emitPlan(source: string, plan: CachePlan, names: string[]): string {
  const bindings: { id: number; name: string }[] = [];
  for (const [id, name] of names.entries()) {
    bindings.push({ id, name });
  }
  return emit(
    { code: source, program: parseSync('input.jsx', source).program, bindings, plans: [plan] },
    { useRef: { kind: 'named', name: 'useRef', source: 'react' }, runtime: RUNTIME },
  ).code;
}

let loaded = 0;

/** Writes `code` as a `.jsx` module and imports it. Each call gets a new file. */
export async function loadModule(code: string): Promise<Record<string, unknown>> {
  loaded++;
  const file = path.join(OUT_DIR, `module-${loaded}.jsx`);
  writeFileSync(file, code);
  const module: unknown = await import(/* @vite-ignore */ file);
  if (typeof module !== 'object' || module === null) {
    throw new Error(`${file} did not load as a module`);
  }
  return { ...module };
}

interface Counter {
  C: Record<string, number>;
  reset(): void;
}

async function loadCounter(): Promise<Counter> {
  const module: unknown = await import(/* @vite-ignore */ path.join(OUT_DIR, 'counter.js'));
  if (
    typeof module !== 'object' ||
    module === null ||
    !('C' in module) ||
    !('reset' in module) ||
    typeof module.reset !== 'function'
  ) {
    throw new Error('counter.js did not load');
  }
  // `counter.js` exports `C` as a record of counts.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return module as Counter;
}

export type Props = Record<string, unknown>;

export interface StepResult {
  html: string;
  counts: Record<string, number>;
}

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  override state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: string } {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  override render(): ReactNode {
    return this.state.error === null ? this.props.children : `error: ${this.state.error}`;
  }
}

function getComponent(module: Record<string, unknown>, name: string): ComponentType<Props> {
  const value = module[name];
  if (typeof value !== 'function') {
    throw new Error(`Module has no component ${name}`);
  }
  // An exported function of a test module is a component by construction.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as ComponentType<Props>;
}

/**
 * Mounts `name` with the first props, then renders each next props on the same root, under
 * an error boundary. Returns the HTML and the counters of every render, the mount included.
 */
export async function runSteps(
  module: Record<string, unknown>,
  name: string,
  steps: Props[],
): Promise<StepResult[]> {
  const counter = await loadCounter();
  const component = getComponent(module, name);
  const container = document.createElement('div');
  const root = createRoot(container);
  const results: StepResult[] = [];

  // React reports a caught render error on the console. The HTML holds the message.
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    for (const props of steps) {
      counter.reset();
      // Each step renders after the one before.
      // oxlint-disable-next-line no-await-in-loop
      await act(async () => {
        root.render(createElement(Boundary, null, createElement(component, props)));
        // The async form of `act()` flushes the render and its retries before it returns.
        await Promise.resolve();
      });
      results.push({ html: container.innerHTML, counts: { ...counter.C } });
    }
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
  } finally {
    consoleError.mockRestore();
  }
  return results;
}
