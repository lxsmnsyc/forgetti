import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { lowerJsx, relinkSiblings, retarget } from './compilers.ts';
import { CORPUS_DIR, OUT_DIR, type Loader } from './loader.ts';
import {
  getOutputName,
  type ActContext,
  type CompileInfo,
  type Compiler,
  type CorpusCase,
  type Scenario,
  type Step,
  type StepResult,
  type Target,
} from './types.ts';

type Element = unknown;
type H = (...args: unknown[]) => Element;

interface Driver {
  h: H;
  render(element: Element, container: HTMLElement): Promise<void>;
  unmount(container: HTMLElement): Promise<void>;
  act(callback: () => unknown): Promise<void>;
  startTransition: (callback: () => void) => void;
}

let registered = false;

/** Registers happy-dom once. Both targets render into it. */
export function setupDom(): void {
  if (registered) {
    return;
  }
  registered = true;
  if (!('document' in globalThis)) {
    GlobalRegistrator.register();
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

async function createDriver(target: Target): Promise<Driver> {
  if (target === 'react') {
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const roots = new WeakMap<HTMLElement, ReturnType<typeof createRoot>>();
    const getRoot = (container: HTMLElement): ReturnType<typeof createRoot> => {
      let root = roots.get(container);
      if (!root) {
        root = createRoot(container);
        roots.set(container, root);
      }
      return root;
    };
    return {
      h: React.createElement as H,
      act: async (callback) => {
        await React.act(async () => {
          await callback();
        });
      },
      render: async (element, container) => {
        await React.act(() => {
          getRoot(container).render(element as never);
        });
      },
      unmount: async (container) => {
        await React.act(() => {
          getRoot(container).unmount();
        });
      },
      startTransition: React.startTransition,
    };
  }

  const preact = await import('preact');
  const { act } = await import('preact/test-utils');
  return {
    h: preact.createElement as H,
    act: async (callback) => {
      await act(async () => {
        await callback();
      });
    },
    render: async (element, container) => {
      await act(() => {
        preact.render(element as never, container);
      });
    },
    unmount: async (container) => {
      await act(() => {
        preact.render(null, container);
      });
    },
    // Preact has no transitions in core, so the callback runs at once.
    startTransition: (callback) => {
      callback();
    },
  };
}

const drivers = new Map<Target, Promise<Driver>>();

function getDriver(target: Target): Promise<Driver> {
  let driver = drivers.get(target);
  if (!driver) {
    driver = createDriver(target);
    drivers.set(target, driver);
  }
  return driver;
}

/**
 * Writes the runnable module of one case: the compiled code with JSX lowered, plus a
 * copy of the shared counter next to it. Returns the module path.
 */
export function writeModule(
  compiler: Compiler,
  target: Target,
  testCase: CorpusCase,
  compile: CompileInfo,
): string {
  const dir = path.join(OUT_DIR, compiler, target, testCase.set, testCase.name);
  fs.mkdirSync(dir, { recursive: true });

  // The shared counter is copied per variant so every variant has its own counters.
  const counter = fs.readFileSync(path.join(CORPUS_DIR, 'shared/counter.js'), 'utf8');
  fs.writeFileSync(
    path.join(dir, 'counter.js'),
    lowerJsx(retarget(counter, target), 'counter.js', target),
  );

  // Each sibling is written as `<name>.js` next to the input, from its own compiled code.
  for (const sibling of compile.siblings) {
    const name = getOutputName(sibling.file);
    fs.writeFileSync(
      path.join(dir, name),
      lowerJsx(prepareCode(compiler, sibling.code, testCase), sibling.file, target),
    );
  }

  const file = path.join(dir, 'input.js');
  fs.writeFileSync(
    file,
    lowerJsx(prepareCode(compiler, compile.code, testCase), testCase.inputFile, target),
  );
  return file;
}

function prepareCode(compiler: Compiler, compiled: string, testCase: CorpusCase): string {
  let code = relinkSiblings(compiled, testCase);
  if (compiler === 'forgetti-0.8') {
    code = code.replace(/(['"])forgetti\/runtime\1/g, "'forgetti-0.8/runtime'");
  }
  return code;
}

async function loadScenarios(testCase: CorpusCase): Promise<Scenario[]> {
  const url = pathToFileURL(path.join(testCase.dir, 'scenarios.js')).href;
  const mod = (await import(url)) as { default: Scenario[] };
  return mod.default;
}

function resolveProps(value: unknown): Record<string, unknown> {
  const props = typeof value === 'function' ? (value as () => unknown)() : value;
  return { ...(props as Record<string, unknown> | undefined) };
}

function readCounts(counter: { C: Record<string, number> }): Record<string, number> {
  return { ...counter.C };
}

/**
 * Runs every scenario of a case against one module. Each scenario mounts, resets the
 * counters, then runs its steps. The mount is reported as the step `(mount)`.
 */
export async function runScenarios(
  loader: Loader,
  target: Target,
  testCase: CorpusCase,
  file: string,
): Promise<StepResult[]> {
  setupDom();
  const driver = await getDriver(target);
  const mod = await loader.load(file);
  const counter = (await loader.load(path.join(path.dirname(file), 'counter.js'))) as unknown as {
    C: Record<string, number>;
    reset(): void;
  };
  const scenarios = await loadScenarios(testCase);
  const results: StepResult[] = [];

  for (const scenario of scenarios) {
    const Component = mod[scenario.component ?? scenario.name] as unknown;
    if (Component === undefined) {
      throw new Error(
        `${testCase.set}/${testCase.name}: no export "${scenario.component ?? scenario.name}"`,
      );
    }
    const container = document.createElement('div');
    const act: ActContext = { mod, startTransition: driver.startTransition };

    // Wraps the component in the scenario's context provider and `wrap`.
    const createElement = (props: Record<string, unknown>, contextValue: unknown): Element => {
      let element = driver.h(Component, props);
      if (scenario.context) {
        const Context = mod[scenario.context.name] as { Provider: unknown };
        element = driver.h(Context.Provider, { value: contextValue }, element);
      }
      if (scenario.wrap) {
        element = scenario.wrap(driver.h, element);
      }
      return element;
    };

    counter.reset();
    let current = resolveProps(scenario.props);
    let contextValue = scenario.context?.value;
    let step: Step = { name: '(mount)' };
    try {
      await driver.render(createElement(current, contextValue), container);
      results.push({
        scenario: scenario.name,
        step: '(mount)',
        counts: readCounts(counter),
        html: container.innerHTML,
      });

      for (const next of scenario.steps) {
        step = next;
        counter.reset();
        if (next.context !== undefined) {
          contextValue = next.context;
        }
        // A step with `props` renders them. A step with neither `props` nor `act` renders the same props again.
        if (next.props !== undefined) {
          current = resolveProps(next.props);
        }
        if (next.props !== undefined || next.act === undefined) {
          await driver.render(createElement(current, contextValue), container);
        }
        if (next.act !== undefined) {
          await driver.act(() => next.act?.(act));
        }
        results.push({
          scenario: scenario.name,
          step: next.name,
          counts: readCounts(counter),
          html: container.innerHTML,
        });
      }
    } catch (error) {
      results.push({
        scenario: scenario.name,
        step: step.name,
        counts: {},
        html: container.innerHTML,
        error: String(error).slice(0, 200),
      });
    }

    // Unmount so effects clean up before the next scenario.
    try {
      await driver.unmount(container);
    } catch {
      // A failed scenario can leave a root that cannot unmount.
    }
  }
  return results;
}
