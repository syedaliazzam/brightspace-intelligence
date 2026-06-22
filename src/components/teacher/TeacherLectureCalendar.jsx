"use client";

import { motion } from "framer-motion";

const ranges = [
  { label: "All lectures", value: "all" },
  { label: "Today", value: "today" },
  { label: "Current week", value: "current_week" },
  { label: "Next week", value: "next_week" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Completed", value: "completed" },
  { label: "Selected date", value: "selected_date" },
];

const statuses = [
  { label: "All statuses", value: "" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Live", value: "live" },
  { label: "Ended", value: "ended" },
  { label: "Completed", value: "completed_by_teacher" },
  { label: "Verified", value: "verified_by_coordinator" },
  { label: "Missed", value: "missed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Rescheduled", value: "rescheduled" },
  { label: "Disputed", value: "disputed" },
];

function monthDays(dateValue) {
  const base = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return Array.from({ length: last.getDate() }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth(), index + 1);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  });
}

export default function TeacherLectureCalendar({ filters, subjects = [], markedDates = [], onChange }) {
  const marked = new Set(markedDates.map((item) => item.date));
  const days = monthDays(filters.date);
  const selected = filters.date;

  function update(next) {
    onChange?.({ ...filters, ...next });
  }

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
            Calendar view
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Select lecture date
          </h2>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => update({ date: day, range: "selected_date" })}
                className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                  selected === day
                    ? "bg-slate-950 text-white"
                    : marked.has(day)
                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                      : "bg-slate-50 text-slate-600"
                }`}
              >
                {Number(day.slice(-2))}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:w-[34rem]">
          <input
            type="date"
            value={filters.date}
            onChange={(event) => update({ date: event.target.value, range: "selected_date" })}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400"
          />

          <select
            value={filters.range}
            onChange={(event) => update({ range: event.target.value })}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400"
          >
            {ranges.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <select
            value={filters.subjectId}
            onChange={(event) => update({ subjectId: event.target.value })}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400"
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(event) => update({ status: event.target.value })}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400"
          >
            {statuses.map((item) => (
              <option key={item.value || "all"} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
      </div>
    </motion.section>
  );
}
