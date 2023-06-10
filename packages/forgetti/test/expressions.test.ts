/* eslint-disable no-template-curly-in-string */
import * as babel from '@babel/core';
import { describe, it } from 'vitest';
import type { Options } from '../src';
import plugin from '../src';

const options: Options = {
  preset: 'react',
};

async function compile(code: string): Promise<string> {
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
  it('should optimize guaranteed literals', async ({ expect }) => {
    const code = `
function Example(props) {
  return 1 + 2;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize identifiers', async ({ expect }) => {
    const code = `
function Example(props) {
  return props;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize member expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return props.example;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize conditional expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return props.a ? props.b : props.c;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize binary expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return props.a + props.b;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize logical expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return props.a && props.b;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize unary expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return !props.a;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize call expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return props.call();
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize function expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  const callback = () => {
    console.log(props.message);
  };
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize assignment expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  let a, b, c;

  a = b = c = props.x;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize array expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return [props.a, props.b, ...props.c];
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize object expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return { a: props.a, b: props.b, ...props.c };
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize new expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return new X(props);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize sequence expressions', async ({ expect }) => {
    const code = `
function Example(props) {
  return props.a(), props.b();
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize template literals', async ({ expect }) => {
    const code = `
function Example(props) {
  return \`\${props.a()}, \${props.b()}\`;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize tagged templates', async ({ expect }) => {
    const code = `
function Example(props) {
  return props.tag\`\${props.a()}, \${props.b()}\`;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize JSX Element', async ({ expect }) => {
    const code = `
function Example(props) {
  return (
    <div>
      <h1 title={props.title}>Title: {props.title}</h1>
      {props.children}
    </div>
  );
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize JSX Fragment', async ({ expect }) => {
    const code = `
function Example(props) {
  return (
    <>
      <h1 title={props.title}>Title: {props.title}</h1>
      {props.children}
    </>
  );
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize optional member expression', async ({ expect }) => {
    const code = `
function Example(props) {
  return props?.a?.b?.c;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize optional call expression', async ({ expect }) => {
    const code = `
function Example(props) {
  return props.a?.(props.b, props.c);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
});
