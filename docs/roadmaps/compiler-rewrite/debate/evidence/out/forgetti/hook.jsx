import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { bump } from './counter.js';
function costly(k, v) {
  bump(k);
  return v * 2;
}
function useThing(a, b) {
  let _cache = _$$cache(_useMemo, 9),
    _value = 0 in _cache ? _cache[0] : _cache[0] = costly,
    _equals = _$$equals(_cache, 1, a),
    _value2 = _equals ? _cache[1] : _cache[1] = a,
    _value3 = _equals ? _cache[2] : _cache[2] = _value('x', _value2),
    _equals2 = _$$equals(_cache, 3, _value3),
    _value4 = _equals2 ? _cache[3] : _cache[3] = _value3,
    _value5 = 4 in _cache ? _cache[4] : _cache[4] = costly,
    _equals3 = _$$equals(_cache, 5, b),
    _value6 = _equals3 ? _cache[5] : _cache[5] = b,
    _value7 = _equals3 ? _cache[6] : _cache[6] = _value5('y', _value6),
    _equals4 = _$$equals(_cache, 7, _value7),
    _value8 = _equals4 ? _cache[7] : _cache[7] = _value7;
  return _equals2 && _equals4 ? _cache[8] : _cache[8] = {
    x: _value4,
    y: _value8
  };
}
const _HookUser = _$$memo(_memo, "_HookUser", _values => <b>{_values[0]}:{_values[1]}</b>);
export function HookUser({
  a,
  b
}) {
  let _cache2 = _$$cache(_useMemo, 7);
  const {
    x,
    y
  } = useThing(_$$equals(_cache2, 0, a) ? _cache2[0] : _cache2[0] = a, _$$equals(_cache2, 1, b) ? _cache2[1] : _cache2[1] = b);
  let _equals8 = _$$equals(_cache2, 2, x),
    _value10 = _equals8 ? _cache2[2] : _cache2[2] = x,
    _equals9 = _$$equals(_cache2, 3, y),
    _value11 = _equals9 ? _cache2[3] : _cache2[3] = y,
    _value12 = _equals8 && _equals9 ? _cache2[4] : _cache2[4] = [_value10, _value11],
    _equals1 = _$$equals(_cache2, 5, _value12),
    _value13 = _equals1 ? _cache2[5] : _cache2[5] = _value12;
  return /*@forgetti jsx*/_equals1 ? _cache2[6] : _cache2[6] = <_HookUser v={_value13} />;
}