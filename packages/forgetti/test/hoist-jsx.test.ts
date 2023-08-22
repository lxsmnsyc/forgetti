/* eslint-disable no-template-curly-in-string */
import * as babel from '@babel/core';
import { describe, it } from 'vitest';
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

describe('hoist jsx', () => {
  it('children', async ({ expect }) => {
    const code = `
var Foo = function({ className }) {
  return <div className={className}>
    <span />
  </div>;
};
  `;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('class-assign-unreferenced-param-deopt', async ({ expect }) => {
    const code = `
import React from 'react';

// Regression test for https://github.com/babel/babel/issues/5552
class BugReport extends React.Component {
    thisWontWork = ({ color }) => (data) => {
        return <div color={ color }>does not reference data</div>;
    };

    thisWorks = ({ color }) => (data) => {
        return <div color={ color }>{ data }</div>;
    };

    render() {
        return <div />
    }
}
  `;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('compund-assignment', async ({ expect }) => {
    const code = `
import React from 'react';
import Loader from 'loader';

const errorComesHere = () => <Loader className="full-height"/>,
  thisWorksFine = () => <Loader className="p-y-5"/>;
  `;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('constructor', async ({ expect }) => {
    const code = `
var Foo = require("Foo");

function render() {
  return <Foo />;
}
  `;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('deep-constant-violation', async ({ expect }) => {
    const code = `
function render() {
  var children = <b></b>;

  if (someCondition) {
    children = <span></span>;
  }

  return <div>{children}</div>;
}
  `;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('deopt-mutable', async ({ expect }) => {
    const code = `
let foo = 'hello';

export const Component = () => {
  foo = 'goodbye';
  return <span>{foo}</span>;
};
  `;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('deopt-mutable-complex', async ({ expect }) => {
    const code = `
let foo = 'hello';

const mutate = () => {
  foo = 'goodbye';
}

export const Component = () => {
  if (Math.random() > 0.5) mutate();
  return <span>{foo}</span>;
};
  `;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('destructuring', async ({ expect }) => {
    const code = `
import Link from 'next/link';
import Component from 'component';

const AnchorLink = ({ isExternal, children }) => {
  if (isExternal) {
    return (<a>{children}</a>);
  }

  return (<Link>{children}</Link>);
}

function renderProp({ text, className, id }) {
  return () => (<Component text={text} className={className} id={id} />);
}

function excludePropFromRenderProp({ text, className, id, ...props }) {
  // intentionally ignoring props
  return () => (<Component text={text} className={className} id={id} />);
}

function renderPropSpread({ text, className, id, ...props }) {
  return () => (<Component text={text} className={className} id={id} {...props} />);
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('dont hoist before class', async ({ expect }) => {
    const code = `
import React from "react";

const Parent = ({}) => (
  <div className="parent">
    <Child/>
  </div>
);

export default Parent;

let Child = () => (
  <div className="child">
    ChildTextContent
  </div>
);
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('dont-hoist-before-default-params', async ({ expect }) => {
    const code = `
function renderA(Component, text = '') {
  return function() {
    return <Component text={text} />;
  }
}

function renderB(title= '') {
  return () => (
    <Component title={title} />
  );
}
`;

    expect(await compile(code)).toMatchSnapshot();
  });

  it('dont hoist before HoC', async ({ expect }) => {
    const code = `
import React from "react";

const HOC = component => component;

const Parent = ({}) => (
  <div className="parent">
    <Child/>
  </div>
);

export default Parent;

let Child = () => (
  <div className="child">
    ChildTextContent
  </div>
);
Child = HOC(Child);
`;

    expect(await compile(code)).toMatchSnapshot();
  });

  it('dont hoist blocked scoped variables', async ({ expect }) => {
    const code = `
function render(flag) {
  if (flag) {
    let bar = "bar";

    [].map(() => bar);

    return <foo bar={bar} />;
  }

  return null;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('dont hoist to same function', async ({ expect }) => {
    const code = `
function renderSome(a, b) {
  if (a) {
    return <div>{b}</div>
  } else {
    return <span>{b}</span>
  }
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('for-loop', async ({ expect }) => {
    const code = `
function renderA() {
  const nodes = [];

  for (let i = 0; i < 5; i++) {
    const o = "foo";
    const n = i;
    nodes.push(<div>{n}</div>);
  }

  return nodes;
}

function renderB() {
  const nodes = [];

  for (let i = 0; i < 5; i++) {
    const o = "foo";
    const n = i;
    nodes.push(<div>{n}</div>);
  }

  return nodes;
}

function renderC() {
  const nodes = [];

  for (const node of nodes) {
    nodes.push(<div>{node}</div>);
  }

  return nodes;
}

function renderD() {
  const nodes = [];

  for (const node of nodes) {
    const n = node;
    nodes.push(<div>{n}</div>);
  }

  return nodes;
}

function renderE() {
  const nodes = [];

  for (let i = 0; i < 5; i++) {
    const o = "foo";
    const n = i;
    nodes.push(<div>{o}</div>);
  }

  return nodes;
}
`;

    expect(await compile(code)).toMatchSnapshot();
  });

  it('function parameter', async ({ expect }) => {
    const code = `
function render(text) {
  return function () {
    return <foo>{text}</foo>;
  };
}

var Foo2 = require("Foo");

function createComponent(text) {
  return function render() {
    return <Foo2>{text}</Foo2>;
  };
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('global variable', async ({ expect }) => {
    const code = `
const Foo = () => <div foo={navigator.vendor} />;
`;

    expect(await compile(code)).toMatchSnapshot();
  });

  it('html element', async ({ expect }) => {
    const code = `
function renderA() {
  return <foo />;
}

function renderB() {
  return <div className="foo"><input type="checkbox" checked={true} /></div>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('append to end whrn declared in scope', async ({ expect }) => {
    const code = `
const AppItem = () => {
  return <div>child</div>;
};

export class App extends React.Component {
  render() {
    return (
      <div>
        <p>Parent</p>
        <AppItem />
      </div>
    );
  }
}

(function () {
  class App extends React.Component {
    render() {
      return (
        <div>
          <p>Parent</p>
          <AppItem />
        </div>
      );
    }
  }

  const AppItem = () => {
    return <div>child</div>;
  };
});

(function () {
  const AppItem = () => {
    return <div>child</div>;
  };

  class App extends React.Component {
    render() {
      return (
        <div>
          <p>Parent</p>
          <AppItem />
        </div>
      );
    }
  }
});

export class App2 extends React.Component {
  render() {
    return (
      <div>
        <p>Parent</p>
        <AppItem2 />
      </div>
    );
  }
}

const AppItem2 = () => {
  return <article>child</article>;
};
`;

    expect(await compile(code)).toMatchSnapshot();
  });

  it('React.lazy components', async ({ expect }) => {
    const code = `
import React from "react";
import OtherComponent from "./components/other-component";

export default function App() {
  return (
    <div>
      <LazyComponent />
      <OtherComponent />
    </div>
  );
}

const LazyComponent = React.lazy(() => import("./components/lazy-component"));
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('inline-elements', async ({ expect }) => {
    const code = `
function render() {
  var text = getText();
  return function () {
    return <foo>{text}</foo>;
  };
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('babel issue #11686', async ({ expect }) => {
    const code = `
function outer(arg) {
  const valueB = null;
  const valueA = {};

  function inner() {
    console.log(
      <A keyA={valueA}>
        <B keyB={valueB}>
          <C keyC={arg} />
        </B>
      </A>
    );
  }

  inner();
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('jsx in prop', async ({ expect }) => {
    const code = `
function A() {
  return <div attr={<span />} />;
}
function B({ x }) {
  return <div x={x} attr={<span />} />;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('magic binding', async ({ expect }) => {
    const code = `
function thisExpr() {
  return <p>{this.Foo}</p>;
}
function thisJSX() {
  return <this.Foo />;
}

class A extends B {
  superExpr() {
    return <p>{super.Foo}</p>;
  }
  superJSX() {
    return <super.Foo />;
  }
}

function argumentsExpr() {
  return <p>{arguments.Foo}</p>;
}
function argumentsJSX() {
  return <arguments.Foo />;
}

function newTargetExpr() {
  return <p>{new.target.Foo}</p>;
}
function newTargetJSX() {
  return <new.target.Foo />;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('member expression', async ({ expect }) => {
    const code = `
// constant member expression
function renderA() {
  this.component = "div";
  return () => <this.component />;
}
// this member expression
class ComponentB extends React.Component {
  subComponent = () => <span>Sub Component</span>

  render = () => <this.subComponent />
}
// object member expression
const els = {
  subComponent: () => <span>Sub Component</span>
};
class ComponentC extends React.Component {
  render = () => <els.subComponent />
}
`;

    expect(await compile(code)).toMatchSnapshot();
  });

  it('namespace', async ({ expect }) => {
    const code = `
function AComponent () {
  return <BComponent/>

  function BComponent () {
    return <n:CComponent />
  }
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('param and var', async ({ expect }) => {
    const code = `
function fn(Component, obj) {

  var data = obj.data;

  return () => <Component prop={data} />;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('param reference', async ({ expect }) => {
    const code = `
function render() {
  return function (text) {
    return <div>{text}</div>;
  };
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('pure deopt mutable', async ({ expect }) => {
    const code = `
// https://github.com/facebook/react/issues/3226
// Not safe to reuse because it is mutable
function render() {
  return <div style={{ width: 100 }} />;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('pure expression', async ({ expect }) => {
    const code = `
function render(offset) {
  return function () {
    return <div tabIndex={offset + 1} />;
  };
}

const OFFSET = 3;

var Foo = () => (
  <div tabIndex={OFFSET + 1} />
);

const Bar = () => {
  return (
    <div data-text={
      "Some text, " +
      "and some more too."
    } />
  );
};
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('reassign', async ({ expect }) => {
    const code = `
function render(text) {
  text += "yes";

  return function () {
    return <div>{text}</div>;
  };
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('should ignore ref', async ({ expect }) => {
    const code = `
import { useRef } from 'react';
function Foo() {
  const ref = useRef();
  return <foo ref={ref} />;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('babel issue #14363', async ({ expect }) => {
    const code = `
import { Routes, Route } from "react-router";
import { router } from "common/router";

function RoutesComponent() {
  return <Routes>
      {Object.keys(router).map(routerKey => {
      const route = router[routerKey];

      if (route && route.element) {
        const {
          path,
          element: Component
        } = route;
        // Component should not be hoisted
        return <Route key={routerKey} path={path} element={<Component />} />;
      } else {
        return null;
      }
    }).filter(Boolean)}
    </Routes>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('deopt spread prop', async ({ expect }) => {
    const code = `
function render() {
  return <foo {...foobar} />;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });

  it('text children', async ({ expect }) => {
    const code = `
function Text() {
  return <div className="class-name">
    Text
  </div>;
}
`;
    expect(await compile(code)).toMatchSnapshot();
  });
});
