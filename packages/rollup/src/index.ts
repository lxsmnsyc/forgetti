import forgettiBabel, { Options } from 'forgetti';
import { Plugin } from 'rollup';
import { createFilter, FilterPattern } from '@rollup/pluginutils';
import * as babel from '@babel/core';
import path from 'path';
import ts from '@babel/preset-typescript';

export interface ForgettiPluginFilter {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export interface ForgettiPluginOptions extends Options {
  filter?: ForgettiPluginFilter;
  babel?: babel.TransformOptions;
}

const DEFAULT_INCLUDE = 'src/**/*.{jsx,tsx,ts,js,mjs,cjs}';
const DEFAULT_EXCLUDE = 'node_modules/**/*.{jsx,tsx,ts,js,mjs,cjs}';

export default function forgettiPlugin(
  options: ForgettiPluginOptions = { preset: 'react' },
): Plugin {
  const filter = createFilter(
    options.filter?.include || DEFAULT_INCLUDE,
    options.filter?.exclude || DEFAULT_EXCLUDE,
  );
  const preset = options.preset;
  return {
    name: 'forgetti',
    async transform(code, id) {
      if (filter(id)) {
        const result = await babel.transformAsync(code, {
          ...options.babel,
          presets: [
            [ts],
            ...(options.babel?.presets ?? []),
          ],
          plugins: [
            [forgettiBabel, { preset }],
            ...(options.babel?.plugins ?? []),
          ],
          filename: path.basename(id),
        });

        if (result) {
          return {
            code: result.code ?? '',
            map: result.map,
          };
        }
      }
      return undefined;
    },
  };
}