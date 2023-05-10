/* eslint-disable no-template-curly-in-string */
import * as babel from '@babel/core';
import { describe, expect, it } from 'vitest';
import type { Options } from '../src';
import plugin from '../src';

const options: Options = {
  preset: 'react',
};

async function compile(code: string): Promise<string> {
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

describe('hooks', () => {
  it('should optimize useRef', async () => {
    const code = `
import { useRef } from 'react';
function Example(props) {
  return useRef(props.value);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useMemo', async () => {
    const code = `
import { useMemo } from 'react';
function Example(props) {
  return useMemo(() => props.value(), [props.value]);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useMemo with 0 dependencies', async () => {
    const code = `
import { useMemo } from 'react';
function Example(props) {
  return useMemo(() => props.value(), []);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useMemo with auto dependencies', async () => {
    const code = `
import { useMemo } from 'react';
function Example(props) {
  return useMemo(() => props.value());
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useCallback', async () => {
    const code = `
import { useCallback } from 'react';
function Example(props) {
  return useCallback(() => props.value(), [props.value]);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useCallback with 0 dependencies', async () => {
    const code = `
import { useCallback } from 'react';
function Example(props) {
  return useCallback(() => props.value(), []);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useCallback with auto dependencies', async () => {
    const code = `
import { useCallback } from 'react';
function Example(props) {
  return useCallback(() => props.value());
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useEffect', async () => {
    const code = `
import { useEffect } from 'react';
function Example(props) {
  useEffect(() => props.value(), [props.example]);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useEffect with 0 dependencies', async () => {
    const code = `
import { useEffect } from 'react';
function Example(props) {
  useEffect(() => props.value(), []);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should optimize useEffect with auto dependencies', async () => {
    const code = `
import { useEffect } from 'react';
function Example(props) {
  useEffect(() => props.value());
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should correct transform nested hooks call (issue #14)', async () => {
    const code = `
import { useDeferredValue } from 'react';
import { useAtomValue } from 'jotai';
import { stateAtom } from 'whatever';
function Example(props) {
  return useDeferredValue(useAtomValue(stateAtom));
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should correct transform any nested hooks call', async () => {
    const code = `
import { useA, useB, useC, useD, useE, useF, useG, useH } from 'whatever'

function Example(props) {
  let a = null;
  return useA(
    useB(),
    [useC(), 'array'],
    { d: useD(), [useE()]: useF(), ...useG() },
    \`testA\${useH()}testB\`,
    useI() === useJ(),
    (a = useK()),
    ...useJ()
  );
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
  it('should correct transform derived hooks call', async () => {
    const code = `
import { useA, useB, useC } from 'whatever'

function Example(props) {
  let a = null;
  return {
    [useA()]: useB(),
    ...useC(),
    [\`testA\${useH()}testB\`]: useI() === useJ(),
    a: useK() ? 'a' : 'b'
  }
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
});
