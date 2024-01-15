import * as babel from '@babel/core';
import { describe, it } from 'vitest';
import type { Options } from '../src';
import plugin from '../src';

const options: Options = {
  preset: 'react',
};

async function compile(code: string): Promise<string> {
  const result = await babel.transformAsync(code, {
    plugins: [[plugin, options]],
    parserOpts: {
      plugins: ['jsx'],
    },
  });

  return result?.code ?? '';
}

describe('statements', () => {
  it('should optimize for-of statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    for (const x of props.arr) {
      console.log(x);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize for-in statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    for (const x in props.arr) {
      console.log(x);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize for statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    for (let i = 0; i < 10; i += 1) {
      console.log(i);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize while statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    let i = 0;
    while (i < props.x) {
      console.log(i);
      i += 1;
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize do-while statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    let i = 0;
    do {
      console.log(i);
      i += 1;
    } while (i < props.x)
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize switch statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    switch (props.type) {
      case 'a':
        return examples.a(props.value);
      case 'b':
        return examples.b(props.value);
      case 'c':
        return examples.c(props.value);
      default:
        return examples.default(props.value);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize if statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    if (props.type === 'a') {
      return examples.a(props.value);
    } else {
      return examples.b(props.value);
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize try statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    try {
      props.a();
    } catch (e) {
      props.b(e);
    } finally {
      props.c();
    }
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize throw statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    throw createError(props.message);
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize labeled statements', async ({ expect }) => {
    const code = `
  function Example(props) {
    foo: {
      console.log("face");
      break foo;
      console.log("this will not be executed");
    }
    console.log("swap");
  }
  `;
    expect(await compile(code)).toMatchSnapshot();
  });
});
