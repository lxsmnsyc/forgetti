# Optimizations

## Requirements

Forgetti only optimizes component functions (if it is valid based on the component name regex), component functions in HOC (based on HOC imports) and hook functions.

## Steps

Forgetti performs the following optimization steps:

- Pre-inlining (folding)
  - Expressions that can be inlined are inlined. This allows Forgetti to know the best optimization possible. Currently this only covers variable declarations.
- Simplification
  - Unreachable expressions are removed.
  - Truthy/falsy values are simplified
- Expanding (unfolding)
  - Assignment expressions and hook calls are moved to the nearest block.
- JSX Optimization
  - If the preset has `runtime.memo` defined, Forgetti generates hidden components that are memoized, then JSX expressions are moved into that component.
- Memoization
  - The core process
- Post-inlining
  - The memoization step may generate unnecessary amount of variables. This process helps so that the amount of declarations are reduced.

## Memoization

### Constants

If an expression has zero dependencies, it is memoized as a constant value. This behavior is similar to a lazy useRef.

```js
function Example() {
  const value = [1, 2, 3, 4];
}
// Compiles into
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
function Example() {
  let _cache = _$$cache(_useRef, 1);
  const value = 0 in _cache ? _cache[0] : _cache[0] = [1, 2, 3, 4];
}
```

Complex expressions that are entirely constant are cached as one.

```js
function Example() {
  const greeting = getGreeting();
  const receiver = getReceiver();
  const message = `${greeting}, ${receiver}`;
}
// Compiles into
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
function Example() {
  let _cache = _$$cache(_useRef, 1);
  const message = 0 in _cache ? _cache[0] : _cache[0] = `${getGreeting()}, ${getReceiver()}`;
}
```

### Dependencies and Dependent values

A dependency is a memoized form of reference. Forgetti memoizes these values to mark if the dependency value has changed. Aside the memoization step, a variable for checking the condition is also yielded.

If an expression has one or more dependencies, the condition yielded by the dependencies is combined, which makes the dependent value yield the combined condition as its own conditon. If the condition is falsy, the dependent value produces a new value for its own. This process is similar to `useMemo` but without having to rely on dependency lists.

