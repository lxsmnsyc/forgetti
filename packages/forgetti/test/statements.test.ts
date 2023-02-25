/* eslint-disable no-template-curly-in-string */
import * as babel from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin, { Options } from '../src';

const options: Options = {
  componentFilter: {
    source: '^[A-Z]',
    flags: '',
  },
  hookFilter: {
    source: '^use[A-Z]',
    flags: '',
  },
  memo: {
    name: 'useMemo',
    source: 'react',
    kind: 'named',
  },
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
    {
      type: 'effect',
      name: 'useLayoutEffect',
      source: 'react',
      kind: 'named',
    },
  ],
  hocs: [],
};

async function compile(code: string) {
  const result = await babel.transformAsync(code, {
    plugins: [
      [plugin, options],
    ],
    parserOpts: {
      plugins: [
        'jsx',
      ],
    },
  });

  return result?.code ?? '';
}

describe('statements', () => {
  it('should optimize for-of statements', async () => {
    const code = `
  function Example(props) {
    for (const x of props.arr) {
      console.log(x);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize for-in statements', async () => {
    const code = `
  function Example(props) {
    for (const x in props.arr) {
      console.log(x);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize for statements', async () => {
    const code = `
  function Example(props) {
    for (let i = 0; i < 10; i += 1) {
      console.log(i);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize while statements', async () => {
    const code = `
  function Example(props) {
    let i = 0;
    while (i < props.x) {
      console.log(i);
      i += 1;
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize do-while statements', async () => {
    const code = `
  function Example(props) {
    let i = 0;
    do {
      console.log(i);
      i += 1;
    } while (i < props.x)
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize switch statements', async () => {
    const code = `
  function Example(props) {
    switch (props.type) {
      case 'a':
        return examples.a(props.value);
      case 'b':
        return examples.b(props.value);
      case 'c':
        return examples.c(props.value);
      default:
        return examples.default(props.value);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
});
