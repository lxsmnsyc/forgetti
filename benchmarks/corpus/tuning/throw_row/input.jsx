import { Component } from 'react';
import { bump, Row } from '../../shared/counter.js';
class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    const View = this.props.view;
    return <View {...this.props.inner} />;
  }
}
function risky(gate, v) {
  if (gate.left > 0) { gate.left -= 1; throw new Error('once'); }
  bump('risky');
  return v * 2;
}
function Rows({ gate, items }) {
  return <ul>{items.map((item) => <Row key={item.id} item={{ name: risky(gate, item.id) }} />)}</ul>;
}
export function ThrowRow(props) {
  return <Boundary view={Rows} inner={props} />;
}
