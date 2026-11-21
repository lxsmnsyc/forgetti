import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { useState, useMemo, useEffect } from 'react';
import { bump } from './counter.js';
function sumOf(list) {
  bump('total');
  return list.reduce((s, v) => s + v, 0);
}
const _StateMemo = _$$memo(_memo, "_StateMemo", _values => <div>{_values[0]}:{_values[1]}:{_values[2]}</div>);
export function StateMemo({
  list,
  tag
}) {
  let _cache = _$$cache(_useMemo, 10);
  const [n, setN] = useState(0);
  useEffect(() => {
    globalThis.__setN = setN;
  }, [0 in _cache ? _cache[0] : _cache[0] = []]);
  let _equals = _$$equals(_cache, 1, tag),
    _value2 = _equals ? _cache[1] : _cache[1] = tag,
    _equals2 = _$$equals(_cache, 2, list),
    _value3 = _equals2 ? _cache[2] : _cache[2] = list,
    _value4 = _equals2 ? _cache[3] : _cache[3] = [_value3],
    _value5 = _equals2 ? _cache[4] : _cache[4] = (() => sumOf(list))(),
    _equals3 = _$$equals(_cache, 5, _value5),
    _value6 = _equals3 ? _cache[5] : _cache[5] = _value5,
    _equals4 = _$$equals(_cache, 6, n),
    _value7 = _equals4 ? _cache[6] : _cache[6] = n,
    _value8 = _equals && _equals3 && _equals4 ? _cache[7] : _cache[7] = [_value2, _value6, _value7],
    _equals6 = _$$equals(_cache, 8, _value8),
    _value9 = _equals6 ? _cache[8] : _cache[8] = _value8;
  return /*@forgetti jsx*/_equals6 ? _cache[9] : _cache[9] = <_StateMemo v={_value9} />;
}