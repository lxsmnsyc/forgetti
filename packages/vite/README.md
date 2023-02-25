# vite-plugin-forgetti

> Vite plugin for [`forgetti`](https://github.com/lxsmnsyc/forgetti)

[![NPM](https://img.shields.io/npm/v/vite-plugin-forgetti.svg)](https://www.npmjs.com/package/vite-plugin-forgetti) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install --D vite-plugin-forgetti
```

```bash
yarn add -D vite-plugin-forgetti
```

```bash
pnpm add -D vite-plugin-forgetti
```

## Usage

```js
import forgetti from 'vite-plugin-forgetti';

///...
forgetti({
  preset: 'react',
  filter: {
    include: 'src/**/*.{ts,js,tsx,jsx}',
    exclude: 'node_modules/**/*.{ts,js,tsx,jsx}',
  },
})
```

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
