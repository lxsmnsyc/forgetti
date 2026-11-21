import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Child } from './counter.js';
const _Switch2 = _$$memo(_memo, "_Switch2", _values => {
  const _Switch = _values[0];
  return <_Switch v={_values[1]} />;
});
const _Switch4 = _$$memo(_memo, "_Switch4", _values2 => {
  const _Switch3 = _values2[0];
  return <_Switch3 v={_values2[1]} />;
});
const _Switch5 = _$$memo(_memo, "_Switch5", _values3 => <em>none</em>);
const _Switch6 = _$$memo(_memo, "_Switch6", _values4 => <div>{_values4[0]}</div>);
export function Switch({
  kind,
  a,
  b
}) {
  let _cache = _$$cache(_useMemo, 8),
    el;
  switch (_$$equals(_cache, 0, kind) ? _cache[0] : _cache[0] = kind) {
    case 'a':
      let _cache2 = _$$branch(_cache, 1, 6),
        _value2 = 0 in _cache2 ? _cache2[0] : _cache2[0] = Child,
        _equals2 = _$$equals(_cache2, 1, a),
        _value3 = _equals2 ? _cache2[1] : _cache2[1] = a,
        _value4 = _equals2 ? _cache2[2] : _cache2[2] = [_value2, _value3],
        _equals3 = _$$equals(_cache2, 3, _value4),
        _value5 = _equals3 ? _cache2[3] : _cache2[3] = _value4,
        _value6 = _equals3 ? _cache2[4] : _cache2[4] = /*@forgetti jsx*/<_Switch2 v={_value5} />;
      el = _$$equals(_cache2, 5, _value6) ? _cache2[5] : _cache2[5] = _value6;
      break;
    case 'b':
      let _cache3 = _$$branch(_cache, 2, 6),
        _value8 = 0 in _cache3 ? _cache3[0] : _cache3[0] = Child,
        _equals5 = _$$equals(_cache3, 1, b),
        _value9 = _equals5 ? _cache3[1] : _cache3[1] = b,
        _value0 = _equals5 ? _cache3[2] : _cache3[2] = [_value8, _value9],
        _equals6 = _$$equals(_cache3, 3, _value0),
        _value1 = _equals6 ? _cache3[3] : _cache3[3] = _value0,
        _value10 = _equals6 ? _cache3[4] : _cache3[4] = /*@forgetti jsx*/<_Switch4 v={_value1} />;
      el = _$$equals(_cache3, 5, _value10) ? _cache3[5] : _cache3[5] = _value10;
      break;
    default:
      let _cache4 = _$$branch(_cache, 3, 1);
      el = 0 in _cache4 ? _cache4[0] : _cache4[0] = /*@forgetti jsx*/<_Switch5 v={[]} />;
  }
  let _equals8 = _$$equals(_cache, 4, el),
    _value13 = _equals8 ? _cache[4] : _cache[4] = el,
    _value14 = _equals8 ? _cache[5] : _cache[5] = [_value13],
    _equals9 = _$$equals(_cache, 6, _value14),
    _value15 = _equals9 ? _cache[6] : _cache[6] = _value14;
  return /*@forgetti jsx*/_equals9 ? _cache[7] : _cache[7] = <_Switch6 v={_value15} />;
}