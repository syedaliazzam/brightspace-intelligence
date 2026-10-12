const APP_TIMEZONE_OFFSET = "+05:00";

export const PUBLIC_EVENT_DAYS = [
  { key: "mon", label: "Monday", code: "MO" },
  { key: "tue", label: "Tuesday", code: "TU" },
  { key: "wed", label: "Wednesday", code: "WE" },
  { key: "thu", label: "Thursday", code: "TH" },
  { key: "fri", label: "Friday", code: "FR" },
  { key: "sat", label: "Saturday", code: "SA" },
  { key: "sun", label: "Sunday", code: "SU" },
];

export function parsePublicEventDays(value) {
  const days = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(days) || days.some((day) => !PUBLIC_EVENT_DAYS.some((item) => item.key === day))) {
    throw new Error("Select valid event days.");
  }
  return [...new Set(days)];
}

export function buildPublicEventCalendarSchedule(startAt, endAt, days = []) {
  if (!days.length) return { start: startAt, end: endAt, recurrence: [], publicEventSchedule: true };
  const localStart = new Date(new Date(startAt).getTime() + 5 * 60 * 60 * 1000);
  const localEnd = new Date(new Date(endAt).getTime() + 5 * 60 * 60 * 1000);
  const startTime = localStart.toISOString().slice(11, 19);
  const endTime = localEnd.toISOString().slice(11, 19);
  if (endTime <= startTime) throw new Error("Session end time must be after the start time.");
  const lastDate = localEnd.toISOString().slice(0, 10);
  const cursor = new Date(`${localStart.toISOString().slice(0, 10)}T00:00:00Z`);
  const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  while (cursor.toISOString().slice(0, 10) <= lastDate && !days.includes(weekdayKeys[cursor.getUTCDay()])) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const firstDate = cursor.toISOString().slice(0, 10);
  if (firstDate > lastDate) throw new Error("The date range does not include any selected event day.");
  const until = parsePakistanDateTime(lastDate, startTime).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return {
    start: parsePakistanDateTime(firstDate, startTime),
    end: parsePakistanDateTime(firstDate, endTime),
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${PUBLIC_EVENT_DAYS.filter((day) => days.includes(day.key)).map((day) => day.code).join(",")};UNTIL=${until}`],
    publicEventSchedule: true,
  };
}

export function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function parsePakistanDateTime(dateValue, timeValue) {
  const date = cleanText(dateValue);
  const time = cleanText(timeValue);
  if (!date || !time) return null;

  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const isoValue = `${date}T${normalizedTime}${APP_TIMEZONE_OFFSET}`;
  const parsed = new Date(isoValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatEventLifecycleStatus(startAt, endAt, now = new Date()) {
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;

  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
    return "upcoming";
  }

  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (currentTime < start.getTime()) return "upcoming";
  if (currentTime <= end.getTime()) return "current";
  return "past";
}

export function formatEventLifecycleLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "current") return "Current";
  if (normalized === "past") return "Past";
  return "Upcoming";
}

export function formatEventDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatEventDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
  }).format(date);
}

export function formatMoney(value) {
  return `PKR ${Number(value || 0).toLocaleString("en-PK")}`;
}

export function normalizeRegistrationStatus(value) {
  const normalized = String(value || "pending").toLowerCase();
  if (normalized === "free") return "free";
  if (normalized === "verified") return "verified";
  if (normalized === "cancelled") return "cancelled";
  return "pending";
}

export function formatRegistrationStatusLabel(value) {
  const normalized = normalizeRegistrationStatus(value);
  if (normalized === "free") return "Free";
  if (normalized === "verified") return "Verified";
  if (normalized === "cancelled") return "Cancelled";
  return "Pending";
}

