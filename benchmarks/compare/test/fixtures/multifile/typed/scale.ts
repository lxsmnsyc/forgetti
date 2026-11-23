// @ts-nocheck: the counter path resolves only after the harness relinks it.
import { bump } from '../shared/counter.js';

export function scale(n: number): number {
  bump('scale');
  return n * 3;
}
