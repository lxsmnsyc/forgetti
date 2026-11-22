import { Component, useState, useEffect } from 'react';
import { bump } from '../../shared/counter.js';
function risky(gate, v) {
  if (gate.left > 0) { gate.left -= 1; throw new Error('armed'); }
  bump('risky');
  return v * 2;
}
class Swap extends Component {
  constructor(props) {
    super(props);
    this.state = { safe: false };
    globalThis.__reset = () => this.setState({ safe: false });
  }
  static getDerivedStateFromError() { return { safe: true }; }
  render() { return <Live safe={this.state.safe} {...this.props.inner} />; }
}
function Live({ safe, gate, a, tag }) {
  const [, setN] = useState(0);
  useEffect(() => { globalThis.__setN = setN; }, []);
  const v = safe ? a : risky(gate, a);
  return <p>{tag}:{v}</p>;
}
export function ThrowSwap(props) {
  return <Swap inner={props} />;
}
