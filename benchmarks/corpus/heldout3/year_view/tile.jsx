import { useMemo } from 'react';
import { bump } from '../../shared/counter.js';
import { clsx } from './utils.js';

export default function Tile(props) {
  bump('Row');
  const {
    activeStartDate,
    children,
    classes,
    date,
    formatAbbr,
    locale,
    maxDate,
    maxDateTransform,
    minDate,
    minDateTransform,
    onClick,
    onMouseOver,
    style,
    tileClassName: tileClassNameProps,
    tileContent: tileContentProps,
    tileDisabled,
    view,
  } = props;

  const tileClassName = useMemo(() => {
    const args = { activeStartDate, date, view };

    return typeof tileClassNameProps === 'function' ? tileClassNameProps(args) : tileClassNameProps;
  }, [activeStartDate, date, tileClassNameProps, view]);

  const tileContent = useMemo(() => {
    const args = { activeStartDate, date, view };

    return typeof tileContentProps === 'function' ? tileContentProps(args) : tileContentProps;
  }, [activeStartDate, date, tileContentProps, view]);

  return (
    <button
      className={clsx(classes, tileClassName)}
      disabled={
        (minDate && minDateTransform(minDate) > date) ||
        (maxDate && maxDateTransform(maxDate) < date) ||
        tileDisabled?.({ activeStartDate, date, view })
      }
      onClick={onClick ? (event) => onClick(date, event) : undefined}
      onFocus={onMouseOver ? () => onMouseOver(date) : undefined}
      onMouseOver={onMouseOver ? () => onMouseOver(date) : undefined}
      style={style}
      type="button"
    >
      {formatAbbr ? <abbr aria-label={formatAbbr(locale, date)}>{children}</abbr> : children}
      {tileContent}
    </button>
  );
}
