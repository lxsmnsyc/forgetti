import { useEffect, useMemo, useRef, useState } from 'react';
import { bump } from '../../shared/counter.js';

import TileGroup from './tile_group.jsx';
import Month from './month.jsx';
import { getMonthStart, getYear } from './dates.js';
import { formatLongDate } from './date_formatter.js';

// YearView/Months.tsx
function Months(props) {
  const { activeStartDate, hover, value, valueType, ...otherProps } = props;
  const start = 0;
  const end = 11;
  const year = getYear(activeStartDate);

  return (
    <TileGroup
      className="react-calendar__year-view__months"
      dateTransform={(monthIndex) => {
        const date = new Date();
        date.setFullYear(year, monthIndex, 1);
        return getMonthStart(date);
      }}
      dateType="month"
      end={end}
      hover={hover}
      renderTile={({ date, ...otherTileProps }) => (
        <Month
          key={date.getTime()}
          {...otherProps}
          {...otherTileProps}
          activeStartDate={activeStartDate}
          date={date}
        />
      )}
      start={start}
      value={value}
      valueType={valueType}
    />
  );
}

// YearView.tsx
/**
 * Displays a given year.
 */
export default function YearView(props) {
  function renderMonths() {
    return <Months {...props} />;
  }

  return <div className="react-calendar__year-view">{renderMonths()}</div>;
}

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function describeValue(value, locale) {
  bump('describe');
  if (!value) {
    return 'Nothing selected';
  }
  if (Array.isArray(value)) {
    return `${formatLongDate(locale, value[0])} to ${formatLongDate(locale, value[1])}`;
  }
  return formatLongDate(locale, value);
}

// Harness entry, after Calendar's year view: a month picker that keeps the value and the
// hovered month in state, as Calendar does.
export function MonthPicker({
  activeStartDate,
  initialValue,
  locale,
  minDate,
  maxDate,
  tileClassName,
  tileContent,
  tileDisabled,
  formatMonth,
  selectRange,
}) {
  const [value, setValue] = useState(initialValue);
  const [hover, setHover] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    globalThis.__months = { root: rootRef.current, setValue, setHover };
  });

  const onClick = (date) => {
    if (selectRange && value && !Array.isArray(value)) {
      setValue(value < date ? [value, date] : [date, value]);
    } else {
      setValue(date);
    }
  };

  const caption = useMemo(() => describeValue(value, locale), [value, locale]);

  return (
    <div className="react-calendar" ref={rootRef}>
      <YearView
        activeStartDate={activeStartDate}
        formatMonth={formatMonth}
        hover={selectRange ? hover : null}
        locale={locale}
        maxDate={maxDate}
        minDate={minDate}
        onClick={onClick}
        onMouseOver={selectRange ? setHover : undefined}
        tileClassName={tileClassName}
        tileContent={tileContent}
        tileDisabled={tileDisabled}
        value={value}
        valueType="month"
      />
      <p>{caption}</p>
    </div>
  );
}
