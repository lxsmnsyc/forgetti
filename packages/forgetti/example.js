import * as babel from '@babel/core';
import plugin from 'forgetti';

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

console.log(await compile(`
export const Example = function Example() {
  const value = [1, 2, 3, 4];

  return (
    <div>
      {value.map(i => <p key={i}>{i}</p>)}
    </div>
  );
};
`));