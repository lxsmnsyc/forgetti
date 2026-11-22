import { bump, Child } from '../../shared/counter.js';
export function JsxProps(props) {
  return (
    <section className={props.cls}>
      <Child v={props.x} />
      <Child v={props.y} />
    </section>
  );
}
