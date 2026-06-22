"use client";

import { motion } from "framer-motion";
import { formatDateTime, formatDateTimeRange } from "@/lib/dateTime";
import { canShowJoinMeet, getLectureDisplayStatus } from "@/lib/lectureStatus";

const STATUS_BADGES = {
  scheduled: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  upcoming: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  live: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  completed_by_teacher: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
  verified_by_coordinator: "bg-green-50 text-green-700 ring-1 ring-green-200",
  missed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  cancelled: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  disputed: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  rescheduled: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
};

const STATUS_MARKERS = {
  scheduled: "bg-sky-600",
  upcoming: "bg-emerald-600",
  live: "bg-amber-600",
  completed_by_teacher: "bg-slate-600",
  verified_by_coordinator: "bg-green-600",
  missed: "bg-rose-600",
  cancelled: "bg-rose-600",
  disputed: "bg-orange-600",
  rescheduled: "bg-violet-600",
};

function formatStatus(status) {
  return typeof status === "string" ? status.replaceAll("_", " ") : "";
}

export default function StudentClassTimeline({ items = [] }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-slate-100/80 p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.16)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-700">Learning timeline</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Track your lessons and progress</h2>
        </div>
      </div>

      <div className="mt-5 relative">
        <div className="pointer-events-none absolute left-10 top-0 bottom-0 w-px bg-slate-300" />
        <div className="space-y-3">
          {items.map((item, index) => {
            const displayStatus = item.display_status || getLectureDisplayStatus(item);
            const statusKey = String(displayStatus || item.status || "").toLowerCase();
            const badgeClass = STATUS_BADGES[statusKey] || "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
            const markerClass = STATUS_MARKERS[statusKey] || "bg-slate-600";

            return (
              <motion.article
                key={`${item.id}-${index}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="relative overflow-hidden rounded-[1.5rem] border border-white bg-white p-3 pl-16 shadow-sm shadow-slate-200/30 transition duration-200 hover:shadow-md"
              >
                <div className="absolute left-4 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200">
                  <span className={`h-2.5 w-2.5 rounded-full ${markerClass}`} />
                </div>

                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold tracking-tight text-slate-950">{item.title || "Untitled lesson"}</h3>
                    <p className="text-sm text-slate-600">
                      {item.subject_name || "Unspecified subject"}
                      {item.teacher_name ? ` · ${item.teacher_name}` : ""}
                    </p>
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${badgeClass}`}>
                    {displayStatus}
                  </span>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">When</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDateTimeRange(item.scheduled_start, item.scheduled_end)}
                    </p>
                  </div>
                  {item.completion_summary ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Summary</p>
                      <p className="mt-1 text-sm text-slate-600">{item.completion_summary}</p>
                    </div>
                  ) : null}
                </div>

                {item.description ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {item.recording_drive_url ? (
                    <a href={item.recording_drive_url} target="_blank" rel="noreferrer" className="rounded-full bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100">
                      View recording
                    </a>
                  ) : null}
                  {canShowJoinMeet(item) ? (
                    <a href={item.google_meet_link} target="_blank" rel="noreferrer" className="rounded-full bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100">
                      Join meeting
                    </a>
                  ) : null}
                </div>
              </motion.article>
            );
          })}

          {!items.length ? (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No timeline records found.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
