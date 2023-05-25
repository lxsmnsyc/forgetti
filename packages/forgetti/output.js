import { useRef as _useRef } from "react";
import { $$cache as _$$cache } from "forgetti/runtime";
import { $$equals as _$$equals } from "forgetti/runtime";
import { memo as _memo } from "react";
import { $$memo as _$$memo } from "forgetti/runtime";
const _Memo = _$$memo(_memo, _values => {
  const _Component = _values[0];
  return <_Component.H1>{_values[1]}, {_values[2]}!</_Component.H1>;
});
function Example(props) {
  let _cache = _$$cache(_useRef, 9),
    _value = 0 in _cache ? _cache[0] : _cache[0] = styled,
    _equals = _$$equals(_cache, 1, props),
    _value2 = _equals ? _cache[1] : _cache[1] = props,
    _value3 = _equals ? _cache[2] : _cache[2] = _value2.greeting,
    _equals2 = _$$equals(_cache, 3, _value3),
    _value4 = _equals2 ? _cache[3] : _cache[3] = _value3,
    _value5 = _equals ? _cache[4] : _cache[4] = _value2.receiver,
    _equals3 = _$$equals(_cache, 5, _value5),
    _value6 = _equals3 ? _cache[5] : _cache[5] = _value5,
    _value7 = _equals2 && _equals3 ? _cache[6] : _cache[6] = [_value, _value4, _value6],
    _equals5 = _$$equals(_cache, 7, _value7),
    _value8 = _equals5 ? _cache[7] : _cache[7] = _value7;
  return _equals5 ? _cache[8] : _cache[8] = /*@forgetti skip*/<_Memo v={_value8} />;
}
