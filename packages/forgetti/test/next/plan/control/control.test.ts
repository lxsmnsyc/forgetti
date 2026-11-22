import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/next';

function run(body: string, params = 'k, b'): string {
  const source = `import { B } from "x";\nexport function T({ ${params} }) { ${body} }\n`;
  return compile(source, { preset: 'react', filename: 'input.jsx' }).code;
}

// The cached `<div>` must be keyed on the test as well as on `b`.
function expectKeyedOn(code: string, names: string[]): void {
  expect(code).toContain('<div>{el}</div>');
  const guard = code.slice(code.indexOf('if (!Object.is($[0]'), code.indexOf('<div>{el}</div>'));
  for (const name of names) {
    expect(guard).toMatch(new RegExp(`Object\\.is\\(\\$\\[\\d+\\], ${name}\\)`));
  }
}

describe('blocks that read a local assigned in a conditional', () => {
  it('keys on the test of an if without else', () => {
    const code = run('let el = null; if (k) { el = <B v={b} />; } return <div>{el}</div>;');
    expectKeyedOn(code, ['k', 'b']);
  });

  it('keys on the test of an if with else', () => {
    const code = run(
      'let el = null; if (k) { el = <B v={b} />; } else { el = <i />; } return <div>{el}</div>;',
    );
    expectKeyedOn(code, ['k', 'b']);
  });

  it('keys on the discriminant of a switch without default', () => {
    const code = run(
      'let el = null; switch (k) { case 1: el = <B v={b} />; break; } return <div>{el}</div>;',
    );
    expectKeyedOn(code, ['k', 'b']);
  });

  it('keys on the discriminant of a switch with default', () => {
    const code = run(
      'let el = null; switch (k) { case 1: el = <B v={b} />; break; default: el = <i />; } return <div>{el}</div>;',
    );
    expectKeyedOn(code, ['k', 'b']);
  });

  it('keys on the left side of an && assignment', () => {
    const code = run('let el = null; k && (el = <B v={b} />); return <div>{el}</div>;');
    expectKeyedOn(code, ['k', 'b']);
  });

  it('keys on the test of a ternary assignment', () => {
    const code = run('let el = null; k ? (el = <B v={b} />) : null; return <div>{el}</div>;');
    expectKeyedOn(code, ['k', 'b']);
  });

  it('keys on the outer test of a nested if', () => {
    const code = run(
      'let el = null; if (k) { if (j) { el = <B v={b} />; } } return <div>{el}</div>;',
      'k, j, b',
    );
    expectKeyedOn(code, ['k', 'j', 'b']);
  });
});

function runWide(body: string): string {
  const source = `import { B, C } from "x";\nexport function T({ k, b, a, xs }) { ${body} }\n`;
  return compile(source, { preset: 'react', filename: 'input.jsx' }).code;
}

// A write that a loop or an early exit can skip is refused, so the `<div>` gets no block.
function expectRefused(body: string): void {
  const code = runWide(`let el = null; ${body} return <div>{el}</div>;`);
  expect(code).not.toMatch(/= <div>\{el\}<\/div>/);
}

describe('writes that a loop or an early exit can skip', () => {
  const cases: [string, string][] = [
    ['a while loop', 'while (k) { el = <B v={b} />; break; }'],
    ['a for loop', 'for (let i = 0; i < k; i++) { el = <B v={b} />; }'],
    ['a while loop with a test', 'let i = 0; while (i < k) { el = <B v={b} />; i++; }'],
    ['a do while loop', 'do { el = <B v={b} />; } while (k);'],
    ['a continue in for of', 'for (const x of xs) { if (k) continue; el = <B v={b} />; }'],
    [
      'a labeled continue',
      'o: for (const x of xs) { for (const y of xs) { if (k) continue o; el = <B v={b} />; } }',
    ],
    ['a labeled break', 'l: { if (k) break l; el = <B v={b} />; }'],
    [
      'a break before the write in a case',
      'switch (a) { case 1: if (k) break; el = <B v={b} />; }',
    ],
    ['a throw before the write in a try', 'try { if (k) throw 1; el = <B v={b} />; } catch {}'],
  ];
  for (const [name, body] of cases) {
    it(`refuses ${name}`, () => {
      expectRefused(body);
    });
  }

  it('still keys on the test when an early return comes first', () => {
    const code = runWide(
      'if (k) return null; let el = null; if (a) { el = <B v={b} />; } return <div>{el}</div>;',
    );
    expect(code).toMatch(/Object\.is\(\$\[\d+\], a\)/);
  });

  it('still keys on the test of an else if chain', () => {
    const code = runWide(
      'let el = null; if (k) { el = <C v={a} />; } else if (a) { el = <B v={b} />; } return <div>{el}</div>;',
    );
    expect(code).toMatch(/Object\.is\(\$\[\d+\], k\)/);
    expect(code).toMatch(/Object\.is\(\$\[\d+\], a\)/);
  });

  it('still keys on the test of a ??= assignment', () => {
    const code = runWide('let el = null; k && (el ??= <B v={b} />); return <div>{el}</div>;');
    expect(code).toMatch(/Object\.is\(\$\[\d+\], k\)/);
  });
});
