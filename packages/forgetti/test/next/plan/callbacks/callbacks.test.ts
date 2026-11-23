import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/next';

function run(body: string, params = 'props'): string {
  const source = `import { Child, risky } from "x";\nexport function T(${params}) { ${body} }\n`;
  return compile(source, { preset: 'react', filename: 'input.jsx' }).code;
}

describe('closures', () => {
  it('caches a callback on the values it captures', () => {
    const code = run(
      'const go = () => { globalThis.n = id; }; return <div>{o}<Child go={go} /></div>;',
      '{ id, o }',
    );

    expect(code).toContain('Object.is($[0], id)');
    expect(code).toContain('Object.is($[5], $[3])');
  });

  it('does not cache a callback that assigns a local', () => {
    const code = run(
      'let n = 0; const go = () => { n = id; }; n = 1; return <Child go={go} />;',
      '{ id }',
    );

    expect(code).not.toContain('Object.is($[0], id)');
  });

  it('does not cache a callback that reads a local written later', () => {
    const code = run('let n = 0; const go = () => n; n = id; return <Child go={go} />;', '{ id }');

    expect(code).not.toContain('Object.is($[0], n)');
  });
});

describe('closure globals', () => {
  it('does not cache a closure that reads a global that changes', () => {
    const code = run(
      'const fn = () => a + (globalThis.__g || 0); return <div>{b}<Child fn={fn} /></div>;',
      '{ a, b }',
    );

    expect(code).not.toContain('Object.is($[0], a)');
  });

  it('does not cache a closure that reads hidden state', () => {
    const code = run('const fn = () => a + Math.random(); return <Child fn={fn} />;', '{ a }');

    expect(code).not.toContain('Object.is($[0], a)');
  });
});

describe('props members', () => {
  it('keys on the whole object when a property is passed to a call', () => {
    const code = run('risky(props.items); return <Child v={props.a} />;');

    expect(code).toContain('Object.is($[0], props)');
    expect(code).not.toContain('props.a)');
  });

  it('keys on the whole object when a property is a method receiver', () => {
    const code = run('props.items.push(1); return <Child v={props.a} />;');

    expect(code).not.toContain('Object.is($[0], props.a)');
  });

  it('keys an element on the properties it reads', () => {
    const code = run('return <section c={props.c}><Child v={props.x} /></section>;');

    expect(code).toContain('Object.is($[0], props.x)');
    expect(code).not.toContain('Object.is($[0], props)');
  });

  it('keys on the whole object when a method is called', () => {
    const code = run('return <Child v={props.x} f={props.get()} />;');

    expect(code).toContain('Object.is($[0], props)');
    expect(code).not.toContain('props.x)');
  });

  it('keys on the whole object when props is passed on', () => {
    const code = run('return <Child {...props} v={props.x} />;');

    expect(code).toContain('Object.is($[0], props)');
  });

  it('keeps destructured props as plain bindings', () => {
    const code = run('return <Child v={x} />;', '{ x }');

    expect(code).toContain('Object.is($[0], x)');
  });
});

describe('mutated list', () => {
  it('keeps the rows on the inputs of the list', () => {
    const code = run(
      'const arr = [a]; arr.push(b); return <div>{c}{arr.map((v) => <Child v={v} />)}</div>;',
      '{ a, b, c }',
    );

    expect(code).toContain('Object.is($[0], a)');
    expect(code).toContain('Object.is($[1], b)');
    expect(code).toMatch(/Object\.is\(\$\[3\], c\)/);
  });
});

describe('try blocks', () => {
  it('caches a call stored in a local inside try', () => {
    const code = run(
      'let out; try { out = risky(a); } catch (e) { out = 1; } return <b>{out}</b>;',
      '{ a }',
    );

    expect(code).toContain('Object.is($[0], a)');
    expect(code).toMatch(/\$\[1\] = risky\(a\)/);
  });

  it('leaves the call when its result is changed later', () => {
    const code = run(
      'let out; try { out = risky(a); } catch (e) { out = []; } out.push(1); return <b>{out}</b>;',
      '{ a }',
    );

    expect(code).not.toContain('Object.is($[0], a)');
  });
});
