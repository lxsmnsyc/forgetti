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

function Count({ value }) {
  return <h1>{\`Count: \${value}\`}</h1>;
}

function Button({ action, title }) {
  return (
    <button type="button" onClick={action}>
      {title}
    </button>
  );
}

function Increment({ action }) {
  return <Button action={action} title="Increment" />;
}

function Decrement({ action }) {
  return <Button action={action} title="Decrement" />;
}

export default function App() {
  const [count, setCount] = useState(0);
  const increment = () => setCount((c) => c + 1);
  const decrement = () => setCount((c) => c - 1);

  return (
    <>
      <Count value={count} />
      <Increment action={increment} />
      <Decrement action={decrement} />
    </>
  );
}
`));