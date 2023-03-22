module.exports = {
  "root": true,
  "extends": [
    "lxsmnsyc/typescript"
  ],
  "parserOptions": {
    "project": "./tsconfig.eslint.json",
    "tsconfigRootDir": __dirname,
  },
  "rules": {
    "no-param-reassign": "off"
  }
};