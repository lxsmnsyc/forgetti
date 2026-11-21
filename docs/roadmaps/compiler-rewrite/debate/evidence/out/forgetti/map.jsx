import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Row } from './counter.js';
const _MapList = _$$memo(_memo, "_MapList", _values => <ul title={_values[0]}>
      {_values[1]}
    </ul>);
const _MapList3 = _$$memo(_memo, "_MapList3", _values2 => {
  const _MapList2 = _values2[0];
  return <_MapList2 item={_values2[1]} />;
});
export function MapList({
  items,
  title
}) {
  let _cache = _$$cache(_useMemo, 8),
    _equals = _$$equals(_cache, 0, title),
    _value = _equals ? _cache[0] : _cache[0] = title,
    _equals2 = _$$equals(_cache, 1, items),
    _value2 = _equals2 ? _cache[1] : _cache[1] = items,
    _value3 = 2 in _cache ? _cache[2] : _cache[2] = item => /*@forgetti jsx*/<_MapList3 key={item.id} v={[Row, item]} />,
    _value4 = _equals2 ? _cache[3] : _cache[3] = _value2.map(_value3),
    _equals3 = _$$equals(_cache, 4, _value4),
    _value5 = _equals3 ? _cache[4] : _cache[4] = _value4,
    _value6 = _equals && _equals3 ? _cache[5] : _cache[5] = [_value, _value5],
    _equals5 = _$$equals(_cache, 6, _value6),
    _value7 = _equals5 ? _cache[6] : _cache[6] = _value6;
  return /*@forgetti jsx*/_equals5 ? _cache[7] : _cache[7] = <_MapList v={_value7} />;
}