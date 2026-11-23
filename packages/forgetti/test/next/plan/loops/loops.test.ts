import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/next';

function run(body: string, params = 'xs, t'): string {
  const source = `import { Row, A, B } from "x";\nexport function T({ ${params} }) { ${body} }\n`;
  return compile(source, { preset: 'react', filename: 'input.jsx' }).code;
}

function countBranches(code: string): number {
  return code.match(/= branch\(/g)?.length ?? 0;
}

describe('map callbacks', () => {
  it('gives each row a cache by position and keeps the result array', () => {
    const code = run('return <ul title={t}>{xs.map((x) => <Row key={x.id} item={x} />)}</ul>;');

    expect(code).toMatch(/keep\(\$, \d+, xs\.map\(/);
    expect(code).toMatch(/branch\(\$1r, i\d*, \d+\)/);
    expect(code).toContain('Object.is($1[0], x)');
    // The list element is keyed on the title and the kept array, not on `xs`.
    expect(code).not.toContain('Object.is($[0], xs)');
    expect(code).not.toContain('Object.is($[1], xs)');
  });

  it('keeps the index parameter the source has', () => {
    const code = run('return <ul>{xs.map((x, k) => <Row item={x} n={k} />)}</ul>;');

    expect(code).toContain('branch($1r, k,');
    expect(code).toContain('Object.is($1[1], k)');
  });

  it('plans a ternary inside a callback', () => {
    const code = run('return <ul>{xs.map((x) => (x.on ? <A v={t} /> : <B v={x} />))}</ul>;');

    expect(code).toContain('keep(');
    expect(code).toContain('x.on ? <A v={t} /> : <B v={x} />');
  });

  it('plans a map inside a ternary arm', () => {
    const code = run('return <div>{t ? xs.map((x) => <Row item={x} />) : <i>no</i>}</div>;');

    expect(code).toContain('if (t)');
    expect(code).toContain('keep($1, 0, xs.map(');
    // The call stays inside the arm, so it runs only when the arm does.
    expect(code.indexOf('keep($1')).toBeGreaterThan(code.indexOf('if (t)'));
  });

  it('plans a map on the right of && inside the arm', () => {
    const code = run('return <ul>{xs && xs.map((x) => <Row item={x} />)}</ul>;');

    expect(code).toMatch(/if \(\$v\) \{[\s\S]*keep\(/);
  });

  it('plans maps inside maps', () => {
    const code = run(
      'return <ul>{xs.map((r) => <li key={r.id}>{r.cells.map((c) => <Row item={c} />)}</li>)}</ul>;',
    );

    expect(code.match(/keep\(/g)?.length).toBe(2);
    expect(countBranches(code)).toBe(4);
  });

  it('skips a map with an optional chain', () => {
    const code = run('return <ul>{xs?.map((x) => <Row item={x} />)}</ul>;');

    expect(code).not.toContain('keep(');
  });

  it('skips a callback that is not a function expression', () => {
    const code = run('return <ul>{xs.map(t)}</ul>;');

    expect(code).not.toContain('keep(');
  });

  it('skips a callback with a rest parameter', () => {
    const code = run('return <ul>{xs.map((...a) => <Row item={a[0]} />)}</ul>;');

    expect(code).not.toContain('keep(');
  });

  it('skips a callback that changes a local of the component', () => {
    const code = run(
      'const seen = []; return <ul>{xs.map((x) => { seen.push(x); return <Row item={x} n={seen.length} />; })}</ul>;',
    );

    expect(code).not.toContain('keep(');
    expect(code).not.toContain('branch(');
  });

  it('does not enter a map inside an event handler', () => {
    const code = run('return <button onClick={() => xs.map((x) => <Row item={x} />)} />;');

    expect(code).not.toContain('keep(');
  });
});

describe('loops', () => {
  it('gives each pass of a for-of loop a cache', () => {
    const code = run(
      'const out = []; for (const x of xs) { out.push(<Row key={x.id} item={x} />); } return <ul>{out}</ul>;',
    );

    expect(code).toContain('let i = -1;');
    expect(code).toContain('branch($1r, ++i, 2)');
    expect(code).toContain('Object.is($1[0], x)');
  });

  it('keys a counter loop on its counter', () => {
    const code = run(
      'const out = []; for (let i = 0; i < xs.length; i++) { out.push(<Row key={i} item={xs[i]} />); } return <ul>{out}</ul>;',
    );

    expect(code).toContain('Object.is($1[0], i)');
    expect(code).toContain('Object.is($1[1], xs)');
  });

  it('does not key on a counter that the body changes', () => {
    const code = run(
      'const out = []; for (let i = 0; i < 9; i++) { if (i > 2) i++; out.push(<Row key={i} />); } return <ul>{out}</ul>;',
    );

    expect(code).not.toContain('branch(');
  });

  it('does not cache a read of a local the loop assigns', () => {
    const code = run(
      'const out = []; let sum = 0; for (const x of xs) { sum += x; out.push(<Row key={x} s={sum} />); } return <ul>{out}</ul>;',
    );

    expect(code).not.toContain('branch(');
  });

  it('plans a map inside a loop body', () => {
    const code = run(
      'const out = []; for (const g of xs) { const kids = g.items.map((x) => <Row item={x} />); out.push(kids); } return <ul>{out}</ul>;',
    );

    expect(code).toContain('keep(');
    expect(countBranches(code)).toBe(4);
  });

  it('moves the counter at the start of the body, before any break', () => {
    const code = run(
      'const out = []; for (const x of xs) { if (x.stop) break; out.push(<Row key={x.id} item={x} />); } return <ul>{out}</ul>;',
    );

    expect(code).toContain('branch($1r, ++i, 2)');
    expect(code.indexOf('++i')).toBeLessThan(code.indexOf('break'));
  });

  it('does not key on a var counter or a var for-of name', () => {
    const counter = run(
      'const out = []; for (var i = 0; i < 3; i++) { out.push(<Row key={i} f={() => i} />); } return <ul>{out}</ul>;',
    );
    const of = run(
      'const out = []; for (var x of xs) { out.push(<Row f={() => x} />); } return <ul>{out}</ul>;',
    );

    expect(counter).not.toContain('branch(');
    expect(of).not.toContain('branch(');
  });
});
