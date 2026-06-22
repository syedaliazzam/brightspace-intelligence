"use client";

import { motion } from "framer-motion";
import { formatDateTimeRange } from "@/lib/dateTime";
import { canShowJoinMeet, canShowMarkConducted, getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function TeacherSelectedDateLectures({ items = [], loading, onMarkConducted }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
            Selected lectures
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Calendar schedule
          </h2>
        </div>
        <p className="text-sm text-slate-500">{loading ? "Refreshing..." : `${items.length} lecture${items.length === 1 ? "" : "s"}`}</p>
      </div>

      <div className="mt-5 grid gap-3">
        {items.length ? items.map((item, index) => {
          const canShowMeet = canShowJoinMeet(item);
          const displayStatus = item.display_status || getLectureDisplayStatus(item);

          return (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.025 }}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.student_name} - {item.subject_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateTimeRange(item.scheduled_start, item.scheduled_end)}
                  </p>
                  <p className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {displayStatus}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {canShowMeet ? (
                    <>
                      <a
                        href={item.google_meet_link}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Join Google Meet
                      </a>
                    </>
                  ) : (
                    <span className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                      {displayStatus}
                    </span>
                  )}
                  {canShowMarkConducted(item) ? (
                    <button
                      type="button"
                      onClick={() => onMarkConducted?.(item)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Mark Conducted
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.article>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No lectures found for the selected calendar filters.
          </div>
        )}
      </div>
    </motion.section>
  );
}
