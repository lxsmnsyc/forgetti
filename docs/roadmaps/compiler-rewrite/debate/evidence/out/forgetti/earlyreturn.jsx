import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { bump, Child } from './counter.js';
function costly(k, v) {
  bump(k);
  return v * 2;
}
const _EarlyReturn = _$$memo(_memo, "_EarlyReturn", _values => <p>loading</p>);
const _EarlyReturn3 = _$$memo(_memo, "_EarlyReturn3", _values2 => {
  const _EarlyReturn2 = _values2[0];
  return <div><_EarlyReturn2 v={_values2[1]} />{_values2[2]}</div>;
});
export function EarlyReturn({
  loading,
  a,
  b
}) {
  let _cache = _$$cache(_useMemo, 14);
  if (_$$equals(_cache, 0, loading) ? _cache[0] : _cache[0] = loading) {
    let _cache2 = _$$branch(_cache, 1, 1);
    return /*@forgetti jsx*/0 in _cache2 ? _cache2[0] : _cache2[0] = <_EarlyReturn v={[]} />;
  }
  let _value3 = 2 in _cache ? _cache[2] : _cache[2] = Child,
    _value4 = 3 in _cache ? _cache[3] : _cache[3] = costly,
    _equals2 = _$$equals(_cache, 4, a),
    _value5 = _equals2 ? _cache[4] : _cache[4] = a,
    _value6 = _equals2 ? _cache[5] : _cache[5] = _value4('head', _value5),
    _equals3 = _$$equals(_cache, 6, _value6),
    _value7 = _equals3 ? _cache[6] : _cache[6] = _value6,
    _value8 = 7 in _cache ? _cache[7] : _cache[7] = costly,
    _equals4 = _$$equals(_cache, 8, b),
    _value9 = _equals4 ? _cache[8] : _cache[8] = b,
    _value0 = _equals4 ? _cache[9] : _cache[9] = _value8('body', _value9),
    _equals5 = _$$equals(_cache, 10, _value0),
    _value1 = _equals5 ? _cache[10] : _cache[10] = _value0,
    _value10 = _equals3 && _equals5 ? _cache[11] : _cache[11] = [_value3, _value7, _value1],
    _equals7 = _$$equals(_cache, 12, _value10),
    _value11 = _equals7 ? _cache[12] : _cache[12] = _value10;
  return /*@forgetti jsx*/_equals7 ? _cache[13] : _cache[13] = <_EarlyReturn3 v={_value11} />;
}