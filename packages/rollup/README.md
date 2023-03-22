# rollup-plugin-forgetti

> Rollup plugin for [`forgetti`](https://github.com/lxsmnsyc/forgetti)

[![NPM](https://img.shields.io/npm/v/rollup-plugin-forgetti.svg)](https://www.npmjs.com/package/rollup-plugin-forgetti) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install forgetti
npm install --D rollup-plugin-forgetti
```

```bash
yarn add forgetti
yarn add -D rollup-plugin-forgetti
```

```bash
pnpm add forgetti
pnpm add -D rollup-plugin-forgetti
```

## Usage

```js
import forgetti from 'rollup-plugin-forgetti';

///...
forgetti({
  preset: 'react',
  filter: {
    include: 'src/**/*.{ts,js,tsx,jsx}',
    exclude: 'node_modules/**/*.{ts,js,tsx,jsx}',
  },
})
```

> **Note**
> When you are using a React Rollup plugin, make sure that forgetti runs first.

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
