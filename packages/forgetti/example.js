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
import { useEffect, useState } from 'react';

export default function Example(props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log(count);
  });

  return (
    <button onClick={handleIncrement}>{count}</button>
  );
}
`));