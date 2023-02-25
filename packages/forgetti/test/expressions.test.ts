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

describe('expressions', () => {
  it('should optimize guaranteed literals', async () => {
    const code = `
function Example(props) {
  return 1 + 2;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize identifiers', async () => {
    const code = `
function Example(props) {
  return props;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize member expressions', async () => {
    const code = `
function Example(props) {
  return props.example;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize conditional expressions', async () => {
    const code = `
function Example(props) {
  return props.a ? props.b : props.c;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize binary expressions', async () => {
    const code = `
function Example(props) {
  return props.a + props.b;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize logical expressions', async () => {
    const code = `
function Example(props) {
  return props.a && props.b;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize unary expressions', async () => {
    const code = `
function Example(props) {
  return !props.a;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize call expressions', async () => {
    const code = `
function Example(props) {
  return props.call();
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize await/yield expressions', async () => {
    const code = `
async function Example(props) {
  return await props.call();
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize function expressions', async () => {
    const code = `
function Example(props) {
  return () => {
    console.log(props.message);
  };
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize assignment expressions', async () => {
    const code = `
function Example(props) {
  let a, b, c;

  a = b = c = props.x;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize array expressions', async () => {
    const code = `
function Example(props) {
  return [props.a, props.b, ...props.c];
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize object expressions', async () => {
    const code = `
function Example(props) {
  return { a: props.a, b: props.b, ...props.c };
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize new expressions', async () => {
    const code = `
function Example(props) {
  return new X(props);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize sequence expressions', async () => {
    const code = `
function Example(props) {
  return props.a(), props.b();
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
});
