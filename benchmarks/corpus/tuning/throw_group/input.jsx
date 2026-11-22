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
function sumOf(list) { bump('sum'); return list.reduce((s, v) => s + v, 0); }
function peakOf(gate, list) { return risky(gate, Math.max(...list)); }
function Inner({ gate, list, tag }) {
  const total = sumOf(list);
  const peak = peakOf(gate, list);
  const label = tag + ':' + total + '/' + peak;
  return <p>{label}</p>;
}
export function ThrowGroup(props) {
  return <Boundary view={Inner} inner={props} />;
}
