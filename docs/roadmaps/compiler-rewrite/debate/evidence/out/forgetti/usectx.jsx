import { useMemo as _useMemo } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$branch as _$$branch } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
import { use, createContext } from 'react';
export const Ctx = createContext('def');
const _UseCtx = _$$memo(_memo, "_UseCtx", _values => <p>{_values[0]}:{_values[1]}</p>);
const _UseCtx2 = _$$memo(_memo, "_UseCtx2", _values2 => <p>{_values2[0]}</p>);
export function UseCtx({
  flag,
  name
}) {
  let _cache = _$$cache(_useMemo, 6);
  if (_$$equals(_cache, 0, flag) ? _cache[0] : _cache[0] = flag) {
    let _cache2 = _$$branch(_cache, 1, 5),
      _equals2 = _$$equals(_cache2, 0, name),
      _value2 = _equals2 ? _cache2[0] : _cache2[0] = name,
      _value3 = 1 in _cache2 ? _cache2[1] : _cache2[1] = use(Ctx),
      _value4 = _equals2 ? _cache2[2] : _cache2[2] = [_value2, _value3],
      _equals3 = _$$equals(_cache2, 3, _value4),
      _value5 = _equals3 ? _cache2[3] : _cache2[3] = _value4;
    return /*@forgetti jsx*/_equals3 ? _cache2[4] : _cache2[4] = <_UseCtx v={_value5} />;
  }
  let _equals4 = _$$equals(_cache, 2, name),
    _value7 = _equals4 ? _cache[2] : _cache[2] = name,
    _value8 = _equals4 ? _cache[3] : _cache[3] = [_value7],
    _equals5 = _$$equals(_cache, 4, _value8),
    _value9 = _equals5 ? _cache[4] : _cache[4] = _value8;
  return /*@forgetti jsx*/_equals5 ? _cache[5] : _cache[5] = <_UseCtx2 v={_value9} />;
}