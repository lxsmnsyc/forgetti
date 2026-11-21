import { useRef as _useRef } from "react";
import { $$ref as _$$ref } from "forgetti/runtime";
import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { useRef } from 'react';
import { bump, Child } from './counter.js';
const _Bailout2 = _$$memo(_memo, "_Bailout2", _values => {
  const _Bailout = _values[0];
  return <div><_Bailout v={_values[1]} />{_values[2]}</div>;
});
export function Bailout(props) {
  let _cache = _$$cache(_useMemo, 19),
    _ref = _$$ref(_useRef, 1);
  const ref = 0 in _ref ? _ref[0] : _ref[0] = {
    current: 0
  };
  let _equals = _$$equals(_cache, 0, props),
    _value2 = _equals ? _cache[0] : _cache[0] = props,
    _value3 = _equals ? _cache[1] : _cache[1] = _value2.box;
  (_$$equals(_cache, 2, _value3) ? _cache[2] : _cache[2] = _value3).n += 1;
  let _equals3 = _$$equals(_cache, 3, ref),
    _value5 = _equals3 ? _cache[3] : _cache[3] = ref,
    _value6 = _equals3 ? _cache[4] : _cache[4] = _value5.current,
    _equals4 = _$$equals(_cache, 5, _value6),
    _value7 = _equals4 ? _cache[5] : _cache[5] = _value6,
    _value8 = _equals4 ? _cache[6] : _cache[6] = _value7 + 1;
  _value5.current = _$$equals(_cache, 7, _value8) ? _cache[7] : _cache[7] = _value8;
  let _value0 = 8 in _cache ? _cache[8] : _cache[8] = Child,
    _value1 = _equals ? _cache[9] : _cache[9] = _value2.a,
    _equals6 = _$$equals(_cache, 10, _value1),
    _value10 = _equals6 ? _cache[10] : _cache[10] = _value1,
    _value12 = _equals3 ? _cache[11] : _cache[11] = _value5.current,
    _equals7 = _$$equals(_cache, 12, _value12),
    _value13 = _equals7 ? _cache[12] : _cache[12] = _value12,
    _value11;
  if (_equals7 ? _cache[13] : _cache[13] = _value13 > 0) {
    let _cache2 = _$$branch(_cache, 14, 4),
      _equals8 = _$$equals(_cache2, 0, props),
      _value15 = _equals8 ? _cache2[0] : _cache2[0] = props,
      _value16 = _equals8 ? _cache2[1] : _cache2[1] = _value15.box,
      _equals9 = _$$equals(_cache2, 2, _value16),
      _value17 = _equals9 ? _cache2[2] : _cache2[2] = _value16;
    _value11 = _equals9 ? _cache2[3] : _cache2[3] = _value17.n;
  } else {
    _value11 = 0;
  }
  let _equals0 = _$$equals(_cache, 15, _value11),
    _value19 = _equals0 ? _cache[15] : _cache[15] = _value11,
    _value20 = _equals6 && _equals0 ? _cache[16] : _cache[16] = [_value0, _value10, _value19],
    _equals10 = _$$equals(_cache, 17, _value20),
    _value21 = _equals10 ? _cache[17] : _cache[17] = _value20;
  return /*@forgetti jsx*/_equals10 ? _cache[18] : _cache[18] = <_Bailout2 v={_value21} />;
}