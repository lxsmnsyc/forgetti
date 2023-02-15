# stellis

> A no-VDOM, JSX framework for SSR

[![NPM](https://img.shields.io/npm/v/stellis.svg)](https://www.npmjs.com/package/stellis) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

### Install

```bash
npm install --save stellis
```

```bash
yarn add stellis
```

```bash
pnpm add stellis
```

## Setup for classic JSX

### Comment pragmas (Babel, Typescript, ESBuild etc.)

- Automatic runtime

  ```js
  /* @jsxRuntime automatic */
  /* @jsxImportSource stellis */
  ```

- Classic runtime

  ```js
  /* @jsxRuntime classic */
  /* @jsx h */
  /* @jsxFrag Fragment */
  import { h, Fragment } from 'stellis';
  ```

### Typescript

Reference: https://www.typescriptlang.org/docs/handbook/jsx.html#configuring-jsx

- Automatic runtime

  ```json
  {
    "compilerOptions": {
      "jsx": "react-jsx", // or "react-jsxdev"
      "jsxImportSource": "stellis",
    }
  }
  ```

- Classic runtime

  ```json
  {
    "compilerOptions": {
      "jsx": "react",
      "jsxFactory": "h",
      "jsxFragmentFactory": "Fragment"
    }
  }
  ```

```js
import { h, Fragment } from 'stellis';
```

### ESBuild

Reference: https://esbuild.github.io/api/#transformation

- Automatic runtime
  - CLI

    ```bash
    esbuild --jsx=automatic --jsx-import-source="stellis" --jsx-dev
    ```

  - Options

    ```js
    const option = {
      jsx: 'automatic',
      jsxDev: true | false,
      jsxImportSource: 'stellis',
    };
    ```

- Classic runtime (as options)
  - CLI

    ```bash
    esbuild --jsx=transform --jsx-factory=h --jsx-fragment=Fragment
    ```

  - Options

    ```js
    const option = {
      jsx: 'transform',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
    };
    ```

## Setup for optimized JSX

### Babel

Stellis uses [Babel](https://babeljs.io/) to transform your JSX and is provided in the form a plugin exported through `stellis/babel`.

### Integrations

- Rollup (SOON)
- Vite (SOON)
- ESBuild (SOON)

## Usage

### Rendering JSX

```js
import { render } from 'stellis';

const result = await render(<h1>Hello World</h1>);
console.log(result); // <h1>Hello World</h1>
```

Stellis JSX is unlike your usual, React-like JSX:

- Stellis has no VDOM
  - The babel compiler will always generate optimized templates from the JSX
- Stellis' attributes are closer to HTML
  - React introduced some properties like `className`, `htmlFor` and `readOnly` to be closer to DOM than HTML, which is the opposite of Stellis, where you can write `class`, `html` and `readonly`.
- Rendering is always async

### Writing your first component

```js
function Message({ greeting, receiver }) {
  return <h1>{greeting}, {receiver}</h1>;
}

const result = await render(
  <Message greeting="Hello" receiver="World" />
); // <h1>Hello World</h1>
```

### Async components

```js
async function Profile({ id }) {
  const user = await getUser(id);

  return <ProfileDetails user={user} />;
} 
```

```js
async function Profile({ id }) {
  return <ProfileDetails user={await getUser(id)} />;
} 
```

### Attributes

#### `class` and `class:<name>` directives

```js
<h1 class="example">Hello</h1>
<h1 class={["a", condB && b]}>Array</h1>
<h1 class={{ a: true, b: condB, c: condC }}>Object</h1>
<h1 class={["a", { b: condB }, [condC && "c"]]}>Nested</h1>
```

```js
<h1 class:example>Hello</h1>
<h1 class:a class:b={cond}>Another Example</h1>
```

#### `style` and `style:<property>` directives

```js
<h1 style={{color: "red"}}>Red Heading</h1>
<h1 style:color="red">Red Heading 2</h1>
```

#### `set:html`

Sets the raw HTML content of the given element. Always takes priority over `children`.

```js
<div set:html="<script>Hello World</script>" />
```

### Built-in Components

#### `ErrorBoundary`/`<stellis:boundary>`

Attempts to render `children`. If it receives an error, `fallback` is called with the received error and the result is rendered instead.

```js
import { ErrorBoundary, render } from 'stellis';

function FailingComponent() {
  throw new Error('Example');
}

const result = await render(
  <ErrorBoundary
    fallback={(error) => <>
      <h1>Error: {error.name}</h1>
      <p>Message: {error.message}</p>
    </>}
  >
    <FailingComponent />
  </ErrorBoundary>
);
console.log(result);
// Output: <h1>Error: Error</h1><p>Message: Example</p>
```

#### `Fragment`/`<stellis:fragment>`

Same behavior as `<></>` except this allows raw HTML output with `set:html`

```js
<Fragment set:html="<script>Hello World</script>" />
<stellis:fragment set:html="<script>Hello World</script>" />
```

#### `Comment`/`<stellis:comment>`

Allow inserting HTML comments

```js
<stellis:comment value="This is a comment." />
// Output: <!--This is a comment.-->
```

#### `Dynamic`

```js
import { Dynamic, render } from 'stellis';

function Example({ as, children }) {
  return <Dynamic component={as}>{children}</Dynamic>;
}

const result = await render(
  <Example as="h1">Hello World</Example>
);
console.log(result);
// Output: <h1>Hello World</h1>
```

### Context API

```js
import { createContext, setContext, getContext, render } from 'stellis';

const message = createContext('Hello World');

function Parent({ children }) {
  setContext(message, 'Bonjour World');

  return children;
}

function Child() {
  return <h1>{getContext(message)}</h1>; // Hello World
}

const result = await render(
  <>
    <Parent>
      <Child />
    </Parent>
    <Child />
  </>
);

console.log(result);

// Output
// <h1>Bonjour World</h1><h1>Hello World</h1>
```

### Stellis meta

Built-in components that renders after the markup has resolved. Both `<stellis:head>` and `<stellis:body>` has the types `"pre"` and `"post"` which defines where the children are going to be injected.

#### `Head`/`<stellis:head>`

```js
<stellis:head type="pre">
  <title>Hello World</title>
</stellis:head>
```

#### `Body`/`<stellis:body>`

```js
<stellis:body type="post">
  <script src="./my-script.js" />
</stellis:body>
```

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
