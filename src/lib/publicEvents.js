const APP_TIMEZONE_OFFSET = "+05:00";

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
  if (normalized === "verified") return "verified";
  if (normalized === "cancelled") return "cancelled";
  return "pending";
}

export function formatRegistrationStatusLabel(value) {
  const normalized = normalizeRegistrationStatus(value);
  if (normalized === "verified") return "Verified";
  if (normalized === "cancelled") return "Cancelled";
  return "Pending";
}
