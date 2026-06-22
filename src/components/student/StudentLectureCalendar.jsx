"use client";

import { motion } from "framer-motion";
import SubjectFilter from "@/components/student/SubjectFilter";
import StatusFilter from "@/components/student/StatusFilter";

const ranges = [
  ["all", "All classes"],
  ["today", "Today"],
  ["current_week", "Current week"],
  ["next_week", "Next week"],
  ["selected_date", "Selected date"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
];

function monthDays(dateValue) {
  const base = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return Array.from({ length: last.getDate() }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth(), index + 1);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  });
}

export default function StudentLectureCalendar({ filters, subjects = [], markedDates = [], onChange }) {
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
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Learning calendar</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Choose a lecture date</h2>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {days.map((day) => (
              <button key={day} type="button" onClick={() => update({ date: day, range: "selected_date" })} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${selected === day ? "bg-slate-950 text-white" : marked.has(day) ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200" : "bg-slate-50 text-slate-600"}`}>
                {Number(day.slice(-2))}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:w-[34rem]">
          <input type="date" value={filters.date} onChange={(event) => update({ date: event.target.value, range: "selected_date" })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400" />
          <select value={filters.range} onChange={(event) => update({ range: event.target.value })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400">
            {ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <SubjectFilter value={filters.subjectId} subjects={subjects} onChange={(subjectId) => update({ subjectId })} />
          <StatusFilter value={filters.status} onChange={(status) => update({ status })} />
        </div>
      </div>
    </motion.section>
  );
}
