import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Child } from './counter.js';
const _Mutate = _$$memo(_memo, "_Mutate", _values => <div>{_values[0]}{_values[1]}</div>);
const _Mutate3 = _$$memo(_memo, "_Mutate3", _values2 => {
  const _Mutate2 = _values2[0];
  return <_Mutate2 v={_values2[1]} />;
});
export function Mutate({
  a,
  b,
  c
}) {
  let _cache = _$$cache(_useMemo, 14),
    _equals = _$$equals(_cache, 0, a),
    _value = _equals ? _cache[0] : _cache[0] = a;
  const arr = _equals ? _cache[1] : _cache[1] = [_value];
  let _equals2 = _$$equals(_cache, 2, arr),
    _value3 = _equals2 ? _cache[2] : _cache[2] = arr,
    _equals3 = _$$equals(_cache, 3, b),
    _value4 = _equals3 ? _cache[3] : _cache[3] = b;
  _equals2 && _equals3 ? _cache[4] : _cache[4] = _value3.push(_value4);
  let _equals5 = _$$equals(_cache, 5, c),
    _value6 = _equals5 ? _cache[5] : _cache[5] = c,
    _value7 = _equals5 ? _cache[6] : _cache[6] = _value6 + '!',
    _equals6 = _$$equals(_cache, 7, _value7),
    _value8 = _equals6 ? _cache[7] : _cache[7] = _value7,
    _value9 = 8 in _cache ? _cache[8] : _cache[8] = (v, i) => /*@forgetti jsx*/<_Mutate3 key={i} v={[Child, v]} />,
    _value0 = _equals2 ? _cache[9] : _cache[9] = _value3.map(_value9),
    _equals7 = _$$equals(_cache, 10, _value0),
    _value1 = _equals7 ? _cache[10] : _cache[10] = _value0,
    _value10 = _equals6 && _equals7 ? _cache[11] : _cache[11] = [_value8, _value1],
    _equals9 = _$$equals(_cache, 12, _value10),
    _value11 = _equals9 ? _cache[12] : _cache[12] = _value10;
  return /*@forgetti jsx*/_equals9 ? _cache[13] : _cache[13] = <_Mutate v={_value11} />;
}