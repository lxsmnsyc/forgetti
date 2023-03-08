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

## Optimizations

### Requirements

Forgetti only optimizes component functions (if it is valid based on the component name regex), component functions in HOC (based on HOC imports) and hook functions.

### Kinds

There's four kinds of memoizations that Forgetti produces, and relies on the fundamental concept between a value and its relation to its dependencies:

#### Constants

If an expression has zero dependencies, it is memoized as a constant value. This behavior is similar to a lazy useRef.

```js
function Example() {
  const value = [1, 2, 3, 4];
}
// Compiles into
import { useMemo as _useMemo } from "react";
function Example() {
  let _c = _useMemo(() => new Array(1), []),
    _v = _c[0] ||= [1, 2, 3, 4];
  const value = _v;
}
```

The expression itself may unwrap into multiple constant values if the entire expression is constant itself.

```js
function Example() {
const message = `${getGreeting()}, ${getReceiver()}`;
}
// Compiles into
import { useMemo as _useMemo } from "react";
function Example() {
  let _c = _useMemo(() => new Array(3), []),
    _v = _c[0] ||= getGreeting(),
    _v2 = _c[1] ||= getReceiver(),
    _v3 = _c[2] ||= `${_v}, ${_v2}`;
  const message = _v3;
}
```

#### Dependencies and Dependent values

A dependency is a memoized form of reference. Forgetti memoizes these values to mark if the dependency value has changed. Aside the memoization step, a variable for checking the condition is also yielded.

If an expression has one or more dependencies, the condition yielded by the dependencies is combined, which makes the dependent value yield the combined condition as its own conditon. If the condition is falsy, the dependent value produces a new value for its own. This process is similar to `useMemo` but without having to rely on dependency lists.

```js
function Example(props) {
  const message = `${props.greeting}, ${props.message}`;
}
// Compiles into
import { useMemo as _useMemo } from "react";
function Example(props) {
  let _c = _useMemo(() => new Array(6), []),
    _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props,
    _v2 = _eq ? _c[1] : _c[1] = _v.greeting,
    _eq2 = Object.is(_c[2], _v2),
    _v3 = _eq2 ? _c[2] : _c[2] = _v2,
    _v4 = _eq ? _c[3] : _c[3] = _v.message,
    _eq3 = Object.is(_c[4], _v4),
    _v5 = _eq3 ? _c[4] : _c[4] = _v4,
    _eq4 = _eq2 && _eq3,
    _v6 = _eq4 ? _c[5] : _c[5] = `${_v3}, ${_v5}`;
  const message = _v6;
}
```

### Hooks

Hooks have their own optimization step so that the expression would be consistent between function calls.

#### `ref`

A hook defined as a `ref` must resemble React's `useRef`

```js
import { useRef } from 'react';

function Example(props) {
  const example = useRef(initialValue);
}
// Compiles into
import { useMemo as _useMemo } from "react";
import { useRef } from 'react';
function Example(props) {
  let _c = _useMemo(() => new Array(1), []),
    _v = _c[0] ||= {
      current: initialValue
    };
  const example = _v;
}
```

#### `memo`

A hook defined as a `memo` must resemble React's `useMemo`. `memo` optimization might be similar to the optimization step for dependent values except that `memo` allows you to handpick which value it needs to be dependent on.

```js
import { useMemo } from 'react';

function Example(props) {
  const dependencyA = getA(props);
  const dependencyB = getB(props);
  const value = useMemo(() => getValue(dependencyA, dependencyB), [dependencyB]);
}

// Compiles into
import { useMemo as _useMemo } from "react";
import { useMemo } from 'react';
function Example(props) {
  let _c = _useMemo(() => new Array(6), []),
    _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props,
    _v2 = _eq ? _c[1] : _c[1] = getA(_v);
  const dependencyA = _v2;
  let _v3 = _eq ? _c[2] : _c[2] = getB(_v);
  const dependencyB = _v3;
  let _eq2 = Object.is(_c[3], dependencyB),
    _v4 = _eq2 ? _c[3] : _c[3] = dependencyB,
    _v5 = _eq2 ? _c[4] : _c[4] = [_v4],
    _v6 = _eq2 ? _c[5] : _c[5] = (() => getValue(dependencyA, dependencyB))();
  const value = _v6;
}
```

