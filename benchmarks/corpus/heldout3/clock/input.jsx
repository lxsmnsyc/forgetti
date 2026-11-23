import { useEffect, useMemo, useState } from 'react';
import { bump } from '../../shared/counter.js';

import Hand from './hand.jsx';
import Mark from './mark.jsx';
import MarkNumber from './mark_number.jsx';

import { formatHour as defaultFormatHour } from './hour_formatter.js';
import { clsx, getHours, getMilliseconds, getMinutes, getSeconds, safeMax } from './utils.js';

/**
 * Displays a complete clock.
 */
export default function Clock({
  className,
  'data-testid': dataTestId,
  formatHour = defaultFormatHour,
  hourHandLength = 50,
  hourHandOppositeLength,
  hourHandWidth = 4,
  hourMarksLength = 10,
  hourMarksWidth = 3,
  locale,
  minuteHandLength = 70,
  minuteHandOppositeLength,
  minuteHandWidth = 2,
  minuteMarksLength = 6,
  minuteMarksWidth = 1,
  renderHourMarks = true,
  renderMinuteHand = true,
  renderMinuteMarks = true,
  renderNumbers,
  renderSecondHand = true,
  secondHandLength = 90,
  secondHandOppositeLength,
  secondHandWidth = 1,
  size = 150,
  useMillisecondPrecision,
  value,
}) {
  function renderMinuteMarksFn() {
    if (!renderMinuteMarks) {
      return null;
    }

    const minuteMarks = [];
    for (let i = 1; i <= 60; i += 1) {
      const isHourMark = renderHourMarks && !(i % 5);

      if (!isHourMark) {
        minuteMarks.push(
          <Mark
            key={`minute_${i}`}
            angle={i * 6}
            length={minuteMarksLength}
            name="minute"
            width={minuteMarksWidth}
          />,
        );
      }
    }
    return minuteMarks;
  }

  function renderHourMarksFn() {
    if (!renderHourMarks) {
      return null;
    }

    const hourMarks = [];
    for (let i = 1; i <= 12; i += 1) {
      hourMarks.push(
        <Mark
          key={`hour_${i}`}
          angle={i * 30}
          length={hourMarksLength}
          name="hour"
          width={hourMarksWidth}
        />,
      );
    }
    return hourMarks;
  }

  function renderNumbersFn() {
    if (!renderNumbers) {
      return null;
    }

    const numbers = [];
    for (let i = 1; i <= 12; i += 1) {
      numbers.push(
        <MarkNumber
          key={`number_${i}`}
          angle={i * 30}
          length={safeMax(
            renderHourMarks && hourMarksLength,
            renderMinuteMarks && minuteMarksLength,
            0,
          )}
          name="number"
          number={formatHour(locale, i)}
        />,
      );
    }
    return numbers;
  }

  function renderFace() {
    return (
      <div className="react-clock__face">
        {renderMinuteMarksFn()}
        {renderHourMarksFn()}
        {renderNumbersFn()}
      </div>
    );
  }

  function renderHourHandFn() {
    const angle = value
      ? getHours(value) * 30 +
        getMinutes(value) / 2 +
        getSeconds(value) / 120 +
        (useMillisecondPrecision ? getMilliseconds(value) / 120000 : 0)
      : 0;

    return (
      <Hand
        angle={angle}
        length={hourHandLength}
        name="hour"
        oppositeLength={hourHandOppositeLength}
        width={hourHandWidth}
      />
    );
  }

  function renderMinuteHandFn() {
    if (!renderMinuteHand) {
      return null;
    }

    const angle = value
      ? getHours(value) * 360 +
        getMinutes(value) * 6 +
        getSeconds(value) / 10 +
        (useMillisecondPrecision ? getMilliseconds(value) / 10000 : 0)
      : 0;

    return (
      <Hand
        angle={angle}
        length={minuteHandLength}
        name="minute"
        oppositeLength={minuteHandOppositeLength}
        width={minuteHandWidth}
      />
    );
  }

  function renderSecondHandFn() {
    if (!renderSecondHand) {
      return null;
    }

    const angle = value
      ? getMinutes(value) * 360 +
        getSeconds(value) * 6 +
        (useMillisecondPrecision ? getMilliseconds(value) * 0.006 : 0)
      : 0;

    return (
      <Hand
        angle={angle}
        length={secondHandLength}
        name="second"
        oppositeLength={secondHandOppositeLength}
        width={secondHandWidth}
      />
    );
  }

  return (
    <time
      className={clsx('react-clock', className)}
      data-testid={dataTestId}
      dateTime={
        value instanceof Date
          ? // Returns a string in the format "HH:MM" or "HH:MM:SS"
            value.toLocaleTimeString('en', {
              hour: '2-digit',
              minute: renderMinuteHand ? '2-digit' : undefined,
              second: renderSecondHand ? '2-digit' : undefined,
            })
          : value || undefined
      }
      style={{
        width: size,
        height: size,
      }}
    >
      {renderFace()}
      {renderHourHandFn()}
      {renderMinuteHandFn()}
      {renderSecondHandFn()}
    </time>
  );
}

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function describeTime(value, locale) {
  bump('describe');
  if (!(value instanceof Date)) {
    return value || '';
  }
  return value.toLocaleTimeString(locale || 'en-US', { hour: 'numeric', minute: '2-digit' });
}

// Harness entry, after the library's sample page: a clock with a caption and toggles.
export function ClockSample({ initialValue, locale, size, renderNumbers: initialNumbers, ...rest }) {
  const [value, setValue] = useState(initialValue);
  const [renderNumbers, setRenderNumbers] = useState(initialNumbers);

  useEffect(() => {
    globalThis.__clock = { setValue, setRenderNumbers };
  });

  const caption = useMemo(() => describeTime(value, locale), [value, locale]);

  return (
    <div className="Sample">
      <Clock {...rest} locale={locale} renderNumbers={renderNumbers} size={size} value={value} />
      <p>{caption}</p>
    </div>
  );
}
