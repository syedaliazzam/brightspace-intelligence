"use client";

import { motion } from "framer-motion";
import { formatDateTime } from "@/lib/dateTime";
import { getLectureDisplayStatus } from "@/lib/lectureStatus";

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

export default function ClassTimeline({ items = [] }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-slate-100/80 p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.16)]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Learning timeline</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Lecture progress</h2>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-10 top-0 bottom-0 w-px bg-slate-300" />
        <div className="space-y-4">
          {items.length ? (
            items.map((item, index) => {
              const statusKey = String(getLectureDisplayStatus(item) || item.status || "").toLowerCase();
              const badgeClass = STATUS_BADGES[statusKey] || "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
              const markerClass = STATUS_MARKERS[statusKey] || "bg-slate-600";

              return (
                <motion.article
                  key={`${item.id || "timeline"}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.025 }}
                  className="relative overflow-hidden rounded-[1.5rem] border border-white bg-white p-4 pl-16 shadow-sm shadow-slate-200/30 transition duration-200 hover:shadow-md"
                >
                  <div className="absolute left-4 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200">
                    <span className={`h-2.5 w-2.5 rounded-full ${markerClass}`} />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold tracking-tight text-slate-950">{item.title || "Untitled event"}</h3>
                      <p className="text-sm text-slate-600">
                        {item.subject_name || "Unknown subject"}
                        {item.teacher_name ? ` - Teacher: ${item.teacher_name}` : ""}
                      </p>
                      <p className="text-sm text-slate-500">{formatDateTime(item.occurred_at || item.scheduled_start)}</p>
                    </div>

                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${badgeClass}`}>
                      {formatStatus(statusKey)}
                    </span>
                  </div>

                  {item.recording_drive_url ? (
                    <a href={item.recording_drive_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                      View recording
                    </a>
                  ) : null}
                </motion.article>
              );
            })
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No timeline activity is available yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
