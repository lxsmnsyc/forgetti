import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
const _Memo = _$$memo(_memo, _values => <h1>{_values[0]}, {_values[1]}!</h1>);
function Example(props) {
  let _cache = _$$cache(_useRef, 8),
    _equals = _$$equals(_cache, 0, props),
    _value = _equals ? _cache[0] : _cache[0] = props,
    _value2 = _equals ? _cache[1] : _cache[1] = _value.greeting,
    _equals2 = _$$equals(_cache, 2, _value2),
    _value3 = _equals2 ? _cache[2] : _cache[2] = _value2,
    _value4 = _equals ? _cache[3] : _cache[3] = _value.receiver,
    _equals3 = _$$equals(_cache, 4, _value4),
    _value5 = _equals3 ? _cache[4] : _cache[4] = _value4,
    _value6 = _equals2 && _equals3 ? _cache[5] : _cache[5] = [_value3, _value5],
    _equals5 = _$$equals(_cache, 6, _value6),
    _value7 = _equals5 ? _cache[6] : _cache[6] = _value6;
  return _equals5 ? _cache[7] : _cache[7] = /*@forgetti skip*/<_Memo v={_value7} />;
}
