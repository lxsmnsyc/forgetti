// shared/dateFormatter.ts, with the formatters the year view uses.
// `get-user-locale` is replaced by a fixed default.
function getUserLocale() {
  return 'en-US';
}

const formatterCache = new Map();

function getFormatter(options) {
  return function formatter(locale, date) {
    const localeWithDefault = locale || getUserLocale();

    if (!formatterCache.has(localeWithDefault)) {
      formatterCache.set(localeWithDefault, new Map());
    }

    const formatterCacheLocale = formatterCache.get(localeWithDefault);

    if (!formatterCacheLocale.has(options)) {
      const formatter = new Intl.DateTimeFormat(localeWithDefault || undefined, options);

      formatterCacheLocale.set(options, formatter.format.bind(formatter));
    }

    return formatterCacheLocale.get(options)(date);
  };
}

/**
 * Changes the hour in a Date to ensure right date formatting even if DST is messed up.
 * Workaround for bug in WebKit and Firefox with historical dates.
 */
function toSafeHour(date) {
  const safeDate = new Date(date);
  return new Date(safeDate.setHours(12));
}

function getSafeFormatter(options) {
  return (locale, date) => getFormatter(options)(locale, toSafeHour(date));
}

const formatLongDateOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};
const formatMonthOptions = { month: 'long' };
const formatMonthYearOptions = {
  month: 'long',
  year: 'numeric',
};

export const formatLongDate = getSafeFormatter(formatLongDateOptions);
export const formatMonth = getSafeFormatter(formatMonthOptions);
export const formatMonthYear = getSafeFormatter(formatMonthYearOptions);
