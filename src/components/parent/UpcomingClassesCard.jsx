"use client";

import { formatDateTimeRange } from "@/lib/dateTime";
import { canShowJoinMeet, getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function UpcomingClassesCard({ items = [] }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
          Upcoming lectures
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Google Meet schedule
        </h2>
      </div>

      <div className="space-y-3">
        {items.length ? items.map((item, index) => (
          <article key={`${item.id || "upcoming"}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.subject_name} with {item.teacher_name}
                </p>
                <p className="mt-1 text-sm text-slate-500">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.display_status || getLectureDisplayStatus(item)}</p>
              </div>
              {canShowJoinMeet(item) ? (
                <a
                  href={item.google_meet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Join Meet
                </a>
              ) : (
                <span className="rounded-2xl bg-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-600">
                  {item.display_status || getLectureDisplayStatus(item)}
                </span>
              )}
            </div>
          </article>
        )) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            No upcoming lectures are scheduled yet.
          </p>
        )}
      </div>
    </section>
  );
}
