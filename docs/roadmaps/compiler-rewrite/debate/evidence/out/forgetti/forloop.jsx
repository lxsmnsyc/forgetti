import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Row } from './counter.js';
const _ForLoop2 = _$$memo(_memo, "_ForLoop2", _values => {
  const _ForLoop = _values[0];
  return <_ForLoop item={_values[1]} />;
});
const _ForLoop3 = _$$memo(_memo, "_ForLoop3", _values2 => <ul title={_values2[0]}>{_values2[1]}</ul>);
export function ForLoop({
  items,
  title
}) {
  let _cache = _$$cache(_useMemo, 7);
  const rows = 0 in _cache ? _cache[0] : _cache[0] = [];
  let _cache2 = _$$branch(_cache, 1, 0),
    _id = 0;
  for (let i = 0; i < items.length; i++) {
    let _loop = _$$branch(_cache2, _id++, 11),
      _equals = _$$equals(_loop, 0, rows),
      _value2 = _equals ? _loop[0] : _loop[0] = rows,
      _equals2 = _$$equals(_loop, 1, i),
      _value3 = _equals2 ? _loop[1] : _loop[1] = i,
      _value4 = 2 in _loop ? _loop[2] : _loop[2] = Row,
      _equals3 = _$$equals(_loop, 3, items),
      _value5 = _equals3 ? _loop[3] : _loop[3] = items,
      _value6 = _equals3 && _equals2 ? _loop[4] : _loop[4] = _value5[_value3],
      _equals5 = _$$equals(_loop, 5, _value6),
      _value7 = _equals5 ? _loop[5] : _loop[5] = _value6,
      _value8 = _equals5 ? _loop[6] : _loop[6] = [_value4, _value7],
      _equals6 = _$$equals(_loop, 7, _value8),
      _value9 = _equals6 ? _loop[7] : _loop[7] = _value8,
      _value0 = _equals2 && _equals6 ? _loop[8] : _loop[8] = /*@forgetti jsx*/<_ForLoop2 key={_value3} v={_value9} />,
      _equals8 = _$$equals(_loop, 9, _value0),
      _value1 = _equals8 ? _loop[9] : _loop[9] = _value0;
    _equals && _equals8 ? _loop[10] : _loop[10] = _value2.push(_value1);
  }
  let _equals0 = _$$equals(_cache, 2, title),
    _value11 = _equals0 ? _cache[2] : _cache[2] = title,
    _equals1 = _$$equals(_cache, 3, rows),
    _value12 = _equals1 ? _cache[3] : _cache[3] = rows,
    _value13 = _equals0 && _equals1 ? _cache[4] : _cache[4] = [_value11, _value12],
    _equals11 = _$$equals(_cache, 5, _value13),
    _value14 = _equals11 ? _cache[5] : _cache[5] = _value13;
  return /*@forgetti jsx*/_equals11 ? _cache[6] : _cache[6] = <_ForLoop3 v={_value14} />;
}