import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Btn } from './counter.js';
const _Callback2 = _$$memo(_memo, "_Callback2", _values => {
  const _Callback = _values[1];
  return <div>{_values[0]}<_Callback onClick={_values[2]} label={_values[3]} /></div>;
});
export function Callback({
  id,
  label,
  other
}) {
  let _cache = _$$cache(_useMemo, 9),
    _equals = _$$equals(_cache, 0, other),
    _value = _equals ? _cache[0] : _cache[0] = other,
    _value2 = 1 in _cache ? _cache[1] : _cache[1] = Btn,
    _equals2 = _$$equals(_cache, 2, id),
    _value3 = _equals2 ? _cache[2] : _cache[2] = id,
    _value4 = _equals2 ? _cache[3] : _cache[3] = () => {
      globalThis.__clicked = id;
    },
    _equals3 = _$$equals(_cache, 4, _value4),
    _value5 = _equals3 ? _cache[4] : _cache[4] = _value4,
    _equals4 = _$$equals(_cache, 5, label),
    _value6 = _equals4 ? _cache[5] : _cache[5] = label,
    _value7 = _equals && _equals3 && _equals4 ? _cache[6] : _cache[6] = [_value, _value2, _value5, _value6],
    _equals6 = _$$equals(_cache, 7, _value7),
    _value8 = _equals6 ? _cache[7] : _cache[7] = _value7;
  return /*@forgetti jsx*/_equals6 ? _cache[8] : _cache[8] = <_Callback2 v={_value8} />;
}