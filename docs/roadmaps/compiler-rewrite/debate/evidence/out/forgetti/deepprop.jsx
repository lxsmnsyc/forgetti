import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Child } from './counter.js';
const _DeepProp2 = _$$memo(_memo, "_DeepProp2", _values => {
  const _DeepProp = _values[0];
  return <div><_DeepProp v={_values[1]} />{_values[2]}</div>;
});
export function DeepProp(props) {
  let _cache = _$$cache(_useMemo, 13),
    _value = 0 in _cache ? _cache[0] : _cache[0] = Child,
    _equals = _$$equals(_cache, 1, props),
    _value2 = _equals ? _cache[1] : _cache[1] = props,
    _value3 = _equals ? _cache[2] : _cache[2] = _value2.obj,
    _equals2 = _$$equals(_cache, 3, _value3),
    _value4 = _equals2 ? _cache[3] : _cache[3] = _value3,
    _value5 = _equals2 ? _cache[4] : _cache[4] = _value4.a,
    _equals3 = _$$equals(_cache, 5, _value5),
    _value6 = _equals3 ? _cache[5] : _cache[5] = _value5,
    _value7 = _equals3 ? _cache[6] : _cache[6] = _value6.b,
    _equals4 = _$$equals(_cache, 7, _value7),
    _value8 = _equals4 ? _cache[7] : _cache[7] = _value7,
    _value9 = _equals ? _cache[8] : _cache[8] = _value2.other,
    _equals5 = _$$equals(_cache, 9, _value9),
    _value0 = _equals5 ? _cache[9] : _cache[9] = _value9,
    _value1 = _equals4 && _equals5 ? _cache[10] : _cache[10] = [_value, _value8, _value0],
    _equals7 = _$$equals(_cache, 11, _value1),
    _value10 = _equals7 ? _cache[11] : _cache[11] = _value1;
  return /*@forgetti jsx*/_equals7 ? _cache[12] : _cache[12] = <_DeepProp2 v={_value10} />;
}