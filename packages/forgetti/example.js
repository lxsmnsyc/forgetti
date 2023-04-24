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
import { useMemo, useState } from 'react';

export default function Example(props) {
  const [count, setCount] = useState(0);
  const handleIncrement = useMemo(() => setCount(c => c + 1));

  return (
    <button onClick={handleIncrement}>{count}</button>
  );
}
`));