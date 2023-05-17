import * as babel from '@babel/core';
import plugin from 'forgetti';
import { readFile } from 'fs/promises';

const options = {
  preset: 'react',
};

async function compile(code) {
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

console.log(await compile(await readFile('./input.js', 'utf-8')));