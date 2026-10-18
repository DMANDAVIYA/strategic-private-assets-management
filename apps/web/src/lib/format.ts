const TIME_ZONE = "America/New_York";

const headerDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const clockTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export function formatHeaderDate(date: Date = new Date()): string {
  return headerDate.format(date);
}

export function formatClockTime(epochMs: number): string {
  return clockTime.format(epochMs).replace(/\s/g, " ");
}