```js
function Example(props) {
  const message = `${props.greeting}, ${props.message}`;
}
// Compiles into
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
function Example(props) {
  let _cache = _$$cache(_useRef, 6),
    _equals = _$$equals(_cache, 0, props),
    _value = _equals ? _cache[0] : _cache[0] = props,
    _value2 = _equals ? _cache[1] : _cache[1] = _value.greeting,
    _equals2 = _$$equals(_cache, 2, _value2),
    _value3 = _equals2 ? _cache[2] : _cache[2] = _value2,
    _value4 = _equals ? _cache[3] : _cache[3] = _value.message,
    _equals3 = _$$equals(_cache, 4, _value4),
    _value5 = _equals3 ? _cache[4] : _cache[4] = _value4;
  const message = _equals2 && _equals3 ? _cache[5] : _cache[5] = `${_value3}, ${_value5}`;
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
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { useRef } from 'react';
function Example(props) {
  let _cache = _$$cache(_useRef, 1);
  const example = 0 in _cache ? _cache[0] : _cache[0] = {
    current: initialValue
  };
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
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { useMemo } from 'react';
function Example(props) {
  let _cache = _$$cache(_useRef, 8),
    _value = 0 in _cache ? _cache[0] : _cache[0] = getA,
    _equals = _$$equals(_cache, 1, props),
    _value2 = _equals ? _cache[1] : _cache[1] = props;
  const dependencyA = _equals ? _cache[2] : _cache[2] = _value(_value2);
  let _value4 = 3 in _cache ? _cache[3] : _cache[3] = getB;
  const dependencyB = _equals ? _cache[4] : _cache[4] = _value4(_value2);
  let _equals2 = _$$equals(_cache, 5, dependencyB),
    _value6 = _equals2 ? _cache[5] : _cache[5] = dependencyB,
    _value7 = _equals2 ? _cache[6] : _cache[6] = [_value6];
  const value = _equals2 ? _cache[7] : _cache[7] = (() => getValue(dependencyA, dependencyB))();
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
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { useCallback } from 'react';
function Example(props) {
  let _cache = _$$cache(_useRef, 8),
    _value = 0 in _cache ? _cache[0] : _cache[0] = getA,
    _equals = _$$equals(_cache, 1, props),
    _value2 = _equals ? _cache[1] : _cache[1] = props;
  const dependencyA = _equals ? _cache[2] : _cache[2] = _value(_value2);
  let _value4 = 3 in _cache ? _cache[3] : _cache[3] = getB;
  const dependencyB = _equals ? _cache[4] : _cache[4] = _value4(_value2);
  let _equals2 = _$$equals(_cache, 5, dependencyB),
    _value6 = _equals2 ? _cache[5] : _cache[5] = dependencyB,
    _value7 = _equals2 ? _cache[6] : _cache[6] = [_value6];
  const value = _equals2 ? _cache[7] : _cache[7] = () => getValue(dependencyA, dependencyB);
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
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { useEffect } from 'react';
function Example(props) {
  let _cache = _$$cache(_useRef, 9),
    _equals = _$$equals(_cache, 0, props),
    _value = _equals ? _cache[0] : _cache[0] = props,
    _value2 = _equals ? _cache[1] : _cache[1] = _value.a,
    _equals2 = _$$equals(_cache, 2, _value2),
    _value3 = _equals2 ? _cache[2] : _cache[2] = _value2,
    _value4 = _equals ? _cache[3] : _cache[3] = _value.b,
    _equals3 = _$$equals(_cache, 4, _value4),
    _value5 = _equals3 ? _cache[4] : _cache[4] = _value4,
    _value6 = _equals ? _cache[5] : _cache[5] = _value.c,
    _equals4 = _$$equals(_cache, 6, _value6),
    _value7 = _equals4 ? _cache[6] : _cache[6] = _value6,
    _hoisted = useEffect(() => {
      getValue(props.a, props.b, props.c);
    }, [_equals2 && _equals3 && _equals4 ? _cache[7] : _cache[7] = [_value3, _value5, _value7]]);
  _$$equals(_cache, 8, _hoisted) ? _cache[8] : _cache[8] = _hoisted;
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
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
function Example(props) {
  let _cache = _$$cache(_useRef, 2),
    _equals = _$$equals(_cache, 0, props),
    _value = _equals ? _cache[0] : _cache[0] = props;
  const callback = _equals ? _cache[1] : _cache[1] = () => {
    console.log(props.message);
  };
}
```

#### Conditional/Ternary expressions

Forgetti expands conditional expressions into an if-statement.

```js
function Example(props) {
  const value = props.condition ? props.left : props.right;
}
// Compiles into
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
function Example(props) {
  let _cache = _$$cache(_useRef, 4),
    _equals = _$$equals(_cache, 0, props),
    _value2 = _equals ? _cache[0] : _cache[0] = props,
    _value;
  if (_equals ? _cache[1] : _cache[1] = _value2.condition) {
    let _cache2 = _$$branch(_cache, 2, 2),
      _equals2 = _$$equals(_cache2, 0, props),
      _value4 = _equals2 ? _cache2[0] : _cache2[0] = props;
    _value = _equals2 ? _cache2[1] : _cache2[1] = _value4.left;
  } else {
    let _cache3 = _$$branch(_cache, 3, 2),
      _equals3 = _$$equals(_cache3, 0, props),
      _value6 = _equals3 ? _cache3[0] : _cache3[0] = props;
    _value = _equals3 ? _cache3[1] : _cache3[1] = _value6.right;
  }
  const value = _value;
}
```

#### Logical expressions

Almost same process as ternaries, this is to allow short-circuiting while also generating branched caching.

