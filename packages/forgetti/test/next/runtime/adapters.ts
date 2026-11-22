// The package's tsconfig has no DOM types. These tests render into happy-dom.
/// <reference lib="dom" />
import * as preactHooks from 'preact/hooks';
import * as preact from 'preact';
import * as preactCompat from 'preact/compat';
import * as react from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { Adapter, Gate } from './scenarios';

// Both renderers get a boundary with `getDerivedStateFromError`, which each one supports.
interface BoundaryProps {
  children?: unknown;
}

class ReactBoundary extends react.Component<
  { children?: react.ReactNode },
  { err: string | null }
> {
  state = { err: null as string | null };

  static getDerivedStateFromError(error: Error): { err: string } {
    return { err: error.message };
  }

  render(): react.ReactNode {
    return this.state.err === null
      ? this.props.children
      : react.createElement('i', null, `ERR:${this.state.err}`);
  }
}

class PreactBoundary extends preact.Component<BoundaryProps, { err: string | null }> {
  state = { err: null as string | null };

  static getDerivedStateFromError(error: Error): { err: string } {
    return { err: error.message };
  }

  render(): preact.ComponentChild {
    return this.state.err === null
      ? (this.props.children as preact.ComponentChild)
      : preact.h('i', null, `ERR:${this.state.err}`);
  }
}

const roots = new Map<Element, Root>();

/* oxlint-disable typescript/no-unsafe-type-assertion -- the adapters cross two untyped element APIs. */
export const reactAdapter: Adapter = {
  name: 'react',
  concurrent: true,
  useRef: react.useRef,
  useState: react.useState,
  useMemo: react.useMemo,
  h: react.createElement as Adapter['h'],
  Suspense: react.Suspense,
  ErrorBoundary: ReactBoundary,
  StrictMode: react.StrictMode,
  suspend(gate: Gate) {
    react.use(gate.promise);
  },
  mount(el, node) {
    const root = createRoot(el);
    roots.set(el, root);
    root.render(node as react.ReactNode);
  },
  unmount(el) {
    roots.get(el)?.unmount();
    roots.delete(el);
  },
  transition(run) {
    react.startTransition(run);
  },
  flush(run) {
    flushSync(run);
  },
};

export const preactAdapter: Adapter = {
  name: 'preact',
  concurrent: false,
  useRef: preactHooks.useRef,
  useState: preactHooks.useState,
  useMemo: preactHooks.useMemo,
  h: preact.h as Adapter['h'],
  Suspense: preactCompat.Suspense,
  ErrorBoundary: PreactBoundary,
  // Preact has no StrictMode. The scenarios never ask for it.
  StrictMode: preact.Fragment,
  suspend(gate: Gate) {
    if (!gate.done) {
      // Preact's Suspense catches a thrown promise.
      // oxlint-disable-next-line typescript/only-throw-error
      throw gate.promise;
    }
  },
  mount(el, node) {
    preact.render(node as preact.ComponentChild, el);
  },
  unmount(el) {
    preact.render(null, el);
  },
  // Preact renders every update to the end, so a transition is an ordinary update.
  transition(run) {
    run();
  },
  flush(run) {
    run();
  },
};
