/* eslint-disable no-template-curly-in-string */
import * as babel from '@babel/core';
import { describe, expect, it } from 'vitest';
import plugin, { Options } from '../src';

const options: Options = {
  preset: 'react',
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
    return props.a
      ? (props.b ? props.c : props.d)
      : (props.e ? props.f : props.g);
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
});
