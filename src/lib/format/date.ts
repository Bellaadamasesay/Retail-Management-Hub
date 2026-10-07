/**
 * Dates follow the approved screens ("Mar 10, 2024", "Mar 10, 2024 10:24 AM"),
 * which is month-first with a 12-hour clock. The store is in Freetown (UTC+0,
 * no daylight saving), so everything renders in that zone regardless of the
 * browser's.
 */
const LOCALE = "en-US";
const TIME_ZONE = "Africa/Freetown";

const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const timeOnly = new Intl.DateTimeFormat(LOCALE, {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const dayMonth = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  timeZone: TIME_ZONE,
});

type DateInput = Date | string | number;

/** "Mar 10, 2024" */
export function formatDate(value: DateInput): string {
  return dateOnly.format(new Date(value));
}

/** "10:24 AM" */
export function formatTime(value: DateInput): string {
  return timeOnly.format(new Date(value));
}

/** "Mar 10, 2024 10:24 AM" */
export function formatDateTime(value: DateInput): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** "Mar 10" (chart axes) */
export function formatDayMonth(value: DateInput): string {
  return dayMonth.format(new Date(value));
}

/** Local hour (0-23) in the store's zone. */
export function storeHour(value: DateInput): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE }).format(
      new Date(value),
    ),
  );
}

/** "2 mins ago", "1 hour ago", "Yesterday"; falls back to the date for older values. */
export function formatRelative(value: DateInput, now: DateInput): string {
  const seconds = Math.round((new Date(now).getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "min" : "mins"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(value);
}
