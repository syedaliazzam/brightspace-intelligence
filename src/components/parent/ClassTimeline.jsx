"use client";

import { motion } from "framer-motion";
import { formatDateTime } from "@/lib/dateTime";
import { getLectureDisplayStatus } from "@/lib/lectureStatus";

const STATUS_BADGES = {
  scheduled: "bg-[#FAF7F0] text-[#245C4F] ring-1 ring-[#2D8A6A]/15",
  upcoming: "bg-[#E9F8F1] text-[#0D5C48] ring-1 ring-[#2D8A6A]/15",
  live: "bg-[#E0EEFF] text-[#1d4ed8] ring-1 ring-[#2563eb]/20",
  completed_by_teacher: "bg-[#FAF7F0] text-[#245C4F] ring-1 ring-[#2D8A6A]/15",
  verified_by_coordinator: "bg-[#E9F8F1] text-[#0D5C48] ring-1 ring-[#2D8A6A]/15",
  missed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  cancelled: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  disputed: "bg-[#FFF5D6] text-[#8A6B00] ring-1 ring-[#E4C766]/60",
  rescheduled: "bg-[#FFF5D6] text-[#8A6B00] ring-1 ring-[#E4C766]/60",
};

const STATUS_MARKERS = {
  scheduled: "bg-[#9ca3af]",
  upcoming: "bg-[#0D5C48]",
  live: "bg-[#2563eb]",
  completed_by_teacher: "bg-[#9ca3af]",
  verified_by_coordinator: "bg-[#0D5C48]",
  missed: "bg-rose-600",
  cancelled: "bg-rose-600",
  disputed: "bg-[#C9A227]",
  rescheduled: "bg-[#C9A227]",
};

function formatStatus(status) {
  return typeof status === "string" ? status.replaceAll("_", " ") : "";
}

export default function ClassTimeline({ items = [] }) {
  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 shadow-[0_30px_80px_-40px_rgba(13,59,46,0.16)]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Learning timeline</p>
          <h2 className="mt-1 font-serif text-xl font-semibold tracking-tight text-[#063F32]">Lecture progress</h2>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-10 top-0 bottom-0 w-px bg-[#E4C766]/50" />
        <div className="space-y-4">
          {items.length ? (
            items.map((item, index) => {
              const statusKey = String(getLectureDisplayStatus(item) || item.status || "").toLowerCase();
              const badgeClass = STATUS_BADGES[statusKey] || "bg-[#FAF7F0] text-[#245C4F] ring-1 ring-[#2D8A6A]/15";
              const markerClass = STATUS_MARKERS[statusKey] || "bg-[#9ca3af]";

              return (
                <motion.article
                  key={`${item.id || "timeline"}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.025 }}
                  className="relative overflow-hidden rounded-[1.5rem] border border-white bg-white p-4 pl-16 shadow-sm shadow-[rgba(13,59,46,0.08)] transition duration-200 hover:shadow-md"
                >
                  <div className="absolute left-4 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow ring-1 ring-[#F1EADC]">
                    <span className={`h-2.5 w-2.5 rounded-full ${markerClass}`} />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold tracking-tight text-[#063F32]">{item.title || "Untitled event"}</h3>
                      <p className="text-sm text-[#245C4F]">
                        {item.subject_name || "Unknown subject"}
                        {item.teacher_name ? ` - Teacher: ${item.teacher_name}` : ""}
                      </p>
                      <p className="text-sm text-[#0D5C48]">{formatDateTime(item.occurred_at || item.scheduled_start)}</p>
                    </div>

                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${badgeClass}`}>
                      {formatStatus(statusKey)}
                    </span>
                  </div>

                  {item.recording_drive_url ? (
                    <a href={item.recording_drive_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-[#FAF7F0] px-3 py-1.5 text-sm font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]">
                      View recording
                    </a>
                  ) : null}
                </motion.article>
              );
            })
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
              No timeline activity is available yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