```js
function Example(props) {
  const value = props.condition ?? props.right;
}
// Compiles into
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
function Example(props) {
  let _cache = _$$cache(_useRef, 3),
    _equals = _$$equals(_cache, 0, props),
    _value2 = _equals ? _cache[0] : _cache[0] = props,
    _value3 = _equals ? _cache[1] : _cache[1] = _value2.condition,
    _value;
  if (_value3 == null) {
    let _cache2 = _$$branch(_cache, 2, 2),
      _equals2 = _$$equals(_cache2, 0, props),
      _value4 = _equals2 ? _cache2[0] : _cache2[0] = props;
    _value = _equals2 ? _cache2[1] : _cache2[1] = _value4.right;
  } else _value = _value3;
  const value = _value;
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
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
function Example(props) {
  let _cache = _$$cache(_useRef, 6),
    _equals = _$$equals(_cache, 0, props),
    _value = _equals ? _cache[0] : _cache[0] = props,
    _value2 = _equals ? _cache[1] : _cache[1] = _value.type,
    _equals2 = _$$equals(_cache, 2, _value2),
    _value3 = _equals2 ? _cache[2] : _cache[2] = _value2;
  if (_equals2 ? _cache[3] : _cache[3] = _value3 === 'a') {
    let _cache2 = _$$branch(_cache, 4, 4),
      _equals3 = _$$equals(_cache2, 0, props),
      _value5 = _equals3 ? _cache2[0] : _cache2[0] = props,
      _value6 = _equals3 ? _cache2[1] : _cache2[1] = _value5.value,
      _equals4 = _$$equals(_cache2, 2, _value6),
      _value7 = _equals4 ? _cache2[2] : _cache2[2] = _value6;
    return _equals4 ? _cache2[3] : _cache2[3] = examples.a(_value7);
  } else {
    let _cache3 = _$$branch(_cache, 5, 4),
      _equals5 = _$$equals(_cache3, 0, props),
      _value9 = _equals5 ? _cache3[0] : _cache3[0] = props,
      _value10 = _equals5 ? _cache3[1] : _cache3[1] = _value9.value,
      _equals6 = _$$equals(_cache3, 2, _value10),
      _value11 = _equals6 ? _cache3[2] : _cache3[2] = _value10;
    return _equals6 ? _cache3[3] : _cache3[3] = examples.b(_value11);
  }
}
```

> [!NOTE]
> Nested branches are also supported.

List of supported branch statements:

- `if-else`
- `try-catch-finally`
- `switch-case`
- block statements
- labeled statements

> [!NOTE]
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
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
function Example(props) {
  let _cache = _$$cache(_useRef, 3),
    _equals = _$$equals(_cache, 0, props),
    _value = _equals ? _cache[0] : _cache[0] = props,
    _value2 = _equals ? _cache[1] : _cache[1] = _value.arr,
    _cache2 = _$$branch(_cache, 2, 0),
    _id = 0;
  for (const x in _value2) {
    let _loop = _$$branch(_cache2, _id++, 2),
      _equals2 = _$$equals(_loop, 0, x),
      _value3 = _equals2 ? _loop[0] : _loop[0] = x;
    _equals2 ? _loop[1] : _loop[1] = console.log(_value3);
  }
}
```

List of supported loop statements:

- `for`
- `for-of`
- `for-in`
- `while`
- `do-while`

## JSX

If the preset has `optimizeJSX` enabled, JSX expressions are moved into a hidden memoized component.

```js
function Example(props) {
  return <h1>{props.greeting}, {props.receiver}!</h1>;
}
// Compiles into
import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
const _Memo = _$$memo(_memo, _values => <h1>{_values[0]}, {_values[1]}!</h1>);
function Example(props) {
  let _cache = _$$cache(_useRef, 8),
    _equals = _$$equals(_cache, 0, props),
    _value = _equals ? _cache[0] : _cache[0] = props,
    _value2 = _equals ? _cache[1] : _cache[1] = _value.greeting,
    _equals2 = _$$equals(_cache, 2, _value2),
    _value3 = _equals2 ? _cache[2] : _cache[2] = _value2,
    _value4 = _equals ? _cache[3] : _cache[3] = _value.receiver,
    _equals3 = _$$equals(_cache, 4, _value4),
    _value5 = _equals3 ? _cache[4] : _cache[4] = _value4,
    _value6 = _equals2 && _equals3 ? _cache[5] : _cache[5] = [_value3, _value5],
    _equals5 = _$$equals(_cache, 6, _value6),
    _value7 = _equals5 ? _cache[6] : _cache[6] = _value6;
  return _equals5 ? _cache[7] : _cache[7] = /*@forgetti skip*/<_Memo v={_value7} />;
}
```

> [!NOTE]
> You can use `/* @forgetti skip */` just before the JSX if you want to opt-out of this feature.

## `/* @forgetti skip */`

To disable optimization for an specific component, you can include the comment `/* @forgetti skip */` before the component.

```js
/* @forgetti skip */
function UnoptimizedComponent(props) {
  return <h1 className={props.className}>{props.children}</h1>;
}
```
