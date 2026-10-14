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

export function formatEventDate(value, endAt, scheduleDays) {
  if (endAt || scheduleDays) {
    return formatEventScheduleDates(value, endAt, scheduleDays);
  }
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
  }).format(date);
}

const WEEKDAY_MAP = {
  sun: 0, sunday: 0, su: 0,
  mon: 1, monday: 1, mo: 1,
  tue: 2, tuesday: 2, tu: 2,
  wed: 3, wednesday: 3, we: 3,
  thu: 4, thursday: 4, th: 4,
  fri: 5, friday: 5, fr: 5,
  sat: 6, saturday: 6, sa: 6,
};

function getPKTDateParts(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const utcMillis = d.getTime() + d.getTimezoneOffset() * 60000;
  const pktMillis = utcMillis + 5 * 3600000;
  const pktDate = new Date(pktMillis);
  return {
    year: pktDate.getFullYear(),
    month: pktDate.getMonth(),
    date: pktDate.getDate(),
    day: pktDate.getDay(),
  };
}

export function parseScheduleDays(scheduleDays) {
  if (Array.isArray(scheduleDays)) {
    return scheduleDays.map((d) => (typeof d === "string" ? d.trim() : "")).filter(Boolean);
  }
  if (typeof scheduleDays === "string" && scheduleDays.trim()) {
    try {
      const parsed = JSON.parse(scheduleDays);
      if (Array.isArray(parsed)) {
        return parsed.map((d) => String(d).trim()).filter(Boolean);
      }
    } catch {}
    const trimmed = scheduleDays.replace(/[\[\]"']/g, "").trim();
    if (trimmed) {
      return trimmed.split(",").map((d) => d.trim()).filter(Boolean);
    }
  }
  return [];
}

export function getEventSessionDates(startAt, endAt, scheduleDays) {
  if (!startAt) return [];
  const startPkt = getPKTDateParts(startAt);
  if (!startPkt) return [];
  const endPkt = endAt ? getPKTDateParts(endAt) : startPkt;

  const parsedDays = parseScheduleDays(scheduleDays);
  const weekdaySet = new Set();
  const explicitDates = [];

  for (const item of parsedDays) {
    if (!item) continue;
    const clean = item.toLowerCase();
    if (WEEKDAY_MAP[clean] !== undefined) {
      weekdaySet.add(WEEKDAY_MAP[clean]);
    } else {
      const parsed = new Date(item);
      if (!Number.isNaN(parsed.getTime())) {
        explicitDates.push(parsed);
      }
    }
  }

  if (explicitDates.length > 0 && weekdaySet.size === 0) {
    return explicitDates.sort((a, b) => a.getTime() - b.getTime());
  }

  if (weekdaySet.size > 0 && endPkt) {
    const dates = [];
    const cur = new Date(Date.UTC(startPkt.year, startPkt.month, startPkt.date));
    const end = new Date(Date.UTC(endPkt.year, endPkt.month, endPkt.date));

    while (cur <= end) {
      if (weekdaySet.has(cur.getUTCDay())) {
        dates.push(new Date(cur.getTime()));
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (dates.length > 0) return dates;
  }

  if (
    endPkt &&
    (startPkt.year !== endPkt.year ||
      startPkt.month !== endPkt.month ||
      startPkt.date !== endPkt.date)
  ) {
    const cur = new Date(Date.UTC(startPkt.year, startPkt.month, startPkt.date));
    const end = new Date(Date.UTC(endPkt.year, endPkt.month, endPkt.date));
    const diffDays = Math.round((end.getTime() - cur.getTime()) / 86400000);
    if (diffDays <= 4) {
      const dates = [];
      while (cur <= end) {
        dates.push(new Date(cur.getTime()));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      return dates;
    }
    return [
      new Date(Date.UTC(startPkt.year, startPkt.month, startPkt.date)),
      new Date(Date.UTC(endPkt.year, endPkt.month, endPkt.date)),
    ];
  }

  return [new Date(Date.UTC(startPkt.year, startPkt.month, startPkt.date))];
}

export function formatEventScheduleDates(startAtOrEvent, endAt, scheduleDays) {
  let start = startAtOrEvent;
  let end = endAt;
  let days = scheduleDays;

  if (startAtOrEvent && typeof startAtOrEvent === "object" && !(startAtOrEvent instanceof Date)) {
    start = startAtOrEvent.start_at || startAtOrEvent.event_start_at || startAtOrEvent.startAt;
    end = startAtOrEvent.end_at || startAtOrEvent.event_end_at || startAtOrEvent.endAt;
    days = startAtOrEvent.schedule_days || startAtOrEvent.event_schedule_days || startAtOrEvent.scheduleDays;
  }

  if (!start) return "-";
  const sessionDates = getEventSessionDates(start, end, days);
  if (!sessionDates.length) {
    const d = new Date(start);
    return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(d);
  }

  const formatSingle = (date) => new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "UTC" }).format(date);

  if (sessionDates.length === 1) {
    return formatSingle(sessionDates[0]);
  }

  const firstYear = sessionDates[0].getUTCFullYear();
  const allSameYear = sessionDates.every((d) => d.getUTCFullYear() === firstYear);
  const firstMonth = sessionDates[0].getUTCMonth();
  const allSameMonthAndYear = allSameYear && sessionDates.every((d) => d.getUTCMonth() === firstMonth);

  const monthName = new Intl.DateTimeFormat("en-PK", {
    month: "short",
    timeZone: "UTC",
  }).format(sessionDates[0]);

  if (allSameMonthAndYear) {
    const dayNumbers = sessionDates.map((d) => d.getUTCDate());
    if (dayNumbers.length === 2) {
      return `${dayNumbers[0]} & ${dayNumbers[1]}-${monthName}-${firstYear}`;
    }
    const allButLast = dayNumbers.slice(0, -1).join(", ");
    const last = dayNumbers[dayNumbers.length - 1];
    return `${allButLast} & ${last}-${monthName}-${firstYear}`;
  }

  if (allSameYear) {
    const groups = new Map();
    for (const d of sessionDates) {
      const m = d.getUTCMonth();
      if (!groups.has(m)) {
        groups.set(m, {
          monthStr: new Intl.DateTimeFormat("en-PK", { month: "short", timeZone: "UTC" }).format(d),
          days: [],
        });
      }
      groups.get(m).days.push(d.getUTCDate());
    }
    const parts = [];
    for (const { monthStr, days } of groups.values()) {
      if (days.length === 1) {
        parts.push(`${days[0]}-${monthStr}`);
      } else if (days.length === 2) {
        parts.push(`${days[0]} & ${days[1]}-${monthStr}`);
      } else {
        parts.push(`${days.slice(0, -1).join(", ")} & ${days[days.length - 1]}-${monthStr}`);
      }
    }
    return `${parts.join(" & ")}-${firstYear}`;
  }

  return sessionDates.map(formatSingle).join(", ");
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

