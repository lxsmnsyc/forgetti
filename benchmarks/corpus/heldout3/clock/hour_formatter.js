// shared/hourFormatter.ts. `get-user-locale` is replaced by a fixed default.
function getUserLocale() {
  return 'en-US';
}

export function formatHour(locale, hour) {
  return hour.toLocaleString(locale || getUserLocale() || undefined);
}
