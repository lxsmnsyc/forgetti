import { describe, expect, it } from 'vitest';
import { compile } from '../../../src/next';

function run(source: string): string {
  return compile(source, { preset: 'react', filename: 'input.jsx' }).code;
}

describe('host-only blocks', () => {
  it('leaves a returned host element with many inputs uncached', () => {
    const code = run(
      'export function T({ a, b, c, d }) { return <div><p>{a}</p><p>{b}</p><p>{c}</p><p>{d}</p></div>; }\n',
    );

    // The four paragraphs keep their blocks. The wrapper has no block of its own.
    expect(code).toContain('return <div>{$[1]}{$[3]}{$[5]}{$[7]}</div>;');
    expect(code).toContain('useCache(useRef, 8)');
  });

  it('keeps a block that holds a component element', () => {
    const code = run(
      'import { A } from "x";\nexport function T({ a, b, c, d }) { return <div><A v={a} w={b} x={c} y={d} /></div>; }\n',
    );

    expect(code).toContain('Object.is($[3], d)');
  });

  it('keeps a block that calls a function', () => {
    const code = run(
      'import { f } from "x";\nexport function T({ a, b, c, d }) { return <div>{f(a, b, c, d)}</div>; }\n',
    );

    expect(code).toContain('Object.is($[3], d)');
  });

  it('keeps a host element that a component receives', () => {
    const code = run(
      'import { A } from "x";\nexport function T({ a, b, c, d }) { return <A icon={<i>{a}{b}{c}{d}</i>} />; }\n',
    );

    expect(code).toContain('Object.is($[3], d)');
  });

  it('keeps a host element that is stored in a variable', () => {
    const code = run(
      'import { A } from "x";\nexport function T({ a, b, c, d }) { const el = <i>{a}{b}{c}{d}</i>; return <A icon={el} />; }\n',
    );

    expect(code).toContain('Object.is($[3], d)');
  });
});
