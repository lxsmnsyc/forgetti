# forgetti

> Solve your hook spaghetti (with more spaghetti). Inspired by React Forget.

[![NPM](https://img.shields.io/npm/v/forgetti.svg)](https://www.npmjs.com/package/forgetti) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm i forgetti
```

```bash
yarn add forgetti
```

```bash
pnpm add forgetti
```

## What is this?

Forgetti is an auto-memoization Babel plugin I made for a hook-based flow like React hooks. This plugin was inspired by React Forget.

## Why

> **Note**
> Please watch the video. Video explains about the problems it solves and benefits it delivers

[![React without memo](https://img.youtube.com/vi/lGEMwh32soc/0.jpg)](https://www.youtube.com/watch?v=lGEMwh32soc "React without memo")

## Demos

- React [![Open in CodeSandbox](https://img.shields.io/badge/Open%20in-CodeSandbox-blue?style=flat-square&logo=codesandbox)](https://codesandbox.io/s/github/LXSMNSYC/forgetti/tree/main/examples/react)

- Preact [![Open in CodeSandbox](https://img.shields.io/badge/Open%20in-CodeSandbox-blue?style=flat-square&logo=codesandbox)](https://codesandbox.io/s/github/LXSMNSYC/forgetti/tree/main/examples/react)

## Integrations

- [Rollup](https://github.com/lxsmnsyc/forgetti/tree/main/packages/rollup)
- [Vite](https://github.com/lxsmnsyc/forgetti/tree/main/packages/vite)

## Configuration

Configuration only has one property: `preset`. This property can either be `"react"`, `"preact"` or your custom preset.

Here's an example preset:

```js
{
  // This boolean is to choose if the compiler
  // should optimize JSX or not. Defaults to `true`
  "shouldOptimizeJSX": false,
  // Required. This is used to construct a RegExp
  // to match "components". This is done by testing
  // either the component's function name or its
  // variable name (if declared as a variable)
  "componentFilter": {
    "source": "^[A-Z]",
    "flags": "",
  },
  // Optional, this has two purposes:
  // 1. To match potential function that are hooks
  //    so that the compiler can also transform it.
  // 2. Forces the hook call to follow hook rules,
  //    since normal function calls are memoized.
  "hookFilter": {
    "source": "^use[A-Z]",
    "flags": "",
  },
  // This is used to construct the cache
  // the information provided is going to be used
  // as to where the hook is going to be imported.
  memo: {
    // Name of the hook
    name: 'useMemo',
    // What module source does it come from
    source: 'react',
    // Kind of import (named or default)
    kind: 'named',
  },
  // This defines which hooks are special
  // Take note that by default, hooks that match
  // the hook filter already follows the hook rules,
  // however this configuration is to optimize
  // known hooks.
  // There's 3 types of hooks it tracks:
  // - memo: a hook that resembles `useMemo`
  // - callback: a hook that resembles `useCallback`
  // - effect: a hook that resembles `useEffect`
  // - ref: a hook that resembles `useRef`
  //
  // The definition is almost the same as the `memo` config
  // but you need to define the kind of the hook
  hooks: [
    {
      type: 'memo',
      name: 'useMemo',
      source: 'react',
      kind: 'named',
    },
    {
      type: 'callback',
      name: 'useCallback',
      source: 'react',
      kind: 'named',
    },
    {
      type: 'effect',
      name: 'useEffect',
      source: 'react',
      kind: 'named',
    },
  ],
  // This is used to match higher-order components.
  // Same configuration as `memo` config.
  hocs: [
    {
      name: 'forwardRef',
      source: 'react',
      kind: 'named',
    },
    {
      name: 'memo',
      source: 'react',
      kind: 'named',
    },
  ],
}
```

## Optimizations

### Expressions

By default, `forgetti` will optimize all known JS expressions except for the following:

- Functions and arrows
  - The optimization step is basically an auto-memoized callback. It will only change if the values it is using has changed.
- Literals
  - Literals are skipped (except `undefined`)
- Guaranteed literals
  - Some expressions are guaranteed literals (e.g. `1 + 2`) and so the cache will store these as a constant.
- Conditional expresisons a.k.a. ternary
  - This compiler converts this into an if-statement so that it can generate branched caching.
- Logical expressions a.k.a. `||`, `&&` and `??`
  - Almost same process as ternaries, this is to allow short-circuiting while also generating branched caching.

### Branched Caching

When a branched statement (a statement with multiple paths) is detected, `forgetti` generates a branched cache from a parent cache (by default, the root cache).

Example with an `if-statement`:

```js
function Example(props) {
  if (props.type === 'a') {
    return examples.a(props.value);
  } else {
    return examples.b(props.value);
  }
}

// Compiles into
import { useMemo as _useMemo } from "react";
function Example(props) {
  // Root cache
  let _c = _useMemo(() => new Array(5), []);
  let _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props;
  let _v2 = _eq ? _c[1] : _c[1] = _v.type;
  let _eq2 = Object.is(_c[2], _v2),
    _v3 = _eq2 ? _c[2] : _c[2] = _v2;
  if (_v3 === 'a') {
    // Branch here, create a cache
    let _c2 = _c[3] || (_c[3] = new Array(3));
    let _v4 = _eq ? _c2[0] : _c2[0] = _v.value;
    let _eq3 = Object.is(_c2[1], _v4),
      _v5 = _eq3 ? _c2[1] : _c2[1] = _v4;
    let _v6 = _eq3 ? _c2[2] : _c2[2] = examples.a(_v5);
    return _v6;
  } else {
    // Branch here, create a cache
    let _c3 = _c[4] || (_c[4] = new Array(3));
    let _v7 = _eq ? _c3[0] : _c3[0] = _v.value;
    let _eq4 = Object.is(_c3[1], _v7),
      _v8 = _eq4 ? _c3[1] : _c3[1] = _v7;
    let _v9 = _eq4 ? _c3[2] : _c3[2] = examples.b(_v8);
    return _v9;
  }
}
```

> **Note**
> With branched caching, nested branches are also supported by default.

List of supported branch statements:

- `if-else`
- `try-catch-finally`
- `switch-case`

> **Note**
> Branched statements are usually illegal in a hook-based system (like React), but a `memo` or `callback` call inside the branches are allowed.

#### Loops

Loops are a bit different than normal branches because normal branches are static in size: the amount of branches does not change. Loops are dynamic in branches, it can re-evaluate as many times as the condition is met, so there's an extra step being done. `forgetti` generates the branch cache outside of the loop, and also another variable to track its size. This variable is used to index the inner branch cache that is generated inside the loop.

```js
function Example(props) {
  for (const x in props.arr) {
    console.log(x);
  }
}
// Compiles into
import { useMemo as _useMemo } from "react";
function Example(props) {
  // This is the root cache
  let _c = _useMemo(() => new Array(3), []);
  let _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props;
  let _v2 = _eq ? _c[1] : _c[1] = _v.arr;

  // Dynamically-sized branch detected, create a branch cache
  let _c2 = _c[2] || (_c[2] = []),
    // Track size
    _id = 0;
  for (const x in _v2) {
    // Create an id
    let _lid = _id++,
      // Create a new cache for statically-sized content
      _l = _c2[_lid] || (_c2[_lid] = new Array(2));
    let _eq2 = Object.is(_l[0], x),
      _v3 = _eq2 ? _l[0] : _l[0] = x;
    let _v4 = _eq2 ? _l[1] : _l[1] = console.log(_v3);
    _v4;
  }
}
```

List of supported loop statements:

- `for`
- `for-of`
- `for-in`
- `while`
- `do-while`

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
