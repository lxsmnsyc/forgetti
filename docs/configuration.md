# Configuration

Configuration only has one property: `preset`. This property can either be `"react"`, `"preact"` or your custom preset.

Here's an example preset:

```js
{
  filters: {
    // Required. This is used to construct a RegExp
    // to match "components". This is done by testing
    // either the component's function name or its
    // variable name (if declared as a variable)
    component: {
      "source": "^[A-Z]",
      "flags": "",
    },
    // Optional, this has two purposes:
    // 1. To match potential function that are hooks
    //    so that the compiler can also transform it.
    // 2. Forces the hook call to follow hook rules,
    //    since normal function calls are memoized.
    hook: {
      "source": "^use[A-Z]",
      "flags": "",
    },
  },
  runtime: {
    // This is used to construct the cache
    // the information provided is going to be used
    // as to where the hook is going to be imported.
    useRef: {
      // Name of the hook
      name: 'useRef',
      // What module source does it come from
      source: 'react',
      // Kind of import (named or default)
      kind: 'named',
    },
    // Optional. Defining this means JSX optimization
    // is going to be enabled.
    memo: {
      name: 'memo',
      source: 'react',
      kind: 'named',
    },
  },
  imports: {
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
}
```
