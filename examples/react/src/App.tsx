/* eslint-disable react/jsx-no-constructed-context-values */
import { useState } from 'react';
import useWhy from './useWhy';

function Count({ value }: { value: number }): JSX.Element {
  return <h1>{`Count: ${value}`}</h1>;
}

function Button({ action, title }: { action: () => void; title: string }): JSX.Element {
  useWhy('Button#action', action);
  useWhy('Button#title', title);
  return (
    <button type="button" onClick={action}>
      {title}
    </button>
  );
}

function Increment({ action }: { action: () => void }): JSX.Element {
  useWhy('Increment#action', action);
  return <Button action={action} title="Increment" />;
}

function Decrement({ action }: { action: () => void }): JSX.Element {
  useWhy('Decrement#action', action);
  return <Button action={action} title="Decrement" />;
}

export default function App(): JSX.Element {
  const [count, setCount] = useState(0);
  const increment = (): void => {
    setCount((c) => c + 1);
  };
  const decrement = (): void => {
    setCount((c) => c - 1);
  };

  return (
    <>
      <Count value={count} />
      <Increment action={increment} />
      <Decrement action={decrement} />
    </>
  );
}
