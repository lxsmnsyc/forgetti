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

describe.concurrent('statements', () => {
  it('should optimize for-of statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    return props.a && props.b && props.c && props.d;
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
});
