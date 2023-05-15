/* eslint-disable react/jsx-no-constructed-context-values */
import { useMemo, useState } from 'preact/hooks';
import useWhy from './useWhy';

function Count({ value }: { value: number }) {
  return <h1>{`Count: ${value}`}</h1>;
}

function Button({ action, title }: { action: () => void, title: string }) {
  useWhy('Button#action', action);
  useWhy('Button#title', title);
  return (
    <button type="button" onClick={action}>
      {title}
    </button>
  );
}

function Increment({ action }: { action: () => void }) {
  useWhy('Increment#action', action);
  return <Button action={action} title="Increment" />;
}

function Decrement({ action }: { action: () => void }) {
  useWhy('Decrement#action', action);
  return <Button action={action} title="Decrement" />;
}

export default function App() {
  const [count, setCount] = useState(0);
  const increment = () => setCount((c) => c + 1);
  const decrement = () => setCount((c) => c - 1);
  const example = useMemo(() => setCount, [setCount]);

  useWhy('App#example', example);
  useWhy('App#setCount', setCount);
  useWhy('App#increment', increment);
  useWhy('App#decrement', decrement);

  return (
    <>
      <Count value={count} />
      <Increment action={increment} />
      <Decrement action={decrement} />
    </>
  );
}
