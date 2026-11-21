import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump } from './counter.js';
function costly(k, v) {
  bump(k);
  return v * 2;
}
const _Derived = _$$memo(_memo, "_Derived", _values => <div>{_values[0]}-{_values[1]}-{_values[2]}</div>);
export function Derived({
  a,
  b
}) {
  let _cache = _$$cache(_useMemo, 13),
    _value = 0 in _cache ? _cache[0] : _cache[0] = costly,
    _equals = _$$equals(_cache, 1, a),
    _value2 = _equals ? _cache[1] : _cache[1] = a;
  const x = _equals ? _cache[2] : _cache[2] = _value('x', _value2);
  let _equals2 = _$$equals(_cache, 3, x),
    _value4 = _equals2 ? _cache[3] : _cache[3] = x,
    _value5 = 4 in _cache ? _cache[4] : _cache[4] = costly,
    _equals3 = _$$equals(_cache, 5, b),
    _value6 = _equals3 ? _cache[5] : _cache[5] = b,
    _value7 = _equals3 ? _cache[6] : _cache[6] = _value5('y', _value6),
    _equals4 = _$$equals(_cache, 7, _value7),
    _value8 = _equals4 ? _cache[7] : _cache[7] = _value7,
    _value9 = _equals2 ? _cache[8] : _cache[8] = _value4 + 1,
    _equals5 = _$$equals(_cache, 9, _value9),
    _value0 = _equals5 ? _cache[9] : _cache[9] = _value9,
    _value1 = _equals2 && _equals4 && _equals5 ? _cache[10] : _cache[10] = [_value4, _value8, _value0],
    _equals7 = _$$equals(_cache, 11, _value1),
    _value10 = _equals7 ? _cache[11] : _cache[11] = _value1;
  return /*@forgetti jsx*/_equals7 ? _cache[12] : _cache[12] = <_Derived v={_value10} />;
}