#### `callback`

A hook defined as a `callback` must resemble React's `callback`. `callback` optimization might be similar to the function expression optimization step except that `callback` allows you to handpick which value it needs to be dependent on.

```js
import { useCallback } from 'react';

function Example(props) {
  const dependencyA = getA(props);
  const dependencyB = getB(props);
  const value = useCallback(() => getValue(dependencyA, dependencyB), [dependencyB]);
}
// Compiles into
import { useMemo as _useMemo } from "react";
import { useCallback } from 'react';
function Example(props) {
  let _c = _useMemo(() => new Array(6), []),
    _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props,
    _v2 = _eq ? _c[1] : _c[1] = getA(_v);
  const dependencyA = _v2;
  let _v3 = _eq ? _c[2] : _c[2] = getB(_v);
  const dependencyB = _v3;
  let _eq2 = Object.is(_c[3], dependencyB),
    _v4 = _eq2 ? _c[3] : _c[3] = dependencyB,
    _v5 = _eq2 ? _c[4] : _c[4] = [_v4],
    _v6 = _eq2 ? _c[5] : _c[5] = () => getValue(dependencyA, dependencyB);
  const value = _v6;
}
```

#### `effect`

A hook defined as an `effect` must resemble React's `useEffect`. This optimization step only memoizes the dependency list so that React (or the target library) only has to compare one item instead of N items.

```js
import { useEffect } from 'react';

function Example(props) {
  useEffect(() => {
    getValue(props.a, props.b, props.c);
  }, [props.a, props.b, props.c]);
}
// Compiles into
import { useMemo as _useMemo } from "react";
import { useEffect } from 'react';
function Example(props) {
  let _c = _useMemo(() => new Array(8), []),
    _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props,
    _v2 = _eq ? _c[1] : _c[1] = _v.a,
    _eq2 = Object.is(_c[2], _v2),
    _v3 = _eq2 ? _c[2] : _c[2] = _v2,
    _v4 = _eq ? _c[3] : _c[3] = _v.b,
    _eq3 = Object.is(_c[4], _v4),
    _v5 = _eq3 ? _c[4] : _c[4] = _v4,
    _v6 = _eq ? _c[5] : _c[5] = _v.c,
    _eq4 = Object.is(_c[6], _v6),
    _v7 = _eq4 ? _c[6] : _c[6] = _v6,
    _eq5 = _eq2 && _eq3 && _eq4,
    _v8 = _eq5 ? _c[7] : _c[7] = [_v3, _v5, _v7];
  useEffect(() => {
    getValue(props.a, props.b, props.c);
  }, [_v8]);
}
```

### Expressions

All expressions are covered with the exception of the following:

