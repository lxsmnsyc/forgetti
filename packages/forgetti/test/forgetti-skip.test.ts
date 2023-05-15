/* eslint-disable no-template-curly-in-string */
import * as babel from '@babel/core';
import { describe, expect, it } from 'vitest';
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

describe('forgetti skip', () => {
  it('should optimize non-skipped function declaration', async () => {
    const code = `
function Example(props) {
  return <h1 className={props.className}>{props.children}</h1>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('should skip skipped function declaration', async () => {
    const code = `
/* @forgetti skip */ function Example(props) {
  return <h1 className={props.className}>{props.children}</h1>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('should optimize non-skipped function expression', async () => {
    const code = `
const Example = function (props) {
  return <h1 className={props.className}>{props.children}</h1>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('should skip skipped function expression', async () => {
    const code = `
const /* @forgetti skip */ ExampleA = function (props) {
  return <h1 className={props.className}>{props.children}</h1>;
}
/* @forgetti skip */ const ExampleB = function (props) {
  return <h1 className={props.className}>{props.children}</h1>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('should optimize non-skipped variable declaration', async () => {
    const code = `
const Example = props => {
  return <h1 className={props.className}>{props.children}</h1>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('should skip skipped variable declaration', async () => {
    const code = `
const /* @forgetti skip */ ExampleA = props => {
  return <h1 className={props.className}>{props.children}</h1>;
}
/* @forgetti skip */ const ExampleB = props => {
  return <h1 className={props.className}>{props.children}</h1>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
});
