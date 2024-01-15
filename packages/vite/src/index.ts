import type { Options } from 'forgetti';
import forgettiBabel from 'forgetti';
import type { Plugin } from 'vite';
import type { FilterPattern } from '@rollup/pluginutils';
import { createFilter } from '@rollup/pluginutils';
import * as babel from '@babel/core';
import path from 'node:path';

export interface ForgettiPluginFilter {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export interface ForgettiPluginOptions extends Options {
  filter?: ForgettiPluginFilter;
  babel?: babel.TransformOptions;
}

// From: https://github.com/bluwy/whyframe/blob/master/packages/jsx/src/index.js#L27-L37
function repushPlugin(
  plugins: Plugin[],
  plugin: Plugin,
  pluginNames: string[],
): void {
  const namesSet = new Set(pluginNames);

  let baseIndex = -1;
  let targetIndex = -1;
  for (let i = 0, len = plugins.length; i < len; i += 1) {
    const current = plugins[i];
    if (namesSet.has(current.name) && baseIndex === -1) {
      baseIndex = i;
    }
    if (current.name === plugin.name) {
      targetIndex = i;
    }
  }
  if (baseIndex !== -1 && targetIndex !== -1 && baseIndex < targetIndex) {
    plugins.splice(targetIndex, 1);
    plugins.splice(baseIndex, 0, plugin);
  }
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
  const { preset } = options;
  const plugin: Plugin = {
    name: 'forgetti',
    enforce: 'pre',
    configResolved(config) {
      // run our plugin before the following plugins:
      repushPlugin(config.plugins as Plugin[], plugin, [
        // https://github.com/withastro/astro/blob/main/packages/astro/src/vite-plugin-jsx/index.ts#L173
        'astro:jsx',
        // https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react
        'vite:react-babel',
        'vite:react-jsx',
        // https://github.com/preactjs/preset-vite/blob/main/src/index.ts
        'vite:preact-jsx',
      ]);
    },
    async transform(code, id) {
      if (filter(id)) {
        const pluginOption = [forgettiBabel, { preset }];
        const plugins: NonNullable<
          NonNullable<babel.TransformOptions['parserOpts']>['plugins']
        > = ['jsx'];
        if (/\.[mc]?tsx?$/i.test(id)) {
          plugins.push('typescript');
        }
        const result = await babel.transformAsync(code, {
          ...options.babel,
          plugins: [pluginOption, ...(options.babel?.plugins || [])],
          parserOpts: {
            ...(options.babel?.parserOpts || {}),
            plugins: [
              ...(options.babel?.parserOpts?.plugins || []),
              ...plugins,
            ],
          },
          filename: path.basename(id),
          ast: false,
          sourceMaps: true,
          configFile: false,
          babelrc: false,
          sourceFileName: id,
        });

        if (result) {
          return {
            code: result.code || '',
            map: result.map,
          };
        }
      }
      return undefined;
    },
  };

  return plugin;
}
