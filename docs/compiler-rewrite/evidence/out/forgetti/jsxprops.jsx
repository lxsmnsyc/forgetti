import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Child } from './counter.js';
const _JsxProps3 = _$$memo(_memo, "_JsxProps3", _values => {
  const _JsxProps = _values[1],
    _JsxProps2 = _values[3];
  return <section className={_values[0]}>
      <_JsxProps v={_values[2]} />
      <_JsxProps2 v={_values[4]} />
    </section>;
});
export function JsxProps(props) {
  let _cache = _$$cache(_useMemo, 12),
    _equals = _$$equals(_cache, 0, props),
    _value = _equals ? _cache[0] : _cache[0] = props,
    _value2 = _equals ? _cache[1] : _cache[1] = _value.cls,
    _equals2 = _$$equals(_cache, 2, _value2),
    _value3 = _equals2 ? _cache[2] : _cache[2] = _value2,
    _value4 = 3 in _cache ? _cache[3] : _cache[3] = Child,
    _value5 = _equals ? _cache[4] : _cache[4] = _value.x,
    _equals3 = _$$equals(_cache, 5, _value5),
    _value6 = _equals3 ? _cache[5] : _cache[5] = _value5,
    _value7 = 6 in _cache ? _cache[6] : _cache[6] = Child,
    _value8 = _equals ? _cache[7] : _cache[7] = _value.y,
    _equals4 = _$$equals(_cache, 8, _value8),
    _value9 = _equals4 ? _cache[8] : _cache[8] = _value8,
    _value0 = _equals2 && _equals3 && _equals4 ? _cache[9] : _cache[9] = [_value3, _value4, _value6, _value7, _value9],
    _equals6 = _$$equals(_cache, 10, _value0),
    _value1 = _equals6 ? _cache[10] : _cache[10] = _value0;
  return /*@forgetti jsx*/_equals6 ? _cache[11] : _cache[11] = <_JsxProps3 v={_value1} />;
}