import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump } from './counter.js';
function risky(v) {
  bump('risky');
  if (v < 0) throw new Error('neg');
  return v * 2;
}
const _TryCatch = _$$memo(_memo, "_TryCatch", _values => <div>{_values[0]}:{_values[1]}</div>);
export function TryCatch({
  a,
  label
}) {
  let _cache2 = _$$cache(_useMemo, 6),
    out;
  try {
    let _cache = _$$branch(_cache2, 0, 4),
      _value = 0 in _cache ? _cache[0] : _cache[0] = risky,
      _equals = _$$equals(_cache, 1, a),
      _value2 = _equals ? _cache[1] : _cache[1] = a,
      _value3 = _equals ? _cache[2] : _cache[2] = _value(_value2);
    out = _$$equals(_cache, 3, _value3) ? _cache[3] : _cache[3] = _value3;
  } catch (e) {
    out = 'err';
  }
  let _equals3 = _$$equals(_cache2, 1, label),
    _value5 = _equals3 ? _cache2[1] : _cache2[1] = label,
    _equals4 = _$$equals(_cache2, 2, out),
    _value6 = _equals4 ? _cache2[2] : _cache2[2] = out,
    _value7 = _equals3 && _equals4 ? _cache2[3] : _cache2[3] = [_value5, _value6],
    _equals6 = _$$equals(_cache2, 4, _value7),
    _value8 = _equals6 ? _cache2[4] : _cache2[4] = _value7;
  return /*@forgetti jsx*/_equals6 ? _cache2[5] : _cache2[5] = <_TryCatch v={_value8} />;
}