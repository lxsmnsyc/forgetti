import { memo } from 'react';
import { bump } from '../../shared/counter.js';

const MarkNumber = memo(function MarkNumber({ angle = 0, length = 10, name, number }) {
  bump('Row');
  return (
    <div
      className={`react-clock__mark react-clock__${name}-mark`}
      style={{
        transform: `rotate(${angle}deg)`,
      }}
    >
      <div
        className="react-clock__mark__number"
        style={{
          transform: `rotate(-${angle}deg)`,
          top: `${length / 2}%`,
        }}
      >
        {number}
      </div>
    </div>
  );
});

export default MarkNumber;
