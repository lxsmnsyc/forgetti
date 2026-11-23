// @wojtekmaj/date-utils, reduced to the year, month and day ranges the year view uses.
export function getYear(date) {
  return date.getFullYear();
}

export function getYearStart(date) {
  const result = new Date();
  result.setFullYear(getYear(date), 0, 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getYearEnd(date) {
  const result = new Date();
  result.setFullYear(getYear(date) + 1, 0, 1);
  result.setHours(0, 0, 0, 0);
  return new Date(result.getTime() - 1);
}

export function getMonthStart(date) {
  const result = new Date();
  result.setFullYear(getYear(date), date.getMonth(), 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getMonthEnd(date) {
  const result = new Date();
  result.setFullYear(getYear(date), date.getMonth() + 1, 1);
  result.setHours(0, 0, 0, 0);
  return new Date(result.getTime() - 1);
}

export function getDayStart(date) {
  const result = new Date();
  result.setFullYear(getYear(date), date.getMonth(), date.getDate());
  result.setHours(0, 0, 0, 0);
  return result;
}

export function getDayEnd(date) {
  const result = new Date();
  result.setFullYear(getYear(date), date.getMonth(), date.getDate() + 1);
  result.setHours(0, 0, 0, 0);
  return new Date(result.getTime() - 1);
}

// shared/dates.ts getBegin, getEnd and getRange
export function getBegin(rangeType, date) {
  switch (rangeType) {
    case 'year':
      return getYearStart(date);
    case 'month':
      return getMonthStart(date);
    case 'day':
      return getDayStart(date);
    default:
      throw new Error(`Invalid rangeType: ${rangeType}`);
  }
}

export function getEnd(rangeType, date) {
  switch (rangeType) {
    case 'year':
      return getYearEnd(date);
    case 'month':
      return getMonthEnd(date);
    case 'day':
      return getDayEnd(date);
    default:
      throw new Error(`Invalid rangeType: ${rangeType}`);
  }
}

export function getRange(rangeType, date) {
  return [getBegin(rangeType, date), getEnd(rangeType, date)];
}
