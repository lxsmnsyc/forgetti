import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Child } from './counter.js';
const _Ternary2 = _$$memo(_memo, "_Ternary2", _values => {
  const _Ternary = _values[0];
  return <div><_Ternary v={_values[1]} /></div>;
});
const _Ternary4 = _$$memo(_memo, "_Ternary4", _values2 => {
  const _Ternary3 = _values2[0];
  return <span><_Ternary3 v={_values2[1]} /></span>;
});
export function Ternary({
  ok,
  a,
  b
}) {
  let _cache = _$$cache(_useMemo, 3),
    _value;
  if (_$$equals(_cache, 0, ok) ? _cache[0] : _cache[0] = ok) {
    let _cache2 = _$$branch(_cache, 1, 5),
      _value3 = 0 in _cache2 ? _cache2[0] : _cache2[0] = Child,
      _equals2 = _$$equals(_cache2, 1, a),
      _value4 = _equals2 ? _cache2[1] : _cache2[1] = a,
      _value5 = _equals2 ? _cache2[2] : _cache2[2] = [_value3, _value4],
      _equals3 = _$$equals(_cache2, 3, _value5),
      _value6 = _equals3 ? _cache2[3] : _cache2[3] = _value5;
    _value = _equals3 ? _cache2[4] : _cache2[4] = /*@forgetti jsx*/<_Ternary2 v={_value6} />;
  } else {
    let _cache3 = _$$branch(_cache, 2, 5),
      _value8 = 0 in _cache3 ? _cache3[0] : _cache3[0] = Child,
      _equals4 = _$$equals(_cache3, 1, b),
      _value9 = _equals4 ? _cache3[1] : _cache3[1] = b,
      _value0 = _equals4 ? _cache3[2] : _cache3[2] = [_value8, _value9],
      _equals5 = _$$equals(_cache3, 3, _value0),
      _value1 = _equals5 ? _cache3[3] : _cache3[3] = _value0;
    _value = _equals5 ? _cache3[4] : _cache3[4] = /*@forgetti jsx*/<_Ternary4 v={_value1} />;
  }
  return _value;
}