- `this`
- `super`
- `import`
- `import.meta`
- class expressions
- `yield`
- `await`
- `++` and `--`
- [function bind](https://github.com/tc39/proposal-bind-operator)
- [do expressions](https://github.com/tc39/proposal-do-expressions)
- [pipeline operators](https://github.com/tc39/proposal-pipeline-operator/wiki#overview-of-previous-proposals)
- [module expressions](https://github.com/tc39/proposal-module-expressions)

#### Functions and arrows

The optimization step is basically an auto-memoized callback. It will only change if the values it is using has changed.

```js
function Example(props) {
  const callback = () => {
    console.log(props.message);
  };
}
// Compiles into
import { useMemo as _useMemo } from "react";
function Example(props) {
  let _c = _useMemo(() => new Array(2), []),
    _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props,
    _v2 = _eq ? _c[1] : _c[1] = () => {
      console.log(props.message);
    };
  const callback = _v2;
}
```

#### Literals and Guaranteed literals

Literals are skipped, with the exception of `undefined`. Guaranteed literals (complex expressions that are comprised only of literals) are cached as a constant.

> **Note**
> In the future, guaranteed literals might be skipped so that bundlers and minifiers can optimize the expressions.

#### Conditional/Ternary expressions

Forgetti expands conditional expressions into an if-statement.

```js
function Example(props) {
  const value = props.condition ? props.left : props.right;
}
// Compiles into
import { useMemo as _useMemo } from "react";
function Example(props) {
  let _c = _useMemo(() => new Array(4), []),
    _eq = Object.is(_c[0], props),
    _v2 = _eq ? _c[0] : _c[0] = props,
    _v3 = _eq ? _c[1] : _c[1] = _v2.condition,
    _v;
  if (_v3) {
    let _c2 = _c[2] ||= new Array(1),
      _v4 = _eq ? _c2[0] : _c2[0] = _v2.left;
    _v = _v4;
  } else {
    let _c3 = _c[3] ||= new Array(1),
      _v5 = _eq ? _c3[0] : _c3[0] = _v2.right;
    _v = _v5;
  }
  const value = _v;
}
```

#### Logical expressions

Almost same process as ternaries, this is to allow short-circuiting while also generating branched caching.

```js
function Example(props) {
  const value = props.condition ?? props.right;
}
// Compiles into
import { useMemo as _useMemo } from "react";
function Example(props) {
  let _c = _useMemo(() => new Array(3), []),
    _eq = Object.is(_c[0], props),
    _v2 = _eq ? _c[0] : _c[0] = props,
    _v3 = _eq ? _c[1] : _c[1] = _v2.condition,
    _v;
  if (_v3 == null) {
    let _c2 = _c[2] ||= new Array(1),
      _v4 = _eq ? _c2[0] : _c2[0] = _v2.right;
    _v = _v4;
  } else _v = _v3;
  const value = _v;
}
```

### Statements

The following statements are optimized:

- expression statements
- variable declaration
- `return` statements
- `throw` statements
- block statements
- `if-else` statements
- `for` statements
- `while` and `do-while` statements
- `switch-case` statements
- `try-catch-finally` statements
- labeled statements

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
  let _c = _useMemo(() => new Array(5), []),
    _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props,
    _v2 = _eq ? _c[1] : _c[1] = _v.type,
    _eq2 = Object.is(_c[2], _v2),
    _v3 = _eq2 ? _c[2] : _c[2] = _v2;
  if (_v3 === 'a') {
    // Branch here, create a cache
    let _c2 = _c[3] ||= new Array(3),
      _v4 = _eq ? _c2[0] : _c2[0] = _v.value,
      _eq3 = Object.is(_c2[1], _v4),
      _v5 = _eq3 ? _c2[1] : _c2[1] = _v4,
      _v6 = _eq3 ? _c2[2] : _c2[2] = examples.a(_v5);
    return _v6;
  } else {
    // Branch here, create a cache
    let _c3 = _c[4] ||= new Array(3),
      _v7 = _eq ? _c3[0] : _c3[0] = _v.value,
      _eq4 = Object.is(_c3[1], _v7),
      _v8 = _eq4 ? _c3[1] : _c3[1] = _v7,
      _v9 = _eq4 ? _c3[2] : _c3[2] = examples.b(_v8);
    return _v9;
  }
}
```

> **Note**
> Nested branches are also supported.

List of supported branch statements:

- `if-else`
- `try-catch-finally`
- `switch-case`
- block statements
- labeled statements

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
  let _c = _useMemo(() => new Array(3), []),
    _eq = Object.is(_c[0], props),
    _v = _eq ? _c[0] : _c[0] = props,
    _v2 = _eq ? _c[1] : _c[1] = _v.arr,
    // Dynamically-sized branch detected, create a branch cache
    _c2 = _c[2] ||= [],
    // Track size
    _id = 0;
  for (const x in _v2) {
    // Create an id
    let _lid = _id++,
      // Create a new cache for statically-sized content
      _l = _c2[_lid] ||= new Array(2),
      _eq2 = Object.is(_l[0], x),
      _v3 = _eq2 ? _l[0] : _l[0] = x,
      _v4 = _eq2 ? _l[1] : _l[1] = console.log(_v3);
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
      type: 'ref',
      name: 'useRef',
      source: 'react',
      kind: 'named',
    },
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

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
