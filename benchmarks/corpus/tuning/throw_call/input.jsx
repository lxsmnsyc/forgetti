import { Component } from 'react';
import { bump } from '../../shared/counter.js';
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
function Inner({ gate, a, tag }) {
  const v = risky(gate, a);
  return <p>{tag}:{v}</p>;
}
export function ThrowCall(props) {
  return <Boundary view={Inner} inner={props} />;
}
