import forgettiBabel, { Options } from 'forgetti';
import { Plugin } from 'vite';
import { createFilter, FilterPattern } from '@rollup/pluginutils';
import * as babel from '@babel/core';
import ts from '@babel/preset-typescript';
import path from 'path';

export interface ForgettiPluginFilter {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export interface ForgettiPluginOptions extends Options {
  filter?: ForgettiPluginFilter;
  babel?: babel.TransformOptions;
}

// From: https://github.com/bluwy/whyframe/blob/master/packages/jsx/src/index.js#L27-L37
function repushPlugin(plugins: Plugin[], plugin: Plugin, pluginNames: string[]) {
  const namesSet = new Set(pluginNames);

  let baseIndex = -1;
  let targetIndex = -1;
  for (let i = 0, len = plugins.length; i < len; i += 1) {
    const current = plugins[i];
    if (namesSet.has(current.name) && baseIndex === -1) {
      baseIndex = i;
    }
    if (current.name === 'forgetti') {
      targetIndex = i;
    }
  }
  if (baseIndex !== -1 && targetIndex !== -1) {
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
  const preset = options.preset;
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
        "vite:preact-jsx",
      ]);
    },
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
          ast: false,
          sourceMaps: true,
          configFile: false,
          babelrc: false,
          sourceFileName: id,
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

  return plugin;